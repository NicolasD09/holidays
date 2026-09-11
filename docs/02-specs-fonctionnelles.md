# 02 — Specs fonctionnelles

## 2.1 Vocabulaire

| Terme | Définition |
|---|---|
| **Sondage** (*trip*) | Le conteneur d'une décision de vacances. Possède un lien secret unique. |
| **Participant** | Une personne ayant rejoint un sondage via le lien, identifiée par un pseudo. |
| **Organisateur** | Le participant qui a créé le sondage. Droits d'administration. |
| **Catégorie** | Un axe de décision au sein du sondage (destination, dates, budget…). |
| **Proposition** (*option*) | Un choix possible dans une catégorie (« Lisbonne », « Airbnb centre-ville »). |
| **Vote** | La position d'un participant sur une proposition. |
| **Décision** | Le résultat figé d'une catégorie clôturée. |

## 2.2 Cycle de vie

**Sondage** : `brouillon` → `ouvert` → `clôturé` → `archivé`
- `brouillon` : créé, pas encore partagé. Seul l'organisateur y accède.
- `ouvert` : lien actif, on rejoint et on vote.
- `clôturé` : toutes les catégories sont tranchées. Lecture seule + page récap.
- `archivé` : masqué, purgeable.

**Catégorie** : `ouverte` → `clôturée`
Une catégorie clôturée fige ses votes (lecture seule) et expose une décision.

## 2.3 User stories

Priorité : **P0** = indispensable au lot 1, **P1** = v1, **P2** = v2.

### Épic A — Créer et partager

| ID | Story | Prio |
|---|---|---|
| A1 | En tant qu'organisateur, je crée un sondage avec un titre, pour lancer la discussion. | P0 |
| A2 | En tant qu'organisateur, je choisis les catégories à activer parmi des modèles pré-remplis, pour ne pas partir d'une page blanche. | P0 |
| A3 | En tant qu'organisateur, je récupère un lien de partage en un clic (copie + partage natif mobile), pour le coller dans le groupe. | P0 |
| A4 | En tant qu'organisateur, j'ajoute des propositions initiales dans chaque catégorie, pour amorcer le vote. | P0 |
| A5 | En tant qu'organisateur, je décide si les participants peuvent ajouter leurs propres propositions, pour garder la main si besoin. | P1 |
| A6 | En tant qu'organisateur, j'active le vote à l'aveugle, pour éviter l'effet de meute. | P1 |
| A7 | En tant qu'organisateur, je retrouve mes sondages créés sur cet appareil, pour ne pas perdre le lien. | P1 |

### Épic B — Rejoindre et voter

| ID | Story | Prio |
|---|---|---|
| B1 | En tant que pote, j'ouvre le lien et je vois immédiatement de quoi parle le sondage, avant même de m'identifier. | P0 |
| B2 | En tant que pote, je saisis mon prénom et je participe, sans créer de compte. | P0 |
| B3 | En tant que pote, je vote oui / peut-être / non sur chaque proposition d'une catégorie. | P0 |
| B4 | En tant que pote, je change mon vote tant que la catégorie est ouverte. | P0 |
| B5 | En tant que pote, je retrouve mon identité et mes votes en revenant sur le lien plus tard depuis le même appareil. | P0 |
| B6 | En tant que pote, j'indique mes disponibilités sur un calendrier, pour la catégorie dates. | P1 |
| B7 | En tant que pote, je donne le budget maximum que je peux mettre, sans que le montant soit attribué à mon nom. | P1 |
| B8 | En tant que pote, j'ajoute une proposition (si autorisé), pour défendre mon idée. | P1 |
| B9 | En tant que pote, je vois ce qu'il me reste à faire (catégories non votées), pour finir en une session. | P1 |
| B10 | En tant que pote, je commente une proposition, pour argumenter. | P1 |
| B11 | En tant que pote, je change mon pseudo ou mon avatar. | P2 |

### Épic C — Suivre et décider

| ID | Story | Prio |
|---|---|---|
| C1 | En tant que participant, je vois les résultats en direct d'une catégorie. | P0 |
| C2 | En tant que participant, je vois qui a voté et qui manque à l'appel. | P1 |
| C3 | En tant que participant, je vois les votes se mettre à jour sans rafraîchir la page. | P1 |
| C4 | En tant qu'organisateur, je clôture une catégorie en désignant la proposition retenue. | P0 |
| C5 | En tant qu'organisateur, je rouvre une catégorie clôturée par erreur. | P1 |
| C6 | En tant qu'organisateur, je relance le groupe (message pré-rempli + lien à copier) en ciblant ceux qui n'ont pas voté. | P1 |
| C7 | En tant que participant, je consulte la page de récapitulatif final, et je la partage. | P1 |
| C8 | En tant qu'organisateur, je supprime un participant en double (même personne, deux appareils). | P1 |
| C9 | En tant que participant, j'exporte les dates retenues dans mon agenda (.ics). | P2 |

## 2.4 Parcours clés

### P1 — Création (organisateur, ~90 s)

1. Arrive sur `/`, clique **Créer un sondage**.
2. Saisit un titre (« Vacances d'été 2027 ») et choisit un emoji de couverture. *Le titre est le seul champ obligatoire.*
3. Sélectionne les catégories via des cartes pré-cochées : Destination ✅, Dates ✅, Budget ✅, Logement ☐, Activités ☐. Peut ajouter une catégorie libre.
4. Saisit son pseudo → devient participant + organisateur.
5. Atterrit sur le hub du sondage, avec un bandeau **Partager le lien** proéminent et des catégories vides invitant à ajouter les premières propositions.

> **Règle de conception** : la création ne doit *jamais* bloquer sur du remplissage. Un sondage sans aucune proposition est valide et partageable ; le groupe le remplira.

### P2 — Première participation (pote, ~20 s avant le premier vote)

1. Ouvre le lien reçu sur WhatsApp.
2. Voit le titre, la couverture, les catégories, le nombre de participants déjà là, et un aperçu flouté/atténué du contenu. **Aucun mur de connexion.**
3. Un champ unique en bas : *« Ton prénom pour participer »* + bouton **Rejoindre**.
4. Le pseudo est enregistré ; une session anonyme est créée en arrière-plan et persistée sur l'appareil.
5. Redirigé vers la première catégorie non votée.

**Cas particuliers**
- Pseudo déjà pris dans ce sondage → suggestion automatique (« Julien (2) »), acceptée par défaut, modifiable.
- Retour ultérieur depuis le même appareil → reconnu, aucune ré-identification demandée.
- Retour depuis un autre appareil → traité comme un nouveau participant. Un lien *« C'est déjà moi »* propose de fusionner en choisissant son pseudo existant dans la liste (v1 : reprise simple de l'identité, sans preuve — assumé, cf. doc 07).
- Sondage clôturé → accès direct au récap, en lecture seule.
- Lien invalide → page dédiée, sans exposer l'existence d'autres sondages.

### P3 — Session de vote (pote, ~90 s)

1. Le hub liste les catégories avec, pour chacune, une pastille d'état : `À voter` / `Voté` / `Clôturé`.
2. Le participant entre dans une catégorie et fait défiler les propositions.
3. Chaque proposition est une carte avec trois boutons : **Non** / **Peut-être** / **Oui**. Un tap = un vote enregistré immédiatement (pas de bouton « Valider »).
4. Barre de progression persistante en bas : *« 3/5 catégories — Suivant : Budget »*.
5. À la fin de la dernière catégorie : écran de fin, résultats consolidés, incitation à partager le lien.

> **Règle de conception** : l'enregistrement est optimiste et immédiat. Aucun formulaire à soumettre. En cas d'échec réseau, la carte revient à son état précédent avec un toast de reprise.

### P4 — Clôture (organisateur)

1. Dans une catégorie, l'organisateur voit un bouton **Clôturer cette catégorie**.
2. La proposition en tête est pré-sélectionnée comme décision, mais **il peut en choisir une autre** ou saisir une décision libre.
3. Confirmation (nombre de participants n'ayant pas voté affiché comme avertissement).
4. Catégorie passée en lecture seule, décision affichée en tête de la catégorie et sur le récap.
5. Quand toutes les catégories sont clôturées, le sondage passe en `clôturé` et le récap final devient l'écran d'accueil du lien.

## 2.5 Catégories & modes de vote

Une catégorie a un **type** (sémantique, pilote l'UI et les icônes) et un **mode de vote** (pilote la saisie et le dépouillement). Les types natifs proposent un mode par défaut, modifiable.

| Type de catégorie | Mode de vote par défaut | Modes autorisés |
|---|---|---|
| `destination` | `approbation` | approbation, choix unique, classement (v2) |
| `dates` | `disponibilite` | disponibilité |
| `budget` | `montant` | montant |
| `logement` | `approbation` | approbation, choix unique |
| `activite` | `choix_multiple` | choix multiple, approbation |
| `libre` | `approbation` | tous |

### Mode `approbation`
Chaque proposition reçoit **Oui (+1)** / **Peut-être (0)** / **Non (−1)**. Un participant se prononce sur autant de propositions qu'il veut ; ne pas se prononcer ≠ voter « non ».
- **Score** = `2 × nb_oui + 1 × nb_peut_etre + 0 × nb_non`.
- **Départage** : (1) plus de « oui », (2) moins de « non », (3) proposition la plus ancienne.
- **Signal d'alerte** : une proposition avec ≥ 1 « non » est marquée *« Ne convient pas à N personne(s) »* — un veto exprimé doit rester visible même si le score est bon.

### Mode `choix_unique`
Un seul vote par participant sur toute la catégorie. Voter à nouveau déplace le vote.
- **Score** = nombre de voix. Départage : proposition la plus ancienne.

### Mode `choix_multiple`
Un participant peut sélectionner N propositions (N libre, ou plafonné par l'organisateur).
- **Score** = nombre de sélections.

### Mode `disponibilite` (catégorie dates)
L'organisateur définit une **fenêtre** (date de début, date de fin) et une **durée de séjour** souhaitée en nuits. Chaque participant peint ses disponibilités sur une grille de jours : **Dispo** / **Peut-être** / **Pas dispo** (non renseigné = inconnu).
- **Dépouillement** : l'app calcule toutes les fenêtres glissantes de la durée demandée et les classe par score.
- **Score d'une fenêtre** = `Σ sur les participants` de `2` (dispo tous les jours), `1` (au moins un « peut-être », aucun « pas dispo »), `0` (au moins un « pas dispo »).
- Affichage : top 5 des créneaux, avec pour chacun la liste des absents.
- Renseignement rapide : sélection par glissement sur plusieurs jours, boutons *« tous les week-ends »*, *« toutes mes vacances scolaires »* (v2).

### Mode `montant` (catégorie budget)
Chaque participant saisit **le budget maximum** qu'il peut mettre (entier, en euros, par personne, hors transport ou tout compris — précisé par l'organisateur dans la description de la catégorie).
- **Confidentialité stricte** : les montants individuels ne sont **jamais** affichés, ni exportés, ni consultables par l'organisateur. Seules des agrégations le sont.
- **Restitution** : médiane, minimum, maximum, et surtout **« budget confortable pour tout le groupe »** = le minimum. Formulation : *« À 700 €, tout le monde suit. À 900 €, 2 personnes décrochent. »*
- L'agrégat n'est révélé **qu'à partir de 3 répondants**, pour empêcher la déduction d'un montant individuel.
- Curseur interactif sur la page de résultats : l'utilisateur déplace un montant, l'app affiche combien de personnes suivent — sans jamais dire qui.

## 2.6 Règles métier

**RM-01** — Un participant ne peut voter que dans un sondage qu'il a rejoint, et une catégorie `ouverte`.
**RM-02** — Un participant a au plus un vote par proposition. Un nouveau vote écrase l'ancien.
**RM-03** — En mode `choix_unique`, un participant a au plus un vote sur l'ensemble de la catégorie.
**RM-04** — Seul l'organisateur peut : clôturer/rouvrir une catégorie, supprimer une proposition d'autrui, supprimer un participant, modifier les réglages du sondage, supprimer le sondage.
**RM-05** — Un participant peut supprimer *ses propres* propositions tant qu'elles n'ont reçu **aucun** vote d'un autre participant.
**RM-06** — Supprimer une proposition supprime ses votes et ses commentaires (cascade).
**RM-07** — Supprimer un participant supprime ses votes ; ses propositions sont conservées et réattribuées à *« Ancien participant »*.
**RM-08** — En mode aveugle : tant que le participant n'a voté sur **aucune** proposition de la catégorie, les résultats et les votes d'autrui de cette catégorie lui sont masqués. Le masquage est appliqué **côté base** (RLS), pas seulement côté UI.
**RM-09** — Le mode aveugle tombe automatiquement à la clôture de la catégorie.
**RM-10** — Les agrégats budget ne sont exposés qu'à partir de 3 répondants.
**RM-11** — Le lien de partage contient un identifiant à haute entropie (≥ 64 bits). Il n'est jamais indexable : les pages de sondage portent `noindex, nofollow`.
**RM-12** — Un sondage sans activité depuis 180 jours est marqué archivé ; sans activité depuis 365 jours, il est supprimé définitivement. Averti au moment de la création (mention légère) et rappelé dans les réglages.
**RM-13** — Le premier participant d'un sondage en est l'organisateur. Le rôle est transférable à un autre participant (P2).
**RM-14** — Le nombre de participants par sondage est plafonné à 50, celui des propositions par catégorie à 100 — garde-fous anti-abus, pas des limites produit.
**RM-15** — **Aucun mécanisme d'échéance.** Ni date limite, ni compte à rebours, ni rappel automatique, ni signalement de retard. Une catégorie reste ouverte jusqu'à ce que l'organisateur la clôture volontairement (RM-04). La seule relance possible est un message que l'organisateur choisit d'envoyer lui-même (C6).

## 2.7 Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| **Performance** | LCP < 2,0 s en 4G simulée ; bundle initial < 200 Ko gzip ; changement de vote perçu comme instantané (mise à jour optimiste). |
| **Disponibilité** | Best effort (tier gratuit). Une panne Supabase rend l'app inutilisable : afficher un état d'erreur clair, jamais un écran blanc. |
| **Hors ligne** | Non requis. L'app doit cependant survivre à une coupure : les mutations échouées sont annoncées et rejouables manuellement. |
| **Accessibilité** | WCAG 2.1 AA visé : contraste ≥ 4,5:1, navigation clavier complète, cibles tactiles ≥ 44 px, états de vote annoncés aux lecteurs d'écran (pas de sens porté par la seule couleur). |
| **Compatibilité** | 2 dernières versions de Chrome, Safari (iOS inclus), Firefox, Edge. Safari iOS est la cible prioritaire de test. |
| **Confidentialité** | Aucune donnée personnelle obligatoire. Pas de traceur tiers, pas d'analytics comportemental nominatif. Budgets individuels non consultables. |
| **Sécurité** | Toutes les règles d'accès appliquées en RLS Postgres. Aucune règle métier de sécurité reposant uniquement sur le front. |
| **Observabilité** | Journalisation des erreurs front (Sentry ou équivalent, sans PII), et compteurs d'usage anonymes agrégés. |
| **i18n** | FR seulement en v1, mais aucune chaîne codée en dur dans les composants : tout passe par un fichier de libellés. |
