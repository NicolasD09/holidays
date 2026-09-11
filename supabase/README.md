# Base de données

Tout ce qui protège les données du produit est ici, pas dans le front (doc 03 §3.1).

## Contenu

| Fichier | Rôle |
|---|---|
| `config.toml` | configuration CLI ; c'est là qu'est déclarée l'auth anonyme |
| `migrations/20260101000000_init_types_and_tables.sql` | types et 5 tables du socle |
| `migrations/20260101000100_rls_helpers_and_policies.sql` | fonctions d'accès + policies RLS |
| `migrations/20260101000200_rpc_trip_lifecycle.sql` | `app_create_trip`, `app_trip_preview`, `app_join_trip` |
| `migrations/20260101000300_rpc_voting.sql` | `app_cast_vote`, `app_retract_vote`, déclencheurs |
| `migrations/20260101000400_views_and_results.sql` | vue `option_scores`, `app_category_results` |
| `migrations/20260101000500_fix_slug_generation.sql` | correctif : `gen_random_bytes` invisible sur Supabase |
| `seed.sql` | sondage de démonstration (`/t/demo-vacances-2027`) |
| `tests/security.test.ts` | tests de sécurité contre le vrai projet Supabase |
| `tests/local/` | mêmes contrôles, hors ligne, sur un Postgres jetable |

## Appliquer sur `holidays-dev`

```bash
npx supabase login
npm run db:link          # choisir holidays-dev
npm run db:push          # applique les migrations manquantes
npm run db:types         # régénère src/types/database.ts
```

> Sur PowerShell, `npm run db:types` écrit un fichier en UTF-16 à cause de la
> redirection `>`. Préférer :
> `npx supabase gen types typescript --linked | Out-File -Encoding utf8 src/types/database.ts`

Le seed n'est pas joué par `db push`. Pour le charger sur dev, coller le contenu
de `seed.sql` dans le `SQL editor` du dashboard.

## Vérifier la sécurité

Deux niveaux, volontairement :

```bash
bash supabase/tests/local/run.sh   # hors ligne, sur un Postgres jetable
npm run test:security           # contre holidays-dev, à travers PostgREST
```

Le premier rejoue les migrations dans une base neuve, reconstitue le minimum du
socle Supabase (`auth.uid()`, les rôles `anon` / `authenticated`) et attaque les
policies depuis le rôle d'un navigateur. Il ne demande ni Docker, ni réseau, ni
secret — c'est donc lui qui tourne en CI sur chaque PR, et c'est lui qu'il faut
lancer avant de pousser une migration. Il a besoin d'un `psql` et d'un serveur
Postgres local (variables `PGHOST` / `PGPORT` / `PGUSER` habituelles).

Le second est la contre-épreuve en conditions réelles : vraie auth anonyme, vrai
PostgREST, vraies clés. Il exige que **Anonymous sign-ins** soit activé sur le
projet, et se déclare « ignoré » si `.env.local` est absent.

## Le piège des schémas d'extension

Supabase installe ses extensions dans le schéma **`extensions`**, pas dans
`public`. Toute fonction du projet ayant un `search_path` figé à `public` — et
elles le sont toutes, c'est la protection qui empêche un appelant de détourner
la résolution des noms — ne voit donc **aucune** fonction de `pgcrypto`.

C'est ce qui a cassé `app_slug_candidate` au sprint 1 (`gen_random_bytes` does
not exist), en production seulement : le harnais local installait alors
pgcrypto dans `public` et ne reproduisait pas le problème. Il le reproduit
désormais.

**Règle** : n'utiliser dans ces fonctions que ce qui est dans le cœur de
Postgres (`gen_random_uuid`, `decode`, `get_byte`…). Si une extension est
vraiment nécessaire, la qualifier explicitement (`extensions.digest(...)`)
plutôt que d'élargir le `search_path`.

## Règles

- **Une migration appliquée n'est jamais modifiée.** Une correction est une
  nouvelle migration (doc 08 §8.5).
- Les types TypeScript sont régénérés et commités **dans la même PR** que la
  migration qui les change.
- Aucune migration n'est jouée sur `holidays-prod` par l'agent : la commande est
  fournie, tu l'exécutes.
- Toute nouvelle table arrive avec sa policy RLS **et** son test d'isolation.

## Ce qui n'est pas encore là

Les tables `availabilities` (sprint 4), `budget_answers` (sprint 6), `decisions`
(sprint 7) et `comments` (sprint 8) sont spécifiées au doc 03 mais pas créées :
une table sans écran est une table dont personne ne vérifie la RLS.

Conséquence directe : le test de sécurité n° 2 du doc 04 §4.7 (« le montant
budget d'autrui est illisible, y compris pour l'organisateur ») ne peut pas
exister avant le sprint 6. Il y est attendu au même titre que la migration.
