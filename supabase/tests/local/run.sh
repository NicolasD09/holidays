#!/usr/bin/env bash
# Joue les migrations et les contrôles RLS dans un Postgres local jetable.
#
# Ne remplace pas `npm run test:security`, qui attaque le vrai projet Supabase à
# travers PostgREST. Celui-ci sert à vérifier les policies **hors ligne** : pas
# de Docker, pas de réseau, pas de secret. C'est l'outil avec lequel valider une
# migration avant de la pousser.
#
# Prérequis : un serveur Postgres 15+ joignable et un rôle superutilisateur.
#   PGHOST / PGPORT / PGUSER classiques, ou :
#     PGDATABASE=holidays_rls ./supabase/tests/local/run.sh
#
# Sortie non nulle si un contrôle échoue.

set -euo pipefail

DB="${PGDATABASE:-holidays_rls_check}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"

unset PGDATABASE

echo "→ base jetable : $DB"
psql -q -d postgres -c "drop database if exists \"$DB\";" >/dev/null
psql -q -d postgres -c "create database \"$DB\";" >/dev/null

psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/00-bootstrap.sql" >/dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$DIR/01-harness.sql" >/dev/null

echo "→ migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$migration")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

echo "→ seed"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql" >/dev/null

echo "→ contrôles RLS"
psql -q -d "$DB" -f "$DIR/02-rls.sql"
