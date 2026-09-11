-- Sprint 1 · Migration 1 — types et tables du socle
-- Réf. doc 03 §3.3 (types) et §3.4 (tables).
--
-- Périmètre volontairement limité aux 5 tables dont dépend la boucle du
-- sprint 2. `availabilities`, `budget_answers`, `comments` et `decisions`
-- arriveront avec les sprints qui les utilisent (4, 6, 7, 8) : une table sans
-- écran est une table dont personne ne vérifie la RLS.
--
-- Les enums, eux, sont créés au complet dès maintenant : un `alter type ... add
-- value` ne peut pas s'exécuter dans la même transaction que son usage, ce qui
-- rendrait les migrations suivantes inutilement acrobatiques.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────── types

create type trip_status         as enum ('draft', 'open', 'closed', 'archived');
create type category_kind       as enum ('destination', 'dates', 'budget', 'lodging', 'activity', 'custom');
create type vote_mode           as enum ('approval', 'single', 'multiple', 'availability', 'amount');
create type category_status     as enum ('open', 'closed');
create type availability_status as enum ('yes', 'maybe', 'no');

-- ─────────────────────────────────────────────────────────────────── trips

create table trips (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null check (slug ~ '^[A-Za-z0-9_-]{12,32}$'),
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (char_length(description) <= 2000),
  cover_emoji      text default '🏖️',
  status           trip_status not null default 'open',
  blind_mode       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index trips_activity_idx on trips (last_activity_at) where status in ('open', 'closed');

comment on column trips.slug is
  'Secret à haute entropie : le connaître donne le droit de rejoindre (modèle capability, doc 03 §3.1). Jamais loggué, jamais indexé par un moteur de recherche.';

-- ────────────────────────────────────────────────────────────── participants

create table participants (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_emoji text,
  avatar_color text,
  auth_uid     uuid references auth.users (id) on delete set null,
  is_organizer boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index participants_trip_auth_key on participants (trip_id, auth_uid) where auth_uid is not null;
create unique index participants_trip_name_key on participants (trip_id, lower(display_name));
create unique index participants_one_organizer on participants (trip_id) where is_organizer;

comment on column participants.auth_uid is
  'JWT anonyme de l''appareil. `null` = fiche orpheline (participant créé par un autre, ou compte auth purgé) : réattribuable via app_claim_participant.';

-- ────────────────────────────────────────────────────────────── categories

create table categories (
  id                        uuid primary key default gen_random_uuid(),
  trip_id                   uuid not null references trips (id) on delete cascade,
  kind                      category_kind not null,
  label                     text not null check (char_length(label) between 1 and 60),
  description               text check (char_length(description) <= 1000),
  vote_mode                 vote_mode not null,
  status                    category_status not null default 'open',
  position                  smallint not null default 0,
  allow_participant_options boolean not null default true,
  max_choices               smallint check (max_choices is null or max_choices > 0),
  -- spécifique au mode 'availability' (sprint 4)
  window_start              date,
  window_end                date,
  nights                    smallint check (nights is null or nights between 1 and 60),
  -- spécifique au mode 'amount' (sprint 6)
  currency                  char(3) not null default 'EUR',
  created_at                timestamptz not null default now(),

  constraint dates_window_required check (
    vote_mode <> 'availability'
    or (
      window_start is not null
      and window_end is not null
      and nights is not null
      and window_end > window_start
      and window_end - window_start <= 400
    )
  )
);

create index categories_trip_idx on categories (trip_id, position);

-- ───────────────────────────────────────────────────────────────── options

create table options (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  url         text check (url is null or url ~ '^https?://'),
  image_url   text,
  meta        jsonb not null default '{}'::jsonb,
  created_by  uuid references participants (id) on delete set null,
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index options_category_idx on options (category_id, position, created_at);

-- ─────────────────────────────────────────────────────────────────── votes

-- value : approval → -1 (non) / 0 (peut-être) / 1 (oui) ; single & multiple → 1
create table votes (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips (id) on delete cascade,
  category_id    uuid not null references categories (id) on delete cascade,
  option_id      uuid not null references options (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  value          smallint not null check (value between -1 and 1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (participant_id, option_id)
);

create index votes_option_idx on votes (option_id);
create index votes_category_idx on votes (category_id, participant_id);

-- ────────────────────────────────────────────────────────────────── droits

-- Supabase accorde par défaut tous les droits sur les nouvelles tables de
-- `public` aux rôles `anon` et `authenticated`. On retire `anon` : une session
-- anonyme Supabase porte le rôle `authenticated` (avec `is_anonymous: true`),
-- donc aucun participant légitime ne passe par `anon`. Seul l'aperçu d'un
-- sondage avant identification en a besoin, et il passe par une RPC.
revoke all on table trips, participants, categories, options, votes from anon;

grant select, update, delete on table trips to authenticated;
grant select, update, delete on table participants to authenticated;
grant select, insert, update, delete on table categories to authenticated;
grant select, insert, update, delete on table options to authenticated;
grant select, insert, update, delete on table votes to authenticated;

-- Pas de `grant insert` sur trips ni participants : la création et l'adhésion
-- passent obligatoirement par les RPC, seul endroit où le slug est vérifié
-- (doc 03 §3.6, note de fin).
