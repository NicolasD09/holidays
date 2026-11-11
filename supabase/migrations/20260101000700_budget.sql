-- Sprint 6 · Migration 8 — budget (catégorie en mode `amount`)
-- Réf. doc 03 §3.4, §3.6, §3.7 · doc 02 §2.5 mode `montant` · ADR-006.
--
-- Quatre choses :
--   1. crée `budget_answers` et ses policies strictement personnelles ;
--   2. ajoute `app_set_budget`, seule porte d'écriture ;
--   3. ajoute `app_budget_summary`, seule porte de lecture de ce qui n'est
--      pas à soi — et elle ne renvoie que des agrégats ;
--   4. ouvre `app_create_trip` au mode `amount`, refusé jusqu'ici faute
--      d'écran, et lui fait enregistrer la `description` d'une catégorie
--      (c'est là que l'organisateur précise « par personne, hors transport »).
--
-- `budget_answers` n'est ajoutée à aucune publication temps réel : il n'en
-- existe pas encore (sprint 8), et celle-ci devra l'exclure (doc 03 §3.10).

-- ────────────────────────────────────────────────────────── budget_answers
--
-- CONFIDENTIEL : jamais exposé ligne à ligne, y compris à l'organisateur.
create table budget_answers (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips (id) on delete cascade,
  category_id    uuid not null references categories (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  amount         integer not null check (amount >= 0 and amount <= 1000000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (participant_id, category_id)
);

create index budget_answers_category_idx on budget_answers (category_id);

alter table budget_answers enable row level security;

-- STRICTEMENT personnel. Il n'y a volontairement **aucune** clause
-- `app_is_organizer` ni `app_can_see_votes` ici : ni le rôle, ni le mode
-- aveugle, ni la clôture n'ouvrent la lecture du montant d'autrui (ADR-006).
create policy budget_select_self on budget_answers for select
  using (participant_id = app_current_participant(trip_id));

create policy budget_write_self on budget_answers for all
  using (participant_id = app_current_participant(trip_id))
  with check (participant_id = app_current_participant(trip_id));

-- Lecture seule pour le client : on relit **son** montant, rien d'autre.
-- L'écriture directe n'est pas accordée, alors que la policy ci-dessus la
-- tolérerait : un `insert` brut contournerait les contrôles de la RPC (mode
-- de la catégorie, bornes du montant). La policy reste, en seconde ligne, si
-- un `grant` était un jour ajouté.
revoke all on table budget_answers from anon, authenticated;
grant select on table budget_answers to authenticated;

-- ─────────────────────────────────────────────────────────── déclencheurs

create trigger budget_answers_set_updated_at
  before update on budget_answers
  for each row execute function app_touch_updated_at();

create trigger budget_answers_touch_activity
  after insert or update or delete on budget_answers
  for each row execute function app_touch_last_activity();

create trigger budget_answers_guard_closed
  before insert or update or delete on budget_answers
  for each row execute function app_guard_closed_category();

-- ─────────────────────────────────────────────────────────── app_set_budget
--
-- Upsert du montant personnel. Un montant nul **retire** la réponse : on doit
-- pouvoir revenir sur un chiffre donné trop vite sans le remplacer par un
-- autre chiffre inventé.
-- `default null` pour que les types générés rendent l'argument facultatif :
-- l'omettre, c'est retirer.
create or replace function app_set_budget(p_category uuid, p_amount integer default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_category categories%rowtype;
  v_participant uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_category from categories where id = p_category;
  if not found then
    raise exception 'category_not_found';
  end if;
  if v_category.vote_mode <> 'amount' then
    raise exception 'invalid_vote_value';
  end if;
  if v_category.status = 'closed' then
    raise exception 'category_closed';
  end if;

  v_participant := app_current_participant(v_category.trip_id);
  if v_participant is null then
    raise exception 'not_participant';
  end if;

  if p_amount is null then
    delete from budget_answers
     where participant_id = v_participant and category_id = p_category;
    return json_build_object('amount', null);
  end if;

  if p_amount < 0 or p_amount > 1000000 then
    raise exception 'invalid_amount';
  end if;

  insert into budget_answers (trip_id, category_id, participant_id, amount)
  values (v_category.trip_id, p_category, v_participant, p_amount)
  on conflict (participant_id, category_id)
    do update set amount = excluded.amount, updated_at = now();

  return json_build_object('amount', p_amount);
end;
$$;

revoke all on function app_set_budget(uuid, integer) from public, anon;
grant execute on function app_set_budget(uuid, integer) to authenticated;

-- ─────────────────────────────────────────────────────── app_budget_summary
--
-- La seule fenêtre sur les montants des autres, et elle ne montre que des
-- agrégats. Trois états, portés par `status` :
--
--   `answer_first`  l'appelant n'a pas encore répondu (catégorie ouverte) ;
--   `insufficient`  moins de 3 réponses — RM-10 ;
--   `ready`         min, médiane, max et courbe d'accessibilité.
--
-- Le doc 03 §3.7 prévoyait une erreur `insufficient_respondents`. On renvoie
-- un état plutôt qu'une exception : le hub a besoin du **nombre** de réponses
-- dans tous les cas, et ce nombre ne dit rien d'un montant.
--
-- `curve` donne, pour chaque palier, combien de personnes suivent encore
-- (montant ≥ palier). Le pas est choisi pour ne jamais dépasser une
-- quarantaine de paliers : le curseur de l'écran s'y accroche, et la
-- distribution n'est exposée qu'à la précision d'un palier, jamais au montant
-- exact — hormis min, médiane et max, que la spec demande.
--
-- Aucun identifiant de participant ne sort d'ici, sous aucune forme.
create or replace function app_budget_summary(p_category uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_category categories%rowtype;
  v_participant uuid;
  v_answered boolean;
  v_count int;
  v_min int;
  v_max int;
  v_median int;
  v_step int;
  v_from int;
  v_to int;
  v_curve json;
begin
  select * into v_category from categories where id = p_category;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if v_category.vote_mode <> 'amount' then
    raise exception 'invalid_vote_value';
  end if;

  v_participant := app_current_participant(v_category.trip_id);
  if v_participant is null then
    raise exception 'not_participant' using errcode = '42501';
  end if;

  v_answered := exists (
    select 1 from budget_answers
    where category_id = p_category and participant_id = v_participant
  );

  select count(*)::int, min(amount), max(amount),
         round(percentile_cont(0.5) within group (order by amount))::int
    into v_count, v_min, v_max, v_median
    from budget_answers
   where category_id = p_category;

  -- On s'engage avant de voir : tant que la catégorie est ouverte, le résumé
  -- ne s'ouvre qu'à ceux qui ont donné leur montant (doc 05 §5.3 5.c).
  if not v_answered and v_category.status = 'open' then
    return json_build_object(
      'status', 'answer_first', 'respondents', v_count, 'answered', false);
  end if;

  if v_count < 3 then
    return json_build_object(
      'status', 'insufficient', 'respondents', v_count, 'answered', v_answered);
  end if;

  select s into v_step
    from unnest(array[10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000]) as s
   where (v_max - v_min) / s <= 40
   order by s
   limit 1;

  v_from := (v_min / v_step) * v_step;
  v_to := ((v_max + v_step - 1) / v_step) * v_step;
  -- Tout le monde sur le même palier : sans ce pas de plus, la courbe
  -- n'aurait qu'un point et le curseur aucune course.
  if v_to = v_from then
    v_to := v_from + v_step;
  end if;

  select json_agg(
           json_build_object(
             'amount', g,
             'followers', (select count(*)::int from budget_answers b
                            where b.category_id = p_category and b.amount >= g))
           order by g)
    into v_curve
    from generate_series(v_from, v_to, v_step) as g;

  return json_build_object(
    'status', 'ready',
    'respondents', v_count,
    'answered', v_answered,
    'min', v_min,
    'median', v_median,
    'max', v_max,
    'step', v_step,
    'curve', v_curve
  );
end;
$$;

revoke all on function app_budget_summary(uuid) from public, anon;
grant execute on function app_budget_summary(uuid) to authenticated;

-- ──────────────────────────────── app_create_trip ouvre le mode budget
--
-- Dernier mode refusé à la création : `amount` passe, l'écran existe. Il n'a
-- aucune colonne de configuration propre — `currency` vaut 'EUR' par défaut,
-- et la v1 n'en propose pas d'autre.
--
-- La fonction enregistre désormais la `description` d'une catégorie, pour
-- tous les modes : la colonne existait depuis le sprint 1 sans que rien ne
-- l'alimente. Reprise à l'identique de la migration 7 pour tout le reste.
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
  v_description text;
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

    v_description := nullif(trim(coalesce(v_item->>'description', '')), '');
    if char_length(v_description) > 1000 then
      raise exception 'invalid_description';
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
      trip_id, kind, label, description, vote_mode, position, allow_participant_options,
      max_choices, window_start, window_end, nights
    )
    values (
      v_trip.id,
      coalesce(nullif(v_item->>'kind', ''), 'custom')::category_kind,
      coalesce(nullif(trim(coalesce(v_item->>'label', '')), ''), 'Sans titre'),
      v_description,
      v_mode,
      v_position,
      -- Dans une catégorie budget il n'y a rien à proposer : on donne un montant.
      case when v_mode = 'amount' then false
           else coalesce((v_item->>'allow_participant_options')::boolean, true) end,
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
