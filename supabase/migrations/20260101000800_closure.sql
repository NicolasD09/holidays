-- Sprint 7 · Migration 9 — clôture, décisions et participation
-- Réf. doc 03 §3.4 (decisions), §3.6, §3.7 · doc 02 §2.4 · doc 08 sprint 7.
--
-- Six choses :
--   1. crée `decisions`, lisible par les participants, écrite par RPC seulement ;
--   2. ajoute `app_close_category` et `app_reopen_category`, organisateur
--      seulement. La clôture de la dernière catégorie ouverte passe le sondage
--      en `closed`, et la réouverture le rouvre ;
--   3. ferme l'écriture directe de `categories.status`, `trips.status` et
--      `trips.slug` : ces colonnes ne bougent plus que par une RPC. Sans ça,
--      un `update` brut clôturerait une catégorie **sans décision**, et le
--      sondage ne saurait jamais qu'il est fini ;
--   4. ajoute `app_trip_participation` — qui s'est prononcé, par catégorie.
--      Le hub le comptait côté client à partir des votes visibles ; ça
--      mentait dès que le mode aveugle était actif (dette n° 6 du doc 15) ;
--   5. garde la fenêtre d'une catégorie dates cohérente maintenant qu'elle se
--      modifie dans les réglages, et verrouille les modes `availability` et
--      `amount` en base (jusqu'ici, seul l'écran les verrouillait) ;
--   6. corrige l'off-by-one de `app_set_availability` (dette n° 2 du doc 15).
--
-- `decisions` n'est ajoutée à aucune publication temps réel : il n'en existe
-- pas encore (sprint 8). Elle devra y figurer (doc 03 §3.10).

-- ───────────────────────────────────────────────────────────── decisions
--
-- Une décision par catégorie au plus. Trois formes, selon le mode :
--   - une proposition (`option_id`), dont le titre est recopié dans
--     `payload.title` au moment de la clôture ;
--   - un créneau (`payload.start` / `payload.end`) ou un montant
--     (`payload.amount`) ;
--   - un texte libre — l'organisateur tranche autre chose que ce qui était
--     sur la table.
--
-- Pourquoi recopier le titre. `option_id` passe à `null` si la proposition
-- disparaît. Sans copie, la contrainte `decision_not_empty` ferait échouer
-- la suppression en cascade d'un sondage dont une catégorie est tranchée — et
-- le récap perdrait ce qui a été décidé. La copie fige ce que le groupe a
-- vu au moment de trancher.
create table decisions (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips (id) on delete cascade,
  category_id  uuid not null unique references categories (id) on delete cascade,
  option_id    uuid references options (id) on delete set null,
  free_text    text check (char_length(free_text) between 1 and 200),
  payload      jsonb not null default '{}'::jsonb,
  decided_by   uuid references participants (id) on delete set null,
  decided_at   timestamptz not null default now(),
  constraint decision_not_empty
    check (option_id is not null or free_text is not null or payload <> '{}'::jsonb)
);

create index decisions_trip_idx on decisions (trip_id);

alter table decisions enable row level security;

create policy decisions_select on decisions for select
  using (app_is_participant(trip_id));

-- Lecture seule pour le client : on n'écrit une décision qu'en clôturant.
revoke all on table decisions from anon, authenticated;
grant select on table decisions to authenticated;

-- ─────────────────────────────────────── colonnes qui ne bougent que par RPC
--
-- Les policies `categories_write` et `trips_update` restent telles quelles :
-- l'organisateur modifie toujours libellés, réglages, titre et mode aveugle
-- par un `update` direct. On retire seulement, colonne par colonne, ce qui
-- doit passer par une règle :
--
--   `categories.status`  → app_close_category / app_reopen_category ;
--   `trips.status`       → idem, en conséquence ;
--   `trips.slug`         → le lien est une capacité : il ne se réécrit pas à
--                          la main (sa régénération sera une RPC).
--
-- `kind`, `trip_id` et `currency` sortent aussi de la liste : rien ne les
-- modifie, et une catégorie qui change de sondage n'a aucun sens.
revoke update on table categories from authenticated;
grant update (
  label, description, vote_mode, max_choices, allow_participant_options, position,
  window_start, window_end, nights
) on table categories to authenticated;

revoke insert on table categories from authenticated;
grant insert (
  trip_id, kind, label, description, vote_mode, position, allow_participant_options,
  max_choices, window_start, window_end, nights
) on table categories to authenticated;

revoke update on table trips from authenticated;
grant update (title, description, cover_emoji, blind_mode) on table trips to authenticated;

-- ──────────────────────────────────────────── cohérence d'une catégorie
--
-- Deux règles que l'écran appliquait seul jusqu'ici, désormais en base :
--
-- 1. **Le mode de vote des dates et du budget ne change pas.** Passer un budget
--    en approbation laissait des montants orphelins, et l'inverse une
--    catégorie budget sans écran (doc 16). L'écran ne le proposait plus ;
--    un `update` brut le pouvait encore.
-- 2. **La fenêtre d'une catégorie dates contient au moins un séjour**, comme à
--    la création, et ne bouge plus une fois la catégorie tranchée : le
--    créneau retenu pourrait se retrouver hors fenêtre.
--
-- Réduire la fenêtre ne supprime **aucune** disponibilité : les jours peints
-- hors fenêtre dorment, ignorés partout, et reviennent si on l'élargit à
-- nouveau. C'est ce qui rend la modification réversible.
create or replace function app_check_category()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.vote_mode is distinct from old.vote_mode
     and (old.vote_mode in ('availability', 'amount') or new.vote_mode in ('availability', 'amount')) then
    raise exception 'vote_mode_locked';
  end if;

  if new.vote_mode = 'availability' then
    if (new.window_end - new.window_start) < new.nights then
      raise exception 'window_too_short';
    end if;
    if tg_op = 'UPDATE' and old.status = 'closed'
       and (new.window_start, new.window_end, new.nights)
           is distinct from (old.window_start, old.window_end, old.nights) then
      raise exception 'category_closed';
    end if;
  end if;

  return new;
end;
$$;

create trigger categories_check
  before insert or update on categories
  for each row execute function app_check_category();

revoke all on function app_check_category() from public, anon, authenticated;

-- ──────────────────────────────────────────────────── app_close_category
--
-- Clôture une catégorie sur une décision. L'organisateur tranche : la
-- proposition en tête n'est qu'une suggestion de l'écran, jamais une
-- obligation de la base (recette du sprint 7, étape 2).
--
-- Une décision, et une seule forme à la fois :
--   approbation / choix unique / multiple : `p_option` **ou** `p_free_text` ;
--   dates  : `p_payload = {"start", "end"}` **ou** `p_free_text` ;
--   budget : `p_payload = {"amount"}`       **ou** `p_free_text`.
-- Deux formes à la fois, ou aucune → `invalid_decision`. Mieux vaut refuser
-- qu'enregistrer une décision dont le récap ne saurait pas quoi afficher.
create or replace function app_close_category(
  p_category uuid,
  p_option uuid default null,
  p_free_text text default null,
  p_payload jsonb default null
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_category categories%rowtype;
  v_option options%rowtype;
  v_text text := nullif(trim(coalesce(p_free_text, '')), '');
  v_payload jsonb := coalesce(nullif(p_payload, 'null'::jsonb), '{}'::jsonb);
  v_start date;
  v_end date;
  v_amount integer;
  v_decision decisions%rowtype;
  v_trip_status trip_status;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_category from categories where id = p_category for update;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if not app_is_organizer(v_category.trip_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if v_category.status = 'closed' then
    raise exception 'category_closed';
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'invalid_decision';
  end if;
  if char_length(v_text) > 200 then
    raise exception 'invalid_decision';
  end if;

  if v_category.vote_mode = 'availability' then
    if p_option is not null then
      raise exception 'invalid_decision';
    end if;
    if v_payload <> '{}'::jsonb then
      if v_text is not null then
        raise exception 'invalid_decision';
      end if;
      begin
        v_start := (v_payload->>'start')::date;
        v_end := (v_payload->>'end')::date;
      exception when others then
        raise exception 'invalid_decision';
      end;
      if v_start is null or v_end is null or v_end <= v_start then
        raise exception 'invalid_decision';
      end if;
      if v_start < v_category.window_start or v_end > v_category.window_end then
        raise exception 'decision_out_of_window';
      end if;
      -- Normalisé : seules les deux dates sont gardées, au format ISO.
      v_payload := jsonb_build_object('start', v_start, 'end', v_end);
    elsif v_text is null then
      raise exception 'invalid_decision';
    end if;

  elsif v_category.vote_mode = 'amount' then
    if p_option is not null then
      raise exception 'invalid_decision';
    end if;
    if v_payload <> '{}'::jsonb then
      if v_text is not null then
        raise exception 'invalid_decision';
      end if;
      begin
        v_amount := (v_payload->>'amount')::integer;
      exception when others then
        raise exception 'invalid_amount';
      end;
      if v_amount is null or v_amount < 0 or v_amount > 1000000 then
        raise exception 'invalid_amount';
      end if;
      v_payload := jsonb_build_object('amount', v_amount);
    elsif v_text is null then
      raise exception 'invalid_decision';
    end if;

  else
    if v_payload <> '{}'::jsonb then
      raise exception 'invalid_decision';
    end if;
    if p_option is not null then
      if v_text is not null then
        raise exception 'invalid_decision';
      end if;
      select * into v_option from options
       where id = p_option and category_id = p_category;
      if not found then
        raise exception 'option_not_found' using errcode = 'P0002';
      end if;
      v_payload := jsonb_build_object('title', v_option.title);
    elsif v_text is null then
      raise exception 'invalid_decision';
    end if;
  end if;

  insert into decisions (trip_id, category_id, option_id, free_text, payload, decided_by)
  values (
    v_category.trip_id, p_category, p_option, v_text, v_payload,
    app_current_participant(v_category.trip_id)
  )
  returning * into v_decision;

  update categories set status = 'closed' where id = p_category;

  -- La dernière catégorie ouverte vient d'être tranchée : le sondage est fini,
  -- et son lien ouvrira désormais le récap (doc 02 §2.4, étape 5).
  update trips
     set status = case
           when status = 'open' and not exists (
             select 1 from categories c
             where c.trip_id = v_category.trip_id and c.status = 'open')
           then 'closed'::trip_status
           else status
         end,
         last_activity_at = now()
   where id = v_category.trip_id
  returning status into v_trip_status;

  return json_build_object(
    'decision_id', v_decision.id,
    'category_id', p_category,
    'trip_status', v_trip_status
  );
end;
$$;

revoke all on function app_close_category(uuid, uuid, text, jsonb) from public, anon;
grant execute on function app_close_category(uuid, uuid, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────── app_reopen_category
--
-- Rouvre une catégorie et **supprime sa décision** (doc 03 §3.7). Les votes,
-- eux, n'ont jamais été touchés par la clôture : ils redeviennent
-- simplement modifiables. Un sondage clôturé repasse ouvert.
--
-- Idempotente : rouvrir une catégorie déjà ouverte ne fait rien et ne lève
-- rien — un double tap ne doit pas afficher d'erreur après un succès.
create or replace function app_reopen_category(p_category uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_category categories%rowtype;
  v_trip_status trip_status;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_category from categories where id = p_category for update;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if not app_is_organizer(v_category.trip_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;

  if v_category.status = 'closed' then
    delete from decisions where category_id = p_category;
    update categories set status = 'open' where id = p_category;
  end if;

  update trips
     set status = case when status = 'closed' then 'open'::trip_status else status end,
         last_activity_at = now()
   where id = v_category.trip_id
  returning status into v_trip_status;

  return json_build_object('category_id', p_category, 'trip_status', v_trip_status);
end;
$$;

revoke all on function app_reopen_category(uuid) from public, anon;
grant execute on function app_reopen_category(uuid) to authenticated;

-- ──────────────────────────────────────────────── app_trip_participation
--
-- Par catégorie : qui s'est prononcé au moins une fois. C'est **ce que le hub
-- affichait déjà** (« 5/8 ont répondu », et qui manque — ADR-009), mais
-- compté en base plutôt qu'à partir des votes que l'appelant peut lire.
--
-- Pourquoi en base. En mode aveugle, la RLS masque les votes d'autrui à qui
-- n'a pas voté : compté côté client, le hub affichait « 1/8 » chez tout le
-- monde. Ce n'était pas une fuite, c'était un compteur qui mentait.
--
-- Ce que ça révèle, et ce que ça ne révèle pas. **Qui** a participé, jamais
-- **quoi** : aucun vote, aucune proposition, aucun jour, aucun montant. Le mode
-- aveugle masque le contenu des votes (ADR-007), pas le fait d'avoir voté —
-- c'est la contrepartie retenue par ADR-009.
--
-- Le budget n'y donne qu'un **nombre** : savoir qui a répondu est déjà trop
-- (ADR-006). `respondents` y reste vide, sous tous les états.
--
-- Les jours peints hors de la fenêtre courante ne comptent pas : ils dorment
-- depuis qu'une fenêtre peut être réduite.
create or replace function app_trip_participation(p_trip uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_participant(p_trip) then
    raise exception 'not_participant' using errcode = '42501';
  end if;

  return coalesce((
    select json_object_agg(
      c.id,
      case
        when c.vote_mode = 'amount' then json_build_object(
          'respondents', '[]'::json,
          'count', (select count(*)::int from budget_answers b where b.category_id = c.id))
        else json_build_object(
          'respondents', coalesce(r.ids, '[]'::json),
          'count', coalesce(r.n, 0))
      end)
    from categories c
    left join lateral (
      select json_agg(x.pid order by x.pid) as ids, count(*)::int as n
      from (
        select v.participant_id as pid from votes v where v.category_id = c.id
        union
        select a.participant_id from availabilities a
         where a.category_id = c.id
           and a.day between c.window_start and c.window_end
      ) x
    ) r on c.vote_mode <> 'amount'
    where c.trip_id = p_trip
  ), '{}'::json);
end;
$$;

revoke all on function app_trip_participation(uuid) from public, anon;
grant execute on function app_trip_participation(uuid) to authenticated;

-- ───────────────────────────────── app_set_availability, l'off-by-one
--
-- Reprise à l'identique de la migration 7, à une ligne près : le plafond du
-- lot passe de 400 à 401 jours.
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
  -- La contrainte de table borne l'écart `window_end - window_start` à 400 :
  -- bornes incluses, une fenêtre compte donc jusqu'à **401** jours. Le plafond
  -- était à 400 — « Tout dispo » sur une fenêtre maximale était refusé à tort
  -- (dette n° 2 du doc 15).
  if jsonb_array_length(p_days) > 401 then
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
