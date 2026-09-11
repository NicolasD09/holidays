# 04 — Architecture technique

## 4.1 Vue d'ensemble

```
┌──────────────────────────┐        ┌────────────────────────────────┐
│  SPA React (statique)    │        │  Supabase                      │
│  Vite · React 19 · TS    │◄──────►│  Postgres + RLS + RPC          │
│  TanStack Query          │  HTTPS │  Auth (anonyme)                │
│  React Router            │   WS   │  Realtime (postgres_changes)   │
│  Tailwind + shadcn/ui    │        │  Storage (images v2)           │
└──────────────────────────┘        └────────────────────────────────┘
        │                                        ▲
        └── hébergé sur Netlify / Vercel /        │ pg_cron (purge)
            Cloudflare Pages (100 % statique)     │
```

Aucun serveur applicatif. Le client parle directement à Postgres via PostgREST, la sécurité étant intégralement portée par la RLS et les RPC (doc 03).

## 4.2 Stack

| Besoin | Choix | Justification |
|---|---|---|
| Build | **Vite 8** | déjà en place, démarrage instantané |
| UI | **React 19 + TypeScript** | déjà en place ; `useOptimistic` et Actions servent directement le vote optimiste |
| Routage | **React Router 7** (mode déclaratif) | 5 routes, aucun besoin de SSR ni de loaders avancés |
| Données serveur | **TanStack Query 5** | cache, invalidation, mutations optimistes, retry — le cœur du besoin |
| Backend client | **@supabase/supabase-js 2** | auth anonyme, PostgREST, Realtime |
| Styles | **Tailwind CSS 4** | vitesse d'itération, cohérence, purge automatique |
| Composants | **shadcn/ui** | copiés dans le repo, sans dépendance runtime ; a11y via Radix. Le projet a déjà la config JetBrains associée |
| Formulaires | **react-hook-form + zod** | validation partagée front / typage |
| Dates | **date-fns** (+ `date-fns/locale/fr`) | tree-shakable, léger, suffisant pour la grille de dispos |
| Tests unitaires | **Vitest + Testing Library** | intégré à Vite |
| Tests E2E | **Playwright** | parcours multi-participants (2 contextes navigateur = 2 potes) |
| Lint / format | **oxlint + oxfmt** | déjà en place, rapides |
| Erreurs | **Sentry** (`@sentry/react`) | sans PII, échantillonné |

**Dépendances refusées** : aucune librairie de state global (Redux/Zustand) — TanStack Query couvre l'état serveur, `useState`/`useContext` le reste. Aucune librairie de graphiques : les barres de résultats sont du CSS.

## 4.3 Arborescence cible

```
src/
  main.tsx
  app/
    router.tsx                 # définition des routes
    providers.tsx              # QueryClient, Supabase, Toaster, ErrorBoundary
    layouts/
      TripLayout.tsx           # entête sondage + garde de participation
  features/
    trip/
      api/                     # createTrip, getTrip, tripPreview, updateTrip
      components/              # TripHeader, ShareLinkCard, CategoryList
      hooks/                   # useTrip, useCreateTrip
      pages/                   # HomePage, CreateTripPage, TripHubPage
    participant/
      api/                     # joinTrip, claimParticipant, updateParticipant
      components/              # JoinGate, ParticipantAvatar, ParticipantList
      hooks/                   # useCurrentParticipant, useJoinTrip
    voting/
      api/                     # castVote, listOptions, categoryResults
      components/              # OptionCard, ApprovalButtons, ResultBar, VoteProgress
      hooks/                   # useVote (mutation optimiste), useCategoryResults
      pages/                   # CategoryPage
    dates/
      components/              # AvailabilityGrid, WindowRanking
      hooks/                   # useAvailability
    budget/
      components/              # BudgetInput, BudgetSummary, AffordabilitySlider
    comments/
    results/
      pages/                   # ResultsPage
    admin/
      components/              # CloseCategoryDialog, ParticipantAdmin, TripSettings
  components/
    ui/                        # shadcn (button, card, dialog, input, …)
    common/                    # EmptyState, ErrorState, LoadingState, PageTitle
  lib/
    supabase.ts                # client unique
    auth.ts                    # signInAnonymously + persistance de session
    queryKeys.ts               # fabrique centralisée de clés de cache
    realtime.ts                # abonnement par sondage → invalidations
    scoring.ts                 # calculs partagés (fenêtres de dates, agrégats)
    format.ts                  # dates, montants, pluriels
    labels.ts                  # TOUTES les chaînes FR (préparation i18n)
  types/
    database.ts                # généré par supabase gen types — ne pas éditer
    domain.ts                  # types métier dérivés, plus parlants
  hooks/                       # hooks transverses (useClipboard, useMediaQuery)
supabase/
  migrations/
  seed.sql                     # jeu de données de démo pour le dev
e2e/                           # specs Playwright
docs/                          # ces spécifications
```

**Règle d'organisation** : une *feature* possède ses `api/`, `components/`, `hooks/`, `pages/`. Une feature n'importe jamais depuis `features/*/components` d'une autre feature ; ce qui est partagé remonte dans `components/common` ou `lib/`.

## 4.4 Routes

| Chemin | Écran | Accès |
|---|---|---|
| `/` | Accueil + création | public |
| `/new` | Assistant de création | public (auth anonyme créée à la validation) |
| `/t/:slug` | Hub du sondage | participant ; sinon écran d'adhésion |
| `/t/:slug/c/:categoryId` | Vote d'une catégorie | participant |
| `/t/:slug/results` | Récapitulatif | participant |
| `/t/:slug/settings` | Réglages | organisateur |
| `/mine` | Mes sondages (stockés localement) | public |
| `*` | 404 / lien invalide | public |

`TripLayout` porte la garde : si `app_current_participant` est vide pour ce slug, il affiche `JoinGate` par-dessus un aperçu obtenu via `app_trip_preview` — sans jamais rediriger, pour que le lien partagé reste stable.

## 4.5 Gestion de l'état

**Trois niveaux, sans recouvrement :**

1. **État serveur → TanStack Query.** Toute donnée issue de Supabase. Clés centralisées :
   ```ts
   export const qk = {
     trip:        (slug: string)      => ['trip', slug] as const,
     categories:  (tripId: string)    => ['trip', tripId, 'categories'] as const,
     options:     (categoryId: string)=> ['category', categoryId, 'options'] as const,
     results:     (categoryId: string)=> ['category', categoryId, 'results'] as const,
     myVotes:     (categoryId: string)=> ['category', categoryId, 'my-votes'] as const,
     participants:(tripId: string)    => ['trip', tripId, 'participants'] as const,
   }
   ```
2. **État de session → `localStorage`,** encapsulé dans `lib/auth.ts` : session Supabase (gérée par le SDK) + liste des sondages visités (`{slug, title, emoji, role, lastSeen}`) pour l'écran `/mine`.
3. **État d'interface → local au composant.** Aucun store global.

**Vote optimiste** — patron imposé pour toute mutation de vote :

```ts
const { mutate: vote } = useMutation({
  mutationFn: ({ optionId, value }: VoteInput) => castVote(optionId, value),
  onMutate: async ({ optionId, value }) => {
    await queryClient.cancelQueries({ queryKey: qk.myVotes(categoryId) })
    const previous = queryClient.getQueryData(qk.myVotes(categoryId))
    queryClient.setQueryData(qk.myVotes(categoryId), patchVote(optionId, value))
    return { previous }
  },
  onError: (_e, _v, ctx) => {
    queryClient.setQueryData(qk.myVotes(categoryId), ctx?.previous)
    toast.error(labels.voteFailed, { action: { label: 'Réessayer', onClick: () => vote(_v) } })
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: qk.results(categoryId) })
  },
})
```

**Realtime** — un seul canal par sondage, monté dans `TripLayout` :

```ts
supabase.channel(`trip:${tripId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'votes',
      filter: `trip_id=eq.${tripId}` }, (p) => invalidateFor(p))
  .on('postgres_changes', { …, table: 'options', … }, invalidateFor)
  .on('postgres_changes', { …, table: 'participants', … }, invalidateFor)
  .on('postgres_changes', { …, table: 'decisions', … }, invalidateFor)
  .subscribe()
```

Les événements **invalident** les requêtes ; ils ne patchent pas le cache. La source de vérité reste la base, les scores restent cohérents, et le mode aveugle est respecté sans code spécifique.

## 4.6 Conventions de code

- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess: true`). Aucun `any` : les types de base viennent de `database.ts`.
- **Composants** : fonction nommée + export nommé. Un composant par fichier, PascalCase. Pas de `export default` sauf pages routées.
- **Nommage** : hooks `useXxx`, fonctions d'API à l'infinitif (`castVote`, `joinTrip`), booléens `is`/`has`/`can`.
- **Domaine en anglais dans le code** (`trip`, `option`, `vote`), **interface en français** — toutes les chaînes visibles passent par `lib/labels.ts`, jamais en dur dans le JSX.
- **Accès Supabase uniquement dans `features/*/api/`.** Aucun composant n'importe `supabase` directement.
- **Erreurs** : les codes d'erreur Postgres levés par les RPC (`trip_not_found`, `blind_mode_active`, `insufficient_respondents`…) sont traduits en messages utilisateur dans une table unique `lib/errors.ts`.
- **Pas de commentaire décoratif.** On commente le *pourquoi* d'un arbitrage, jamais le *quoi*.

## 4.7 Qualité & tests

| Niveau | Cible | Outil |
|---|---|---|
| Unitaire | `lib/scoring.ts` (fenêtres de dates, scores d'approbation, agrégats budget) — **couverture 100 %**, c'est le cœur métier | Vitest |
| Composant | `OptionCard`, `AvailabilityGrid`, `JoinGate` : rendu, états, accessibilité clavier | Vitest + Testing Library |
| Intégration base | Policies RLS : un participant du sondage A ne lit rien du sondage B ; mode aveugle ; confidentialité budget | pgTAP ou script Vitest sur base locale |
| E2E | 4 parcours : création+partage, adhésion+vote, deux participants en simultané (realtime), clôture+récap | Playwright, 2 contextes navigateur |

**Tests de sécurité obligatoires avant toute mise en ligne** (non négociables) :
1. Un JWT anonyme sans adhésion ne lit **aucune** ligne d'un sondage, même en connaissant son UUID.
2. `budget_answers` d'un autre participant est illisible, y compris pour l'organisateur.
3. En mode aveugle, les votes d'autrui sont invisibles tant qu'on n'a pas voté — vérifié via l'API brute, pas via l'UI.
4. Un participant non-organisateur ne peut ni clôturer une catégorie ni modifier le sondage.

## 4.8 Intégration continue

`.github/workflows/ci.yml`, à chaque push et PR :
```
install → oxlint → tsc --noEmit → vitest run → vite build → playwright test
```
Le déploiement est automatique depuis `main` (Netlify/Vercel), avec un déploiement de prévisualisation par PR. Les migrations Supabase sont appliquées manuellement (`supabase db push`) avant le déploiement du front qui en dépend.

## 4.9 Configuration & environnements

```
.env.local        VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```
Deux projets Supabase : `holidays-dev` et `holidays-prod`. La clé `anon` est publique par nature — la sécurité repose exclusivement sur la RLS. **La clé `service_role` n'apparaît nulle part dans le front**, sous aucun prétexte.

## 4.10 Performance

- Découpage de bundle par route (`React.lazy` sur `CategoryPage`, `ResultsPage`, `settings`).
- `date-fns` importé fonction par fonction.
- Aucune police web bloquante : pile système, ou une police variable en `font-display: swap`.
- Emoji plutôt qu'images pour les couvertures en v1 : zéro octet transféré.
- Budget de performance vérifié en CI : échec du build si le JS initial dépasse 200 Ko gzip.
