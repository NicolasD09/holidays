# 06 — Backlog & lots

## 6.1 Stratégie de livraison

Un développeur, en temps libre. Le découpage suit une règle unique : **chaque lot est déployable et utilisable**. Le lot 1 doit déjà permettre de décider d'une destination à plusieurs — tout le reste est de l'amélioration.

Estimations en points ; 1 point ≈ une demi-soirée de travail concentré.

| Lot | Objectif | Points | Livrable |
|---|---|---|---|
| 0 | Fondations | 13 | l'app se lance, se déploie, parle à Supabase |
| 1 | Décider d'une destination | 21 | **utilisable pour de vrai** |
| 2 | Multi-catégories | 13 | logement, activités, catégories libres |
| 3 | Dates | 21 | grille de dispos + classement des créneaux |
| 4 | Budget | 8 | montants confidentiels + résumé |
| 5 | Clôture & récap | 13 | décisions figées, page de synthèse |
| 6 | Vie de groupe | 13 | temps réel, commentaires, relances |
| 7 | Finition | 11 | a11y, perf, PWA, mode aveugle abouti |

**Total v1 ≈ 113 points.**

---

## 6.2 Lot 0 — Fondations (13 pts)

| # | Tâche | Pts |
|---|---|---|
| 0.1 | Nettoyer le template Vite (supprimer le compteur, les assets de démo, réécrire le README) | 1 |
| 0.2 | Installer et configurer Tailwind 4 + shadcn/ui (thème, variables de couleur, mode sombre) | 3 |
| 0.3 | Créer les projets Supabase dev & prod ; `.env.local` ; client dans `lib/supabase.ts` | 2 |
| 0.4 | Activer l'auth anonyme ; `lib/auth.ts` (session persistée, création paresseuse) | 2 |
| 0.5 | React Router + squelette des routes + `ErrorBoundary` + `QueryClientProvider` | 2 |
| 0.6 | CI GitHub Actions (lint, tsc, test, build) + déploiement automatique | 2 |
| 0.7 | Structure `features/`, `lib/labels.ts`, `lib/queryKeys.ts` | 1 |

**DoD** : `main` déployé sur une URL publique affichant une page d'accueil, CI verte, session anonyme créée et persistée.

---

## 6.3 Lot 1 — Décider d'une destination (21 pts)

Le lot qui rend l'app réelle. Tout est bout-en-bout, sur une seule catégorie.

| # | Tâche | Pts |
|---|---|---|
| 1.1 | Migration : `trips`, `participants`, `categories`, `options`, `votes` + index | 3 |
| 1.2 | Migration : helpers RLS + policies sur ces 5 tables | 3 |
| 1.3 | RPC `app_create_trip`, `app_trip_preview`, `app_join_trip` | 3 |
| 1.4 | RPC `app_cast_vote` (+ déclencheur choix unique) | 2 |
| 1.5 | Génération des types TS + `types/domain.ts` | 1 |
| 1.6 | Écran É2 — création (titre, emoji, catégorie Destination seule, prénom) | 3 |
| 1.7 | Modale de partage : copie, `navigator.share`, message pré-rempli | 1 |
| 1.8 | Écran É3 — `JoinGate` avec aperçu + adhésion par prénom | 3 |
| 1.9 | Écran É5a — vote approbation avec `OptionCard` et mutation optimiste | 3 |
| 1.10 | Ajout de proposition inline | 1 |
| 1.11 | Tests RLS : isolation entre deux sondages | 2 |
| 1.12 | E2E Playwright : Marie crée → Thomas rejoint et vote → Marie voit le résultat | 2 |

**DoD** : un vrai groupe peut choisir une destination du début à la fin sur mobile. Les 4 tests de sécurité de la doc 04 §4.7 passent.

**⚑ Jalon : utiliser l'app pour de vrai avec le groupe de potes avant d'écrire le lot 2.** Le retour terrain prime sur le backlog.

---

## 6.4 Lot 2 — Multi-catégories (13 pts)

| # | Tâche | Pts |
|---|---|---|
| 2.1 | Sélecteur de catégories à la création (Destination, Logement, Activités, Autre) | 2 |
| 2.2 | Écran É4 — hub avec la liste des catégories, états et progression | 3 |
| 2.3 | Navigation inter-catégories (barre basse, « Continuer à voter ») | 2 |
| 2.4 | Modes `single` et `multiple` (+ `max_choices`) | 3 |
| 2.5 | Réglages de catégorie côté organisateur (libellé, propositions autorisées, ordre) | 2 |
| 2.6 | Écran `/mine` — sondages visités depuis cet appareil | 1 |

---

## 6.5 Lot 3 — Dates (21 pts)

Le lot le plus dense : composant sur mesure + algorithme.

| # | Tâche | Pts |
|---|---|---|
| 3.1 | Migration `availabilities` + policies + RPC `app_set_availability` | 3 |
| 3.2 | Configuration de la catégorie dates (fenêtre, nombre de nuits) à la création | 2 |
| 3.3 | Composant `AvailabilityGrid` : pinceaux, peinture par glissement, densité du groupe | 5 |
| 3.4 | Accessibilité clavier + équivalent liste de la grille | 3 |
| 3.5 | `lib/scoring.ts` — fenêtres glissantes et scores (**tests unitaires 100 %**) | 3 |
| 3.6 | `WindowRanking` : top 5 des créneaux avec les absents | 3 |
| 3.7 | E2E : trois participants aux dispos croisées → créneau attendu en tête | 2 |

---

## 6.6 Lot 4 — Budget (8 pts)

| # | Tâche | Pts |
|---|---|---|
| 4.1 | Migration `budget_answers` + policies **strictement personnelles** + RPC `app_budget_summary` | 2 |
| 4.2 | `BudgetInput` avec promesse de confidentialité affichée | 2 |
| 4.3 | `AffordabilitySlider` (« à X €, N personnes suivent ») | 3 |
| 4.4 | Test de sécurité : impossible de lire le montant d'autrui, y compris en tant qu'organisateur | 1 |

---

## 6.7 Lot 5 — Clôture & récap (13 pts)

| # | Tâche | Pts |
|---|---|---|
| 5.1 | Migration `decisions` + RPC `app_close_category` / `app_reopen_category` | 3 |
| 5.2 | `CloseCategoryDialog` : proposition en tête pré-sélectionnée, choix libre, avertissement sur les non-votants | 3 |
| 5.3 | Passage automatique du sondage en `closed` | 1 |
| 5.4 | Écran É6 — récapitulatif partageable | 4 |
| 5.5 | Écran É7 — réglages, dont la zone sensible | 2 |

---

## 6.8 Lot 6 — Vie de groupe (13 pts)

| # | Tâche | Pts |
|---|---|---|
| 6.1 | Publication realtime + `lib/realtime.ts` (invalidations ciblées) | 3 |
| 6.2 | Suivi de participation : qui a voté, qui manque | 2 |
| 6.3 | Bouton **Relancer** : message pré-rempli nommant les manquants | 2 |
| 6.4 | Commentaires par proposition | 3 |
| 6.5 | Avatars : emoji + couleur, choisis ou attribués | 2 |
| 6.6 | Administration des participants (renommer, supprimer, fusionner) | 1 |

---

## 6.9 Lot 7 — Finition (11 pts)

| # | Tâche | Pts |
|---|---|---|
| 7.1 | Mode aveugle bout-en-bout, vérifié au niveau API | 3 |
| 7.2 | Audit a11y axe-core + corrections | 3 |
| 7.3 | Budget de performance en CI + découpage par route | 2 |
| 7.4 | PWA : manifeste, icônes, installable | 2 |
| 7.5 | Sentry + purge pg_cron + page « lien invalide » soignée | 1 |

---

## 6.10 Definition of Done (tout ticket)

- [ ] TypeScript strict, aucun `any`, `tsc --noEmit` vert
- [ ] `oxlint` et `oxfmt` verts
- [ ] Testé sur Safari iOS **réel**, pas seulement en émulation
- [ ] Aucune chaîne visible codée en dur hors de `lib/labels.ts`
- [ ] Accès Supabase confiné à `features/*/api/`
- [ ] Toute nouvelle table est couverte par une policy RLS et un test d'isolation
- [ ] États de chargement, d'erreur et vide traités
- [ ] Navigation clavier fonctionnelle sur les nouveaux composants
- [ ] Migration jouée sur dev, types régénérés et commités

## 6.11 Après la v1

Par valeur décroissante estimée :
1. Vote par classement (Borda) pour la destination, sur les gros groupes.
2. Notifications (Web Push) pour les relances — supprime la dépendance à WhatsApp.
3. Aperçu enrichi des liens collés (Airbnb, Booking) via un scraper en Edge Function.
4. Export `.ics` et `.pdf` du récap.
5. Groupe persistant : rejouer un sondage avec les mêmes potes.
6. Budget par poste (transport / logement / sur place).
7. Anglais.
