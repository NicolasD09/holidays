# 10 — Sprint 2 préparé : la boucle complète ⚑

> État : **non démarré.** Ce document est le plan de vol, écrit avant la
> première ligne de code, pour que tu saches exactement ce qui va être
> construit — et ce qui ne le sera pas.
> Prérequis bloquants en §10.1 : tant qu'ils ne sont pas levés, le sprint ne
> peut pas s'ouvrir.

**Objectif** : créer un sondage, l'envoyer, le rejoindre, voter sur une
destination — de bout en bout, sur téléphone. Une seule catégorie, un seul mode
de vote. C'est le sprint qui rend le projet réel.

---

## 10.1 Ce qui bloque le démarrage

Trois choses relèvent de toi seul. Aucune ne prend plus de dix minutes, sauf la
troisième.

### A. Fermer le sprint 1 (doc 09 §« Reste à faire »)

État vérifié le 11/09 sur le dépôt lui-même.

| # | Action | État |
|---|---|---|
| 1 | Merger `sprint/00-socle` puis le sprint 1 dans `main` | ✅ **fait** — `main` = `origin/main` = `3e089bd`, HEAD sur `main`, migrations et types du sprint 1 présents dans l'arbre |
| 2 | Copier `.github/workflows/ci.yml` à la main | ❌ **pas fait** — le fichier en place est celui du sprint 0 (816 o, un seul job `verifier`). La version du sprint 1 (2 749 o, jobs `rls` et `securite`) dort dans `Claude outputs/ci-1.yml`. Les fichiers de workflow sont protégés en écriture à distance : **c'est un copier-coller manuel, je ne peux pas le faire** |
| 3 | Secrets GitHub `SUPABASE_DEV_URL` et `SUPABASE_DEV_PUBLISHABLE_KEY` | ❓ invérifiable d'ici — et sans effet tant que le point 2 n'est pas fait, puisque le job qui les consomme n'existe pas encore |
| 4 | Coller `supabase/seed.sql` dans le SQL editor de `holidays-dev` | ❓ invérifiable d'ici (Supabase hors allowlist). Ouvrir `/t/demo-vacances-2027` tranche en 5 secondes. Confort seulement |

> **Conséquence du point 2** : aujourd'hui, une PR qui casserait la RLS
> passerait la CI au vert. Les 39 contrôles hors ligne et les 50 contrôles
> contre `holidays-dev` existent, sont verts, et ne sont **appelés par
> personne**. C'est la barrière du sprint 2 qui est en jeu : à corriger avant
> d'ouvrir la branche.

### B. ⚠️ Un hébergeur, **maintenant** — pas au sprint 9

Le doc 08 §8.3 place la création du compte Netlify/Vercel avant le sprint 9.
**C'est trop tard.** Le livrable du sprint 2 est *« une URL de prévisualisation
que tu peux réellement envoyer dans le groupe »*, et sa recette se joue sur
**Safari iOS réel**. Sans URL publique, le sprint 2 n'a pas de livrable et le
jalon ⚑ — le moment le plus important du projet — ne peut pas avoir lieu.

Ce qu'il faut, dans l'ordre :
1. un compte **Netlify** ou **Vercel** connecté au dépôt GitHub ;
2. le **déploiement de prévisualisation par PR** activé (par défaut chez les deux) ;
3. les variables d'environnement de build renseignées côté hébergeur :
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, pointant sur
   `holidays-dev`.

Rien à trancher sur le nom ni le domaine (Q1 et Q2) : une URL générée du type
`deploy-preview-3--xxx.netlify.app` suffit largement pour tester avec le groupe.
Ces deux questions restent au sprint 9.

> Si tu préfères ne pas créer de compte tout de suite, l'alternative est de
> jouer la recette sur ton réseau local (`vite dev --host` + l'IP du poste).
> Ça marche pour toi, mais **tu ne peux pas envoyer le lien dans le groupe** —
> donc le jalon saute. Je pars du principe que tu prends l'hébergeur.

### C. Rien d'autre

L'auth anonyme est active, les clés sont transmises, les migrations sont
appliquées sur `holidays-dev`, les 50 contrôles de sécurité sont verts. Le
socle est prêt.

---

## 10.2 Les dépendances que j'ajouterai

Toutes sont prévues au doc 04 §4.2 : je n'ai donc pas à te les demander
(doc 08 §8.2), mais autant que ce soit écrit.

| Paquet | Usage | Poids sur le bundle |
|---|---|---|
| `react-hook-form` | formulaires É2 et É3 | ~9 Ko gzip |
| `zod` | validation partagée saisie / typage | ~14 Ko gzip |
| `@playwright/test` | E2E, deux contextes navigateur | dev only |

`date-fns` n'arrive qu'au sprint 4 (dates). Aucune librairie d'état global,
aucune librairie de graphiques : les barres de résultats sont du CSS
(doc 04 §4.2).

---

## 10.3 Le contrat livré par le sprint 1

Tout ce qui suit **existe déjà et est testé**. Le sprint 2 n'écrit aucune
migration : il consomme.

### Écriture — uniquement par RPC

| Fonction | Signature | Retour |
|---|---|---|
| `app_create_trip` | `(p_title text, p_emoji text = '🏖️', p_display_name text, p_categories jsonb)` | `{trip_id, slug, participant_id, display_name}` |
| `app_trip_preview` | `(p_slug text)` — **seule RPC ouverte sans session** | `{trip_id, slug, title, description, cover_emoji, status, participant_count, is_participant, categories[]}` |
| `app_join_trip` | `(p_slug text, p_display_name text)` | `{trip_id, participant_id, display_name, is_organizer, created}` |
| `app_cast_vote` | `(p_option_id uuid, p_value smallint)` | `{option_id, value}` |
| `app_retract_vote` | `(p_option_id uuid)` | `void` |
| `app_category_results` | `(p_category uuid)` | tableau trié par score décroissant |

`p_categories` attend un tableau JSON d'objets
`{kind, label, vote_mode, allow_participant_options, max_choices}`. Le sprint 2
en envoie **un seul** : `{kind:'destination', label:'Destination', vote_mode:'approval'}`.
Les modes `availability` et `amount` sont refusés en base — c'est voulu, leurs
écrans n'existent pas.

### Lecture — PostgREST sous RLS

Pas de RPC de lecture « sondage complet ». Une fois participant, le client lit
directement `trips`, `categories`, `options`, `votes` : la RLS filtre. Un
non-participant ne lit **rien**, même en connaissant les UUID (vérifié, 50
contrôles verts).

### L'ajout de proposition est un `insert` direct

Pas de RPC. La policy `options_insert` exige que `created_by` soit **l'id du
participant courant** — le client doit donc connaître son `participant_id`, que
`app_join_trip` et `app_create_trip` renvoient tous les deux. Elle exige aussi
que la catégorie soit ouverte et que `allow_participant_options` soit vrai (ou
que l'appelant soit organisateur).

### Codes d'erreur

Les 21 codes levés par les RPC sont **déjà traduits** dans `lib/errors.ts` :
`trip_not_found`, `not_participant`, `category_closed`, `invalid_vote_value`,
`blind_mode_active`, `participant_limit_reached`… Aucun nouveau code n'est
attendu au sprint 2. `toUserMessage(error)` suffit partout.

### Trois trous connus dans le contrat

| Trou | Conséquence sur le sprint 2 |
|---|---|
| `app_create_trip` n'a **pas** de paramètre `blind_mode` | l'option avancée « vote à l'aveugle » de l'écran É2 n'est pas réglable à la création. Hors périmètre du sprint 2 de toute façon ; à ajouter par une migration au sprint 7 avec l'écran de réglages. |
| `app_claim_participant` **non implémentée** (doc 09) | le lien *« Tu as déjà participé depuis un autre téléphone ? »* de l'écran É3 **ne sera pas construit**. Un pote qui change de téléphone crée un second participant. Le doublon se fusionne au sprint 8 (tâche 6.6). |
| `app_can_see_votes` ignore les disponibilités | sans effet ici : pas de catégorie dates au sprint 2. |

---

## 10.4 Périmètre

**Dans le sprint**

- Écran É1 — accueil : bouton **Créer un sondage** enfin actif.
- Écran É2 — création : titre, emoji, catégorie Destination imposée, prénom.
- Modale de partage : copie, `navigator.share`, message pré-rempli.
- Écran É3 — `JoinGate` : aperçu avant identification, adhésion par prénom.
- Écran É5a — vote approbation : `OptionCard`, `ApprovalButtons`, mutation
  optimiste, reprise sur échec.
- Ajout de proposition inline.
- E2E Playwright à deux contextes + déploiement de prévisualisation par PR.

**Hors sprint, explicitement** — et ce n'est pas de la dette, c'est le plan :

| Ce qui n'existe pas | Où ça arrive |
|---|---|
| Hub multi-catégories (É4) : le lien `/t/:slug` mène **directement** à l'unique catégorie | sprint 3 |
| Sélecteur de catégories à la création, modes `single`/`multiple` | sprint 3 |
| Écran `/mine`, options avancées, réglages, clôture, récap | sprints 3 et 7 |
| Temps réel : les votes des autres apparaissent **au rafraîchissement** | sprint 8 |
| Commentaires, avatars, relances | sprint 8 |
| Revendication d'un participant depuis un autre appareil | sprint 8 |

---

## 10.5 Plan de travail, fichier par fichier

Le sprint est taillé **L**. Je le livre en **une seule PR** mais en trois
blocs de commits, pour que la relecture suive le parcours utilisateur.

### Bloc 1 — Créer et partager (tâches 1.6 et 1.7)

```
src/features/trip/api/createTrip.ts          app_create_trip + validation zod du retour
src/features/trip/hooks/useCreateTrip.ts     mutation + navigation vers /t/:slug
src/features/trip/components/EmojiPicker.tsx liste courte d'emoji, pas de dépendance
src/features/trip/components/ShareSheet.tsx  copie · navigator.share · message pré-rempli
src/features/trip/pages/CreateTripPage.tsx   remplace le SoonState
src/hooks/useClipboard.ts                    avec repli si l'API n'est pas dispo
src/components/ui/dialog.tsx                 shadcn, non encore copié
src/components/ui/label.tsx  textarea.tsx    idem
```

Décisions déjà prises, toutes réversibles :
- **Une seule page qui défile**, pas d'assistant (doc 05 §5.3 É2).
- **Emoji parmi une liste de 24**, pas de sélecteur complet : zéro dépendance,
  et personne ne cherche 🫙 pour des vacances.
- Le formulaire **conserve sa saisie** en cas d'échec réseau et propose de
  réessayer — exigence explicite du doc 05.
- La modale de partage n'est **pas passable par erreur** : pas de fermeture au
  clic extérieur, un bouton « Continuer » explicite.

### Bloc 2 — Rejoindre (tâche 1.8)

```
src/features/participant/api/tripPreview.ts     app_trip_preview (sans session)
src/features/participant/api/joinTrip.ts        app_join_trip
src/features/participant/hooks/useTripAccess.ts aperçu + participation, une seule source
src/features/participant/components/JoinGate.tsx panneau bas ancré, champ prénom
src/app/layouts/TripLayout.tsx                   pose la garde
```

Décisions déjà prises :
- `TripLayout` **ne redirige jamais** : il superpose le `JoinGate` par-dessus
  l'aperçu atténué, pour que le lien partagé reste stable (doc 04 §4.4).
- L'aperçu est chargé **avant** toute session anonyme. La session n'est créée
  qu'au moment où on tape « Rejoindre » — un pote qui ouvre le lien sans
  rejoindre ne laisse aucune trace côté auth.
- `is_participant: true` dans l'aperçu ⇒ pas de `JoinGate`, on entre direct.
- Pas de lien « déjà participé depuis un autre téléphone » (§10.3).

### Bloc 3 — Voter (tâches 1.9 et 1.10)

```
src/features/voting/api/listOptions.ts       select sous RLS
src/features/voting/api/myVotes.ts           mes votes de la catégorie
src/features/voting/api/castVote.ts          app_cast_vote / app_retract_vote
src/features/voting/api/categoryResults.ts   app_category_results
src/features/voting/api/addOption.ts         insert direct, created_by imposé
src/features/voting/hooks/useVote.ts         mutation optimiste (patron doc 04 §4.5)
src/features/voting/components/ApprovalButtons.tsx  radiogroup, cibles 44 px
src/features/voting/components/OptionCard.tsx
src/features/voting/components/ResultBar.tsx        CSS pur
src/features/voting/components/AddOptionInline.tsx
src/features/voting/pages/CategoryPage.tsx
```

Décisions déjà prises :
- **Retap = annulation du vote** (doc 05 §5.3) → `app_retract_vote`, qui existe
  précisément pour ça.
- Le **tri est figé pendant la session de vote**, avec un bouton « Reclasser » :
  une carte ne bouge jamais sous le doigt (doc 05 §5.3).
- `aria-live="polite"` sur le vote enregistré, `role="radiogroup"` +
  `aria-checked` sur les trois boutons (doc 05 §5.5).
- `navigator.vibrate(10)` en retour haptique, désactivé sous
  `prefers-reduced-motion`.
- Une proposition avec au moins un « non » porte un liseré et la mention
  *« Ne convient pas à 1 personne »*.

### Bloc 4 — Preuves (tâches 1.12 et déploiement)

```
e2e/parcours-complet.spec.ts   Marie crée → Thomas rejoint et vote → Marie voit le résultat
playwright.config.ts
.github/workflows/ci.yml       job e2e ajouté (à recopier à la main, cf. §10.1)
netlify.toml (ou vercel.json)  redirection SPA : /* → /index.html
```

La redirection SPA n'est pas un détail : sans elle, un pote qui **ouvre
directement** `/t/abc123` depuis WhatsApp tombe sur un 404 de l'hébergeur. C'est
exactement le cas d'usage du produit.

---

## 10.6 Ce que je te demanderai en cours de route

Rien, sauf si l'un de ces trois cas se présente :

1. une décision **irréversible** (aucune n'est prévue : ce sprint n'écrit pas
   de migration et ne supprime rien) ;
2. un **test de sécurité qui échoue** — je ne contourne jamais, je remonte ;
3. l'hébergeur qui refuse le déploiement pour une raison qui demande ton compte.

Tout le reste part sur l'option la plus réversible, et sera listé dans la
section « décidé sans toi » de la PR.

---

## 10.7 Recette

À jouer **sur ton téléphone**, sur l'URL de prévisualisation — pas sur le poste
de dev.

1. Créer un sondage « Vacances test », proposer 3 destinations.
2. Copier le lien, l'envoyer sur le groupe (ou dans une fenêtre privée).
3. Depuis le second navigateur : le titre et les 3 destinations sont visibles
   **avant** d'entrer un prénom.
4. Entrer un prénom, voter Oui / Peut-être / Non — chaque tap est enregistré,
   sans bouton Valider.
5. Retaper le même bouton : le vote est **annulé**, pas remplacé.
6. Recharger la page : le prénom et les votes sont retrouvés.
7. Revenir au premier navigateur, rafraîchir : les votes du second sont comptés.
8. Passer en mode avion, voter → message d'échec avec bouton **Réessayer**, pas
   d'écran blanc, et le vote revient à son état précédent.
9. Ajouter une proposition depuis le second navigateur : elle apparaît chez le
   premier après rafraîchissement.
10. Entrer deux fois le même prénom depuis deux appareils : le second devient
    « Thomas (2) », personne n'est refusé.

**Fini quand** : la recette passe sur Safari iOS réel, l'E2E est verte, aucun
`any` n'a été introduit, et aucune chaîne visible ne vit hors de `lib/labels.ts`.

---

## 10.8 Risques identifiés

| Risque | Probabilité | Parade prévue |
|---|---|---|
| `navigator.share` absent ou capricieux sur Safari iOS | moyenne | le bouton **Copier le lien** est le chemin principal ; le partage natif est un bonus affiché seulement si l'API existe |
| La session anonyme ne survit pas au rechargement en navigation privée iOS | moyenne | déjà couvert par `lib/auth.ts` (session persistée) ; l'étape 6 de la recette est précisément là pour le prouver — si ça casse, ça se voit tout de suite |
| Le vote optimiste et l'invalidation se marchent dessus (score qui clignote) | moyenne | `onSettled` n'invalide que `qk.results`, jamais `qk.myVotes` qui porte l'état optimiste |
| Playwright instable en CI sur deux contextes | faible | l'E2E ne bloque pas la PR au premier passage ; si elle s'avère capricieuse, elle passe en job non bloquant et c'est écrit en dette |
| L'hébergeur n'est pas prêt | **c'est le vrai risque** | §10.1 B — c'est le seul point qui peut décaler le jalon |

---

## 10.9 Après le sprint 2

> ### ⚑ Jalon — on s'arrête ici
> Avant le sprint 3, **utilise l'app avec ton groupe pour une vraie décision.**
> Trois questions à te poser à la sortie (doc 07 §7.4) :
> - Les potes fantômes ont-ils voté ? (taux de participation à 72 h)
> - Le multi-catégories est-il attendu, ou la destination suffit-elle ?
> - Qu'est-ce qui a coincé que personne n'avait prévu ?
>
> Le plan des sprints 3 à 9 est une **hypothèse**. Si le terrain dit autre
> chose, on le réécrit plutôt que de le dérouler.
