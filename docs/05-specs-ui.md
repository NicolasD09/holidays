# 05 — Specs UI & écrans

## 5.1 Principes de design

1. **Mobile d'abord, pouce d'abord.** Toute action fréquente est atteignable dans le tiers inférieur de l'écran. Le design desktop est une adaptation, pas l'inverse.
2. **Un tap = un vote enregistré.** Aucun bouton « Valider », aucun formulaire à soumettre pour voter.
3. **Jamais d'écran vide sans issue.** Chaque état vide propose l'action qui le remplit.
4. **La progression est toujours visible.** Le participant sait en permanence ce qu'il lui reste à faire.
5. **Aucune pression temporelle.** Pas de date limite, pas de compte à rebours, pas de badge « en retard », pas de rouge sur le temps qui passe. L'app montre où en est le groupe, jamais qu'il serait en retard.
6. **Chaleureux, pas corporate.** Emoji, couleurs franches, formulations à la deuxième personne du singulier. C'est un projet entre potes, pas un outil RH.

## 5.2 Design system

**Couleurs** (variables CSS, thèmes clair et sombre)

| Rôle | Usage |
|---|---|
| `--brand` | actions primaires, marque — un bleu-vert « bord de mer » |
| `--yes` | vote positif — vert |
| `--maybe` | vote neutre — ambre |
| `--no` | vote négatif — rouge doux, jamais agressif |
| `--surface` / `--surface-2` | fonds de page et de cartes |
| `--text` / `--text-muted` | textes |
| `--border` | séparations |

Le sens n'est **jamais** porté par la seule couleur : chaque état de vote associe une icône et un libellé (`✓ Oui`, `~ Peut-être`, `✕ Non`).

**Typographie** — pile système. Titres 24/20/17 px semi-bold ; corps 16 px (jamais moins de 15 px sur mobile) ; secondaire 14 px.

**Espacement** — échelle de 4 px. Rayon des cartes 12 px, boutons 10 px. Élévation par ombre douce uniquement sur les éléments flottants.

**Cibles tactiles** — 44 × 44 px minimum, sans exception sur les boutons de vote.

**Mouvement** — 150 ms sur les changements d'état, 250 ms sur les transitions de page. Tout est désactivé sous `prefers-reduced-motion`.

## 5.3 Écrans

---

### É1 — Accueil `/`

**But** : comprendre l'outil en 5 secondes et créer un sondage.

- Titre accrocheur, sous-titre en une phrase, illustration légère (emoji ou SVG inline).
- Bouton primaire pleine largeur : **Créer un sondage**.
- Lien secondaire : *« Mes sondages »* — visible uniquement si `localStorage` en contient.
- Trois arguments courts : *sans compte* · *un seul lien* · *tout se décide au même endroit*.

---

### É2 — Création `/new`

**But** : un sondage partageable en moins de 90 secondes.

Une seule page qui défile, pas un assistant multi-étapes.

1. **Titre** (obligatoire, autofocus) + sélecteur d'emoji de couverture (défaut 🏖️).
2. **Catégories** — grille de cartes activables :

   | Carte | État par défaut | Réglage inline |
   |---|---|---|
   | 🌍 Destination | activée | — |
   | 📅 Dates | activée | fenêtre de recherche + nombre de nuits |
   | 💶 Budget | activée | devise, « par personne / tout compris » |
   | 🏠 Logement | désactivée | — |
   | 🎿 Activités | désactivée | — |
   | ➕ Autre… | — | libellé libre + mode de vote |

3. **Ton prénom** (obligatoire) — devient l'organisateur.
4. **Options avancées**, repliées : vote à l'aveugle, autoriser les participants à proposer.
5. Bouton **Créer et obtenir le lien**.

**Après création** : modale de partage, non passable par erreur — grand bouton **Copier le lien**, `navigator.share()` sur mobile, message pré-rempli prêt à coller (« Salut ! On décide des vacances ici 👉 <lien> — ça prend 2 min »).

**Erreurs** : titre vide → message sous le champ ; échec réseau → le formulaire conserve sa saisie et propose de réessayer.

---

### É3 — Adhésion (`JoinGate`, superposé à `/t/:slug`)

**But** : convertir le pote fantôme. **L'écran le plus important de l'app.**

- Le contenu du sondage est visible derrière, atténué : titre, emoji, catégories, avatars des participants déjà là (« Marie, Thomas et 3 autres participent »).
- Panneau bas ancré : un champ **« Ton prénom »** et un bouton **Rejoindre**. Rien d'autre. Pas de mot de passe, pas d'email, pas de CGU bloquantes.
- Mention discrète : *« Pas de compte à créer. »*
- Lien texte : *« Tu as déjà participé depuis un autre téléphone ? »* → liste des participants existants à revendiquer.
- **Aucun** consentement cookie : pas de traceur, donc rien à demander.

**États** : chargement (squelette du sondage) · lien invalide (É8) · sondage archivé (message + lecture seule) · sondage complet (50 participants).

---

### É4 — Hub du sondage `/t/:slug`

**But** : orienter en un coup d'œil.

**Entête** : emoji + titre, ligne de participants (avatars empilés, +N), bouton **Partager** toujours accessible.

**Bandeau de progression** : *« Tu as répondu à 2 catégories sur 4 »* + barre. Si tout est fait : *« Tu es à jour 🎉 — il manque encore Julien et Sarah. »*

**Liste des catégories** — une carte par catégorie :
- icône + libellé + nombre de propositions ;
- pastille d'état : `À voter` (accentuée) / `Voté` (discrète) / `Clôturée` (avec la décision affichée en toutes lettres) ;
- barre de participation : *« 5/8 ont répondu »* ;
- aperçu du meneur si les résultats sont visibles.

**Action principale flottante** : **Continuer à voter** → première catégorie non votée. Devient **Voir le récap** quand tout est voté.

**Vue organisateur** — en plus : accès aux réglages, bouton **Relancer** (message pré-rempli nommant les manquants), et un rappel tant qu'aucune proposition n'existe.

---

### É5 — Vote d'une catégorie `/t/:slug/c/:categoryId`

**Structure commune** : entête (retour, libellé, description, état) · corps selon le mode · barre de navigation basse persistante (`← Précédent` · `3/5` · `Suivant →`).

#### 5.a Mode approbation / choix unique / multiple

Liste de cartes **OptionCard** :
```
┌────────────────────────────────────────┐
│ 🌍  Lisbonne                        ⋯  │
│ Vols directs, 3h, plage à 20 min       │
│ 🔗 lien · proposé par Marie            │
│                                        │
│ [  ✕ Non  ] [ ~ Peut-être ] [ ✓ Oui  ] │
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░  5 oui · 2 ~ · 1 non   │
│ 💬 3 commentaires                      │
└────────────────────────────────────────┘
```
- Le bouton sélectionné est plein et coloré ; les autres sont en contour. Retap = annulation du vote.
- Retour haptique sur mobile (`navigator.vibrate(10)`), animation de 150 ms.
- La barre de résultats n'apparaît **qu'après** le vote du participant en mode aveugle ; sinon un bandeau explique *« Vote à l'aveugle : les résultats apparaîtront après ton vote. »*
- Une proposition avec au moins un « non » porte un liseré et la mention *« Ne convient pas à 1 personne »*.
- Les propositions sont triées par score décroissant **hors mode aveugle**, sinon par ordre d'ajout. Le tri ne se réordonne jamais sous le doigt : il est figé pendant la session de vote, avec un bouton *« Reclasser »*.

**Ajout de proposition** : champ inline en bas de liste (titre + URL facultative), visible si autorisé et catégorie ouverte.

#### 5.b Mode disponibilité (dates)

- **Grille calendaire** sur la fenêtre définie, mois par mois, 7 colonnes.
- Trois pinceaux en haut : `Dispo` / `Peut-être` / `Pas dispo`. On sélectionne un pinceau, puis on peint les jours (tap ou glissement).
- Fond de grille : densité de disponibilité du groupe (dégradé), visible hors mode aveugle.
- Sous la grille, **classement des créneaux** : top 5 des fenêtres de N nuits, avec score, dates formatées (« sam. 11 → sam. 18 juillet ») et *« Julien n'est pas dispo »*.
- Accessibilité : la grille est navigable au clavier (flèches + espace) et chaque jour porte un `aria-label` complet.
- Actions rapides : *« Tout dispo »*, *« Effacer »*.

#### 5.c Mode montant (budget)

- Question claire, avec la précision de périmètre de l'organisateur (« par personne, hors transport »).
- Un champ numérique unique, grand, clavier numérique sur mobile, suffixe `€`.
- Sous le champ, **promesse de confidentialité affichée** : *« Personne ne verra ton montant, pas même l'organisateur. Seul un résumé du groupe est affiché. »*
- Après réponse, résumé du groupe (si ≥ 3 répondants) : **curseur d'accessibilité** — on déplace un montant, l'app affiche *« À 750 €, 7 personnes sur 8 suivent »*, sans jamais nommer qui.
- En dessous de 3 répondants : *« Le résumé s'affichera à partir de 3 réponses. »*

---

### É6 — Récapitulatif `/t/:slug/results`

**But** : la page qu'on renvoie dans le groupe pour clore le débat.

- Bandeau de synthèse : **🌍 Lisbonne · 📅 11–18 juillet · 💶 ~750 € · 🏠 Airbnb Alfama**.
- Un bloc par catégorie : décision mise en avant, classement complet replié en dessous, votants affichés.
- Catégories encore ouvertes : signalées comme en cours, avec le meneur du moment.
- Actions : **Partager le récap**, **Ajouter les dates à mon agenda** (.ics, P2), **Revenir au sondage**.
- Si toutes les catégories sont clôturées, cette page devient l'écran d'accueil du lien.

---

### É7 — Réglages `/t/:slug/settings` (organisateur)

- Titre, emoji, description.
- Réordonnancement, ajout, suppression des catégories (avec confirmation si des votes existent).
- Bascules : mode aveugle, propositions par les participants.
- **Participants** : liste, renommage, suppression, fusion de doublons, transfert du rôle d'organisateur (P2).
- **Zone sensible** : clôturer le sondage, régénérer le lien (invalide l'ancien), supprimer définitivement (double confirmation par saisie du titre).

---

### É8 — États d'exception

| État | Traitement |
|---|---|
| Lien invalide / sondage supprimé | Page dédiée, ton léger, bouton *« Créer ton propre sondage »*. **Aucune** information révélée sur l'existence d'autres sondages. |
| Sondage archivé | Lecture seule + explication de la purge automatique. |
| Hors ligne / Supabase injoignable | Bandeau persistant *« Connexion perdue — tes derniers votes ne sont peut-être pas enregistrés »* + bouton Réessayer. Jamais d'écran blanc. |
| Chargement | Squelettes reprenant la forme réelle du contenu, jamais de spinner plein écran au-delà de 300 ms. |
| Erreur inattendue | `ErrorBoundary` par route : message compréhensible, bouton Recharger, envoi Sentry. |

## 5.4 Responsive

| Palier | Adaptation |
|---|---|
| < 640 px (référence) | colonne unique, navigation basse ancrée, modales en feuilles glissantes |
| 640 – 1024 px | cartes en 2 colonnes sur le hub, grille de dates plus large |
| > 1024 px | contenu centré, largeur max 960 px ; sur le vote, colonne latérale figée avec la liste des catégories et la participation |

## 5.5 Accessibilité — points de contrôle

- Contraste ≥ 4,5:1 sur tout texte, ≥ 3:1 sur les bordures porteuses de sens.
- Les boutons de vote sont un `role="radiogroup"` avec `aria-checked`, navigable au clavier.
- Le vote enregistré est annoncé via une région `aria-live="polite"` (*« Vote enregistré : Oui pour Lisbonne »*).
- Focus visible partout, jamais supprimé.
- La grille de dispos a un équivalent en liste pour les lecteurs d'écran.
- Cible de vérification : audit axe-core en CI, zéro violation bloquante.

## 5.6 Contenu rédactionnel

- Tutoiement systématique, ton direct et bref.
- Aucun jargon : « sondage », « proposition », « vote » — jamais « instance », « entité », « soumission ».
- Les messages d'erreur disent quoi faire, pas ce qui a planté : *« Impossible d'enregistrer ton vote. Vérifie ta connexion et réessaie. »*
- Les états vides invitent : *« Aucune destination proposée pour l'instant. Lance-toi ! »*
- Toutes les chaînes vivent dans `src/lib/labels.ts`.
