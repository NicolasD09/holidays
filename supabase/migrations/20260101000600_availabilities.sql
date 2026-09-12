-- Sprint 4 · Migration 7 — disponibilités (catégorie dates)
-- Réf. doc 03 §3.4, §3.5, §3.6, §3.7 · doc 02 §2.5 mode `disponibilite`.
--
-- Première migration depuis le sprint 1. Elle fait quatre choses :
--   1. crée `availabilities` et ses policies ;
--   2. solde la dette n° 4 du doc 09 — `app_can_see_votes` ignorait les
--      disponibilités, donc en mode aveugle un participant qui avait peint
--      son calendrier sans voter nulle part restait aveugle à tort ;
--   3. ajoute la RPC d'écriture en masse `app_set_availability` ;
--   4. ouvre `app_create_trip` au mode `availability`, refusé jusqu'ici
--      faute d'écran (doc 09).
--
-- Le classement des créneaux n'est **pas** ici : doc 06 tâche 3.5 et doc 08
-- le placent dans `lib/scoring.ts`, une fonction pure testée à 100 %. Le
-- doc 03 §3.7 prévoyait une RPC `app_date_windows` ; on s'en écarte
-- sciemment — 100 % de couverture se tient en TypeScript, pas en PL/pgSQL,
-- et l'algorithme est la pièce du sprint qui doit être prouvée.

-- ────────────────────────────────────────────────────────── availabilities

create table availabilities (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips (id) on delete cascade,
  category_id    uuid not null references categories (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  day            date not null,
  status         availability_status not null,
  updated_at     timestamptz not null default now(),
  unique (participant_id, category_id, day)
);

create index availabilities_category_idx on availabilities (category_id, day);

alter table availabilities enable row level security;

-- Mêmes règles que les votes : les miennes toujours visibles, celles des
-- autres selon le mode aveugle (doc 03 §3.6).
create policy availabilities_select on availabilities for select using (
  app_is_participant(trip_id)
  and (
    participant_id = app_current_participant(trip_id)
    or app_can_see_votes(category_id)
  )
);

-- On n'écrit que pour soi. L'identité vient de `app_current_participant`,
-- jamais d'un identifiant fourni par le client : c'est ce qui empêche de
-- peindre le calendrier d'un autre.
create policy availabilities_write on availabilities for all
  using (participant_id = app_current_participant(trip_id))
  with check (participant_id = app_current_participant(trip_id));

revoke all on table availabilities from anon;
grant select, insert, update, delete on table availabilities to authenticated;

-- ─────────────────────────────────────────────────────────── déclencheurs

create trigger availabilities_set_updated_at
  before update on availabilities
  for each row execute function app_touch_updated_at();

create trigger availabilities_touch_activity
  after insert or update or delete on availabilities
  for each row execute function app_touch_last_activity();

create trigger availabilities_guard_closed
  before insert or update or delete on availabilities
  for each row execute function app_guard_closed_category();

-- ──────────────────────────────────── mode aveugle : dette n° 4 du doc 09
--
-- Dans une catégorie dates, on ne « vote » pas : on peint. Sans cette
-- seconde clause, un participant ayant renseigné tout son calendrier restait
-- aveugle aux disponibilités des autres — il avait pourtant payé le prix que
-- le mode aveugle demande : s'engager avant de voir.
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
    ) or exists (
      select 1
      from availabilities a
      join participants p on p.id = a.participant_id
      where a.category_id = c.id and p.auth_uid = auth.uid()
    )
  end
  from categories c
  join trips t on t.id = c.trip_id
  where c.id = p_category;
$$;

revoke all on function app_can_see_votes(uuid) from public, anon;
grant execute on function app_can_see_votes(uuid) to authenticated;

-- ───────────────────────────────────────────────────── app_set_availability
--
-- Écriture en masse : la grille envoie un lot de jours, pas un jour à la
-- fois. Un `status` nul **efface** le jour — c'est le pinceau gomme, et le
-- bouton « Effacer » de l'écran (doc 05 §5.3 5.b).
--
-- Les jours hors fenêtre sont refusés en bloc plutôt qu'ignorés en silence :
-- un client qui les envoie a un bug, et le masquer le rendrait introuvable.
create or replace function app_set_availability(p_category uuid, p_days jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_category categories%rowtype;
  v_participant uuid;
  v_item jsonb;
  v_day date;
  v_status text;
  v_written int := 0;
  v_cleared int := 0;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_category from categories where id = p_category;
  if not found then
    raise exception 'category_not_found';
  end if;
  if v_category.vote_mode <> 'availability' then
    raise exception 'invalid_vote_value';
  end if;
  if v_category.status = 'closed' then
    raise exception 'category_closed';
  end if;

  v_participant := app_current_participant(v_category.trip_id);
  if v_participant is null then
    raise exception 'not_participant';
  end if;

  if jsonb_typeof(p_days) <> 'array' then
    raise exception 'invalid_days';
  end if;
  -- La contrainte de table borne déjà la fenêtre à 400 jours ; on refuse
  -- au-delà pour qu'un lot ne puisse pas dépasser ce que la grille affiche.
  if jsonb_array_length(p_days) > 400 then
    raise exception 'too_many_days';
  end if;

  for v_item in select elem from jsonb_array_elements(p_days) as elem loop
    begin
      v_day := (v_item->>'day')::date;
    exception when others then
      raise exception 'invalid_days';
    end;

    if v_day is null
       or v_day < v_category.window_start
       or v_day > v_category.window_end then
      raise exception 'day_out_of_window';
    end if;

    v_status := nullif(v_item->>'status', '');

    if v_status is null then
      delete from availabilities
       where participant_id = v_participant
         and category_id = p_category
         and day = v_day;
      v_cleared := v_cleared + 1;
    else
      if v_status not in ('yes', 'maybe', 'no') then
        raise exception 'invalid_availability_status';
      end if;

      insert into availabilities (trip_id, category_id, participant_id, day, status)
      values (v_category.trip_id, p_category, v_participant, v_day, v_status::availability_status)
      on conflict (participant_id, category_id, day)
        do update set status = excluded.status, updated_at = now();
      v_written := v_written + 1;
    end if;
  end loop;

  return json_build_object('written', v_written, 'cleared', v_cleared);
end;
$$;

revoke all on function app_set_availability(uuid, jsonb) from public, anon;
grant execute on function app_set_availability(uuid, jsonb) to authenticated;

-- ──────────────────────────────── app_create_trip ouvre le mode dates
--
-- Jusqu'ici `availability` était refusé : ses colonnes de configuration
-- n'avaient pas d'écran (doc 09). L'écran arrive, la porte s'ouvre — mais
-- seulement pour `availability`. `amount` reste refusé jusqu'au sprint 6.
--
-- La contrainte `dates_window_required` de la table exige fenêtre et nuits ;
-- on valide ici pour lever un code lisible plutôt qu'une violation de
-- contrainte brute.
create or replace function app_create_trip(
  p_title text,
  p_emoji text default '🏖️',
  p_display_name text default null,
  p_categories jsonb default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_trip trips%rowtype;
  v_participant participants%rowtype;
  v_slug text;
  v_attempt int := 0;
  v_title text := trim(coalesce(p_title, ''));
  v_name text := trim(coalesce(p_display_name, ''));
  v_categories jsonb := coalesce(nullif(p_categories, 'null'::jsonb), jsonb_build_array(
    jsonb_build_object('kind', 'destination', 'label', 'Destination', 'vote_mode', 'approval')
  ));
  v_item jsonb;
  v_mode vote_mode;
  v_position smallint := 0;
  v_start date;
  v_end date;
  v_nights smallint;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if v_title = '' or char_length(v_title) > 120 then
    raise exception 'invalid_title';
  end if;
  if v_name = '' or char_length(v_name) > 40 then
    raise exception 'invalid_display_name';
  end if;
  if jsonb_typeof(v_categories) <> 'array' or jsonb_array_length(v_categories) = 0 then
    raise exception 'invalid_categories';
  end if;
  if jsonb_array_length(v_categories) > 10 then
    raise exception 'too_many_categories';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_slug := app_slug_candidate();
    exit when not exists (select 1 from trips where slug = v_slug);
    if v_attempt >= 10 then
      raise exception 'slug_generation_failed';
    end if;
  end loop;

  insert into trips (slug, title, cover_emoji)
  values (v_slug, v_title, coalesce(nullif(trim(coalesce(p_emoji, '')), ''), '🏖️'))
  returning * into v_trip;

  insert into participants (trip_id, display_name, auth_uid, is_organizer)
  values (v_trip.id, v_name, auth.uid(), true)
  returning * into v_participant;

  for v_item in select elem from jsonb_array_elements(v_categories) as elem loop
    v_mode := coalesce(nullif(v_item->>'vote_mode', ''), 'approval')::vote_mode;
    v_start := null;
    v_end := null;
    v_nights := null;

    -- `amount` demande des colonnes de configuration sans écran (sprint 6).
    if v_mode = 'amount' then
      raise exception 'unsupported_vote_mode';
    end if;

    if v_mode = 'availability' then
      begin
        v_start := nullif(v_item->>'window_start', '')::date;
        v_end := nullif(v_item->>'window_end', '')::date;
        v_nights := nullif(v_item->>'nights', '')::smallint;
      exception when others then
        raise exception 'invalid_date_window';
      end;

      if v_start is null or v_end is null or v_nights is null
         or v_end <= v_start
         or (v_end - v_start) > 400 then
        raise exception 'invalid_date_window';
      end if;
      if v_nights < 1 or v_nights > 60 then
        raise exception 'invalid_nights';
      end if;
      -- Une fenêtre doit pouvoir contenir au moins un séjour entier, sinon
      -- la catégorie naît sans aucun créneau possible.
      if (v_end - v_start) < v_nights then
        raise exception 'window_too_short';
      end if;
    end if;

    insert into categories (
      trip_id, kind, label, vote_mode, position, allow_participant_options, max_choices,
      window_start, window_end, nights
    )
    values (
      v_trip.id,
      coalesce(nullif(v_item->>'kind', ''), 'custom')::category_kind,
      coalesce(nullif(trim(coalesce(v_item->>'label', '')), ''), 'Sans titre'),
      v_mode,
      v_position,
      coalesce((v_item->>'allow_participant_options')::boolean, true),
      nullif(v_item->>'max_choices', '')::smallint,
      v_start,
      v_end,
      v_nights
    );
    v_position := v_position + 1;
  end loop;

  return json_build_object(
    'trip_id', v_trip.id,
    'slug', v_trip.slug,
    'participant_id', v_participant.id,
    'display_name', v_participant.display_name
  );
end;
$$;

revoke all on function app_create_trip(text, text, text, jsonb) from public, anon;
grant execute on function app_create_trip(text, text, text, jsonb) to authenticated;
