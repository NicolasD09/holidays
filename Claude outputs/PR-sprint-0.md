# Sprint 0 — Socle

Passe du template Vite à un projet sous contrôle, stylé, testé et livrable en continu. Aucune fonctionnalité produit : c'est le terrain sur lequel le sprint 1 posera la base de données.

## Les 3 fichiers à relire en priorité

1. **`src/index.css`** — les jetons de couleur du produit, en clair et en sombre. C'est la décision la plus durable de ce sprint : tout le reste s'y branche.
2. **`src/lib/labels.ts`** — toutes les chaînes visibles. C'est là que se lit le ton du produit d'un coup d'œil, et c'est le seul endroit où le modifier.
3. **`src/app/router.tsx`** — les 8 routes du doc 04 §4.4, dont celles qui n'ont encore qu'un écran « Bientôt ».

## Ce qui a été fait

**Nettoyage** — le compteur, les logos et `App.css` du template disparaissent. `index.html` passe en `lang="fr"`, avec titre, description et `robots: noindex, nofollow` (RM-11 : les liens de sondage sont secrets, rien de cette application n'a à être indexé).

**Thème** — Tailwind 4 via `@tailwindcss/vite`. Les jetons du doc 05 §5.2 (`--brand`, `--yes`, `--maybe`, `--no`, `--surface`, `--text`, `--border`) sont définis en oklch, avec bascule automatique sur `prefers-color-scheme` et une classe `.dark`/`.light` en réserve pour un futur sélecteur. `prefers-reduced-motion` neutralise toutes les animations.

**Composants** — `Button` (5 variantes, hauteur 44 px minimum), `Card`, `Input`, plus `PageShell`, `StateBlock` (états vide / erreur / chargement) et `SoonState`. Conventions shadcn, écrits à la main plutôt qu'importés par la CLI : moins de magie, zéro dépendance de génération.

**Routage** — React Router, `RootLayout` avec lien d'évitement, `TripLayout` (coquille prête à porter la garde de participation au sprint 2), et une page « lien invalide » soignée qui ne révèle jamais l'existence d'autres sondages.

**Socle de données** — `QueryClient` configuré (requêtes : 1 nouvelle tentative ; mutations : aucune, un vote qui échoue revient à son état précédent), `Toaster` monté, `queryKeys.ts` et `routes.ts` centralisés.

**Qualité** — `strict: true` et `noUncheckedIndexedAccess` activés (le template ne les avait pas). Lint à zéro avertissement toléré. 8 tests. CI GitHub Actions : lint → types → tests → build → budget de performance.

## Recette

```bash
npm install
npm run dev      # http://localhost:5173
```

1. L'accueil affiche le titre, le sous-titre, le bouton **Créer un sondage** et les 3 arguments.
2. Bascule ton système en thème sombre : les couleurs suivent sans rechargement.
3. Ouvre `/t/nimportequoi/bidule` → page « Ce lien ne mène nulle part », pas d'écran blanc.
4. Ouvre `/new` → écran « Bientôt » explicite, avec retour vers l'accueil.
5. Depuis l'accueil, appuie deux fois sur `Tab` : le lien d'évitement apparaît, puis le bouton principal. Le focus est visible.
6. `npm run lint && npm run typecheck && npm run test && npm run build` → tout vert.
7. Sur GitHub, la CI de la PR est verte.

## Vérifié de mon côté

| Contrôle | Résultat |
|---|---|
| `oxlint --max-warnings 0` | ✅ 0 avertissement |
| `tsc -b --noEmit` | ✅ |
| `vitest run` | ✅ 8 tests, 2 fichiers |
| `vite build` | ✅ |
| Budget de performance | ✅ **106,6 Ko gzip** sur 200 autorisés |
| Rendu réel (Chromium, 390 px et 1200 px, clair et sombre) | ✅ aucune erreur console |
| Contrastes WCAG AA, 22 paires mesurées | ✅ toutes au-dessus du seuil |

Les contrastes les plus serrés : texte secondaire sur carte **5,41:1** en clair, bordure de contrôle sur carte **4,19:1** (seuil 3:1).

## Décidé sans toi

| Décision | Pourquoi | Pour annuler |
|---|---|---|
| **React Router 8** au lieu de 7 (doc 04) | la 8 est la version courante ; API déclarative identique, aucun impact sur les specs | `npm i react-router@7` |
| **`noindex` global** plutôt que sur les seules pages de sondage | une SPA sert le même `index.html` partout ; c'est le réglage sûr tant qu'il n'y a pas de rendu serveur. À revoir au sprint 9 si tu veux que la page d'accueil soit trouvable | retirer la balise `robots` de `index.html` |
| **Jeton `--border-strong`** ajouté au design system | la bordure des cartes du doc 05 est décorative et ne passe pas 3:1 ; les champs et boutons contour ont besoin d'une bordure qui, elle, porte du sens et doit passer le seuil | supprimer le jeton et réutiliser `--border` — au prix de la conformité AA |
| **Composants shadcn écrits à la main** | la CLI `shadcn` a besoin d'un `init` interactif et réécrit les configs ; l'API et les conventions sont respectées à l'identique | `npx shadcn@latest init` puis réimporter |
| **`scripts/check-contrast.mjs` hors CI** | il lui faut un navigateur et un serveur de prévisualisation ; l'automatisation arrive au sprint 9 avec axe-core | — |

## Dette assumée

- **Aucun découpage par route.** Un seul chunk de 106 Ko gzip : très en dessous du budget, le `React.lazy` serait prématuré. À faire quand une route lourde arrive (la grille de dispos du sprint 5, probablement).
- **Playwright non installé.** Le sprint 2 l'ajoute avec le premier vrai parcours à tester ; l'installer maintenant n'aurait rien à exécuter.
- **`TripLayout` ne fait que rendre ses enfants.** La garde de participation arrive au sprint 2, elle n'a pas de base de données à interroger avant.
- **6 écrans sur 8 sont des « Bientôt ».** C'est voulu : mieux vaut une route qui annonce son absence qu'une page blanche.

## Ce qui n'est pas dans cette PR

Aucune dépendance Supabase, aucun accès réseau, aucune donnée. Le sprint 1 les apporte, et il est bloqué tant que le projet `holidays-dev` n'existe pas.
