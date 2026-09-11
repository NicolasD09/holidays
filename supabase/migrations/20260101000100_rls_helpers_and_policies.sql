-- Sprint 1 · Migration 2 — socle RLS : fonctions d'accès et policies
-- Réf. doc 03 §3.5 et §3.6.
--
-- Les quatre fonctions sont `security definer` : elles lisent `participants`
-- alors que les policies de `participants` s'appuient sur elles. Sans le
-- contournement de RLS que donne `definer`, on aurait une récursion infinie.
-- Leur `search_path` est figé à `public` : c'est ce qui empêche un appelant de
-- détourner la résolution des noms de tables.

-- ────────────────────────────────────────────────────── fonctions d'accès

create or replace function app_current_participant(p_trip uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id
  from participants
  where trip_id = p_trip and auth_uid = auth.uid()
  limit 1;
$$;

create or replace function app_is_participant(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from participants
    where trip_id = p_trip and auth_uid = auth.uid()
  );
$$;

create or replace function app_is_organizer(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from participants
    where trip_id = p_trip and auth_uid = auth.uid() and is_organizer
  );
$$;

-- Mode aveugle : peut-on voir les votes des autres dans cette catégorie ?
-- La clause `availabilities` du doc 03 §3.5 est absente : la table arrive au
-- sprint 4, la fonction sera reprise à ce moment-là (nouvelle migration).
create or replace function app_can_see_votes(p_category uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when c.status = 'closed' then true
    when not t.blind_mode then true
    else exists (
      select 1
      from votes v
      join participants p on p.id = v.participant_id
      where v.category_id = c.id and p.auth_uid = auth.uid()
    )
  end
  from categories c
  join trips t on t.id = c.trip_id
  where c.id = p_category;
$$;

-- `from public` ne suffit pas : Supabase accorde EXECUTE à `anon` et
-- `authenticated` par privilège par défaut sur toute fonction créée dans
-- `public`. Il faut donc retirer `anon` nommément — sinon une requête sans
-- session peut appeler ces fonctions, et seule la nullité de auth.uid() la
-- freine. Défense en profondeur : on ne s'appuie pas là-dessus.
revoke all on function app_current_participant(uuid) from public, anon;
revoke all on function app_is_participant(uuid) from public, anon;
revoke all on function app_is_organizer(uuid) from public, anon;
revoke all on function app_can_see_votes(uuid) from public, anon;

grant execute on function app_current_participant(uuid) to authenticated;
grant execute on function app_is_participant(uuid) to authenticated;
grant execute on function app_is_organizer(uuid) to authenticated;
grant execute on function app_can_see_votes(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────── activation

alter table trips        enable row level security;
alter table participants enable row level security;
alter table categories   enable row level security;
alter table options      enable row level security;
alter table votes        enable row level security;

-- ─────────────────────────────────────────────────────────────────── trips

create policy trips_select on trips for select
  using (app_is_participant(id));

create policy trips_update on trips for update
  using (app_is_organizer(id))
  with check (app_is_organizer(id));

create policy trips_delete on trips for delete
  using (app_is_organizer(id));

-- ────────────────────────────────────────────────────────────── participants

create policy participants_select on participants for select
  using (app_is_participant(trip_id));

create policy participants_update_self on participants for update
  using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());

create policy participants_delete on participants for delete
  using (app_is_organizer(trip_id) or auth_uid = auth.uid());

-- ─────────────────────────────────────────────────────────────── categories

create policy categories_select on categories for select
  using (app_is_participant(trip_id));

create policy categories_write on categories for all
  using (app_is_organizer(trip_id))
  with check (app_is_organizer(trip_id));

-- ───────────────────────────────────────────────────────────────── options

create policy options_select on options for select
  using (app_is_participant(trip_id));

create policy options_insert on options for insert with check (
  app_is_participant(trip_id)
  and created_by = app_current_participant(trip_id)
  and exists (
    select 1 from categories c
    where c.id = category_id
      and c.status = 'open'
      and (c.allow_participant_options or app_is_organizer(trip_id))
  )
);

create policy options_update on options for update
  using (app_is_organizer(trip_id) or created_by = app_current_participant(trip_id))
  with check (app_is_organizer(trip_id) or created_by = app_current_participant(trip_id));

-- On ne peut retirer sa propre proposition que si personne d'autre n'a voté
-- dessus : sinon on effacerait le vote d'un tiers.
create policy options_delete on options for delete using (
  app_is_organizer(trip_id)
  or (
    created_by = app_current_participant(trip_id)
    and not exists (
      select 1 from votes v
      where v.option_id = options.id
        and v.participant_id <> options.created_by
    )
  )
);

-- ─────────────────────────────────────────────────────────────────── votes

-- Mes votes sont toujours visibles ; ceux des autres dépendent du mode aveugle.
create policy votes_select on votes for select using (
  app_is_participant(trip_id)
  and (participant_id = app_current_participant(trip_id) or app_can_see_votes(category_id))
);

create policy votes_write on votes for all
  using (
    participant_id = app_current_participant(trip_id)
    and exists (select 1 from categories c where c.id = category_id and c.status = 'open')
  )
  with check (
    participant_id = app_current_participant(trip_id)
    and exists (select 1 from categories c where c.id = category_id and c.status = 'open')
  );
