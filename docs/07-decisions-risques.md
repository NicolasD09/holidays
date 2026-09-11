# 07 — Décisions, risques & questions ouvertes

## 7.1 Décisions d'architecture (ADR)

### ADR-001 — Supabase plutôt qu'un backend maison
**Statut** : accepté.
**Contexte** : un développeur, en temps libre, sur un outil destiné à une dizaine d'utilisateurs.
**Décision** : Supabase (Postgres géré, auth, realtime, RLS). Aucun serveur applicatif.
**Conséquences** : ✅ zéro maintenance serveur, temps réel gratuit, sécurité déclarative en RLS. ❌ dépendance forte à un fournisseur, logique métier en PL/pgSQL (moins testable qu'en TS), une panne Supabase = app indisponible.
**Alternatives écartées** : Firebase (NoSQL mal adapté aux agrégats de vote), Node + Postgres (trop de maintenance pour l'enjeu).

### ADR-002 — Identité par lien secret + auth anonyme
**Statut** : accepté.
**Contexte** : le persona « pote fantôme » abandonne à la moindre friction. Toute création de compte fait perdre des votants.
**Décision** : le slug du sondage est un secret à haute entropie (≥ 64 bits). Rejoindre = connaître le lien + saisir un pseudo. Une session anonyme Supabase, invisible pour l'utilisateur, ancre la RLS.
**Conséquences** : ✅ friction quasi nulle, aucune donnée personnelle collectée, RGPD trivial. ❌ qui a le lien peut voter et se faire passer pour n'importe qui ; effacer les données du navigateur fait perdre son identité ; un même utilisateur sur deux appareils compte double.
**Atténuations** : lien non indexable (`noindex`), régénération du lien possible, revendication d'identité (« C'est déjà moi »), fusion de doublons par l'organisateur, plafond de 50 participants.
**Assumé** : c'est un groupe d'amis, pas une élection. Le modèle de menace exclut l'attaquant motivé ; il couvre l'erreur, l'indiscrétion et le partage accidentel du lien.

### ADR-003 — Sécurité en RLS, jamais dans le front
**Statut** : accepté.
**Décision** : la clé `anon` étant publique, toute règle d'accès est appliquée par Postgres. Le front est considéré comme hostile.
**Conséquences** : les policies deviennent du code critique, testé en priorité (doc 04 §4.7). Le mode aveugle et la confidentialité du budget sont des règles de base, pas d'interface.

### ADR-004 — Une seule table `votes` pour tous les modes de vote
**Statut** : accepté.
**Décision** : `votes.value smallint` couvre approbation (−1/0/1), choix unique et choix multiple (1). Les dates et le budget, de forme différente, ont leurs propres tables.
**Conséquences** : ✅ agrégats et realtime uniformes, ajout d'un mode sans migration. ❌ la sémantique de `value` dépend du mode — documentée en base et dans les types.

### ADR-005 — TanStack Query comme seul état serveur
**Statut** : accepté.
**Décision** : pas de store global. Les événements realtime **invalident** les requêtes au lieu de patcher le cache.
**Conséquences** : ✅ une seule source de vérité, cohérence garantie, mode aveugle respecté sans code dédié. ❌ un aller-retour réseau supplémentaire par événement — négligeable à 10 participants.

### ADR-006 — Confidentialité stricte des budgets
**Statut** : accepté.
**Contexte** : persona Sarah. Un budget public transforme une contrainte financière en aveu social.
**Décision** : les montants individuels ne sont lisibles par personne d'autre que leur auteur — l'organisateur inclus. Exposition uniquement par agrégat, à partir de 3 répondants, et `budget_answers` est exclue du realtime.
**Conséquences** : ✅ des réponses sincères. ❌ impossible de relancer nominativement sur le budget ; l'organisateur doit accepter de ne pas savoir. C'est le prix de la sincérité.

### ADR-007 — Mode aveugle appliqué en base
**Statut** : accepté.
**Décision** : le masquage des votes d'autrui est une policy RLS, pas un `if` d'interface.
**Conséquences** : contourner l'UI ne révèle rien. Complexifie les policies sur `votes` et impose la fonction `app_can_see_votes`.

### ADR-008 — Français dans l'interface, anglais dans le code
**Statut** : accepté.
**Décision** : domaine et identifiants en anglais (`trip`, `option`, `vote`) ; toutes les chaînes visibles centralisées dans `lib/labels.ts`.
**Conséquences** : l'i18n reste possible sans réécriture, sans en payer le coût maintenant.

### ADR-009 — Aucun mécanisme d'échéance
**Statut** : accepté.
**Contexte** : les outils de sondage installent par réflexe des dates limites et des comptes à rebours. Entre amis, ce vocabulaire est déplacé : personne ne « rend un livrable en retard », et un badge rouge sur le nom de Julien transforme une décision de vacances en rappel de tâche.
**Décision** : aucune date limite, aucun compte à rebours, aucun rappel automatique, aucun signalement de retard, nulle part. Une catégorie reste ouverte jusqu'à ce que l'organisateur la clôture volontairement. La seule relance est un message qu'il choisit d'écrire lui-même.
**Conséquences** : ✅ le ton reste celui d'un groupe de potes ; moins d'écrans, moins d'états, moins de code (colonne `deadline_at` supprimée, tâche 7.2 du backlog supprimée, −2 points). ❌ un sondage peut traîner sans que rien ne le pousse ; la clôture repose entièrement sur l'organisateur.
**Contrepartie retenue** : l'app affiche la **participation** (« 5 sur 8 ont répondu », et qui manque) — une information factuelle qui suffit à déclencher une relance humaine, sans injonction ni compte à rebours.
**Alternative écartée** : date limite optionnelle et désactivée par défaut. Rejetée : une option existante finit par être activée, et il faudrait quand même spécifier et coder tous les états de dépassement.

## 7.2 Risques

| # | Risque | Impact | Prob. | Atténuation |
|---|---|---|---|---|
| R1 | **Le groupe n'utilise pas l'app** et retourne sur WhatsApp | Fatal | Moyenne | Jalon obligatoire après le lot 1 : usage réel avant tout développement supplémentaire. Si l'adoption échoue, c'est le produit qu'on corrige, pas le backlog qu'on continue. |
| R2 | Fuite du lien hors du groupe (repartage, capture d'écran) | Moyen | Moyenne | Lien non indexable, régénération possible, plafond de participants, journal des adhésions visible par l'organisateur |
| R3 | Policies RLS erronées → fuite de données entre sondages | Élevé | Moyenne | Tests d'isolation obligatoires à chaque nouvelle table ; aucune mise en ligne sans les 4 tests de sécurité verts |
| R4 | Perte d'identité (navigateur nettoyé, mode privé, changement de téléphone) | Moyen | Élevée | Revendication d'identité, fusion de doublons, avertissement en navigation privée |
| R5 | Complexité de la grille de dispos (lot 3) supérieure à l'estimation | Moyen | Élevée | Repli possible : v0 de la catégorie dates en simple approbation sur des créneaux proposés à la main |
| R6 | Dépassement du tier gratuit Supabase | Faible | Faible | Purge automatique, plafonds par sondage, pas de stockage d'images en v1 |
| R7 | Motivation du développeur qui s'épuise avant la v1 | Élevé | Moyenne | Lots courts et déployables ; le lot 1 apporte déjà de la valeur ; les lots 3+ sont facultatifs |
| R8 | Vote à l'aveugle mal compris par les participants (« pourquoi je ne vois rien ? ») | Faible | Moyenne | Bandeau explicite dans la catégorie ; désactivé par défaut |
| R9 | Abandon de Supabase ou changement de tarification | Élevé | Faible | Schéma Postgres standard, migrations versionnées : réhébergeable sur un Postgres classique, seule l'auth serait à réécrire |

## 7.3 Questions ouvertes

| # | Question | Impact | Échéance |
|---|---|---|---|
| Q1 | **Nom du produit.** « Vacances » est un nom de code. Un nom mémorisable aide au partage dans le groupe. | Faible | avant le lot 5 |
| Q2 | **Domaine et hébergeur.** Un lien court (`vacan.ce/xyz`) se colle mieux dans WhatsApp qu'une URL Netlify. | Moyen | avant le lot 1 (le lien est le produit) |
| Q3 | **La catégorie dates mérite-t-elle une grille sur mesure en v1 ?** Le lot 3 pèse à lui seul 20 % de la v1. Une version « créneaux proposés + vote d'approbation » coûterait 5 points au lieu de 21. | Élevé | jalon post-lot 1 |
| Q4 | **Le mode aveugle doit-il être activé par défaut ?** Meilleure qualité de décision, mais peut décevoir sur un petit groupe où l'on veut voir vivre le vote. | Faible | lot 7 |
| Q5 | **Pondération de l'organisateur en cas d'égalité ?** Aujourd'hui, il tranche manuellement à la clôture — probablement suffisant. | Faible | après retour d'usage |
| Q6 | **Faut-il un mot de passe optionnel sur le sondage** en complément du lien, pour les groupes prudents ? | Faible | v2 |
| Q7 | **Quota de propositions par participant** pour éviter qu'un enthousiaste noie la liste sous 30 destinations. | Moyen | après retour d'usage |

## 7.4 Ce qu'on saura seulement en l'utilisant

Trois hypothèses produit non vérifiables sur le papier, à confronter au jalon post-lot 1 :

1. **Le pote fantôme vote-t-il vraiment ?** Toute la conception d'adhésion repose sur cette hypothèse. Indicateur : taux de participation à 72 h.
2. **Le multi-catégories est-il un atout ou une charge ?** Peut-être que le groupe ne veut voter que sur la destination et discuter du reste. Indicateur : proportion de participants se prononçant sur toutes les catégories.
3. **La confidentialité du budget change-t-elle les réponses ?** Comparer le montant médian déclaré à ce qui se dit ensuite à voix haute.
