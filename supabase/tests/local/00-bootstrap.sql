-- Faux socle Supabase, pour jouer les migrations dans un Postgres nu.
--
-- Ne fait pas partie du schéma de production : il reconstitue le minimum dont
-- les migrations ont besoin (les rôles, le schéma `auth`, `auth.uid()`) afin de
-- pouvoir vérifier la RLS sans Docker, sans réseau et sans projet Supabase.
--
-- `auth.uid()` lit ici le paramètre de session `request.jwt.claim.sub` — c'est
-- exactement ce que fait PostgREST en production. Changer ce paramètre revient
-- à changer d'appareil.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Reproduit les privilèges par défaut de Supabase : sans eux, on ne testerait
-- pas les bonnes conditions — c'est précisément ce `grant all ... to anon` qui
-- rend nécessaires les `revoke ... from anon` des migrations.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Supabase installe ses extensions dans le schéma `extensions`, jamais dans
-- `public`. Reproduire ce détail est ce qui permet au harnais d'attraper une
-- fonction qui appellerait `gen_random_bytes` avec un `search_path` figé à
-- `public` — le bug trouvé en production au sprint 1.
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
grant usage on schema auth to anon, authenticated, service_role;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
