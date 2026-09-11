-- Sprint 1 · Migration 4 — vote et déclencheurs de règles métier
-- Réf. doc 03 §3.7 (app_cast_vote) et §3.9 (déclencheurs).
--
-- Les règles sont posées en déclencheur et non seulement dans la RPC : un
-- client qui écrirait directement dans `votes` via PostgREST doit se heurter
-- aux mêmes limites. La RPC apporte l'atomicité et des erreurs lisibles ; les
-- déclencheurs apportent la garantie.

-- ─────────────────────────────────────────────────────────── app_cast_vote

create or replace function app_cast_vote(p_option_id uuid, p_value smallint)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_option options%rowtype;
  v_category categories%rowtype;
  v_participant uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_option from options where id = p_option_id;
  if not found then
    raise exception 'option_not_found' using errcode = 'P0002';
  end if;

  select * into v_category from categories where id = v_option.category_id;

  v_participant := app_current_participant(v_option.trip_id);
  if v_participant is null then
    raise exception 'not_participant' using errcode = '42501';
  end if;

  if v_category.status = 'closed' then
    raise exception 'category_closed';
  end if;

  case v_category.vote_mode
    when 'approval' then
      if p_value not in (-1, 0, 1) then
        raise exception 'invalid_vote_value';
      end if;
    when 'single', 'multiple' then
      if p_value <> 1 then
        raise exception 'invalid_vote_value';
      end if;
    else
      raise exception 'unsupported_vote_mode';
  end case;

  insert into votes (trip_id, category_id, option_id, participant_id, value)
  values (v_option.trip_id, v_option.category_id, v_option.id, v_participant, p_value)
  on conflict (participant_id, option_id) do update
    set value = excluded.value,
        updated_at = now();

  return json_build_object('option_id', v_option.id, 'value', p_value);
end;
$$;

revoke all on function app_cast_vote(uuid, smallint) from public, anon;
grant execute on function app_cast_vote(uuid, smallint) to authenticated;

-- Retirer son vote : en approbation, « je ne me prononce plus » n'est pas la
-- même chose que « non ». Sans cette fonction, un tap malencontreux serait
-- définitif.
create or replace function app_retract_vote(p_option_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_option options%rowtype;
  v_participant uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_option from options where id = p_option_id;
  if not found then
    raise exception 'option_not_found' using errcode = 'P0002';
  end if;

  v_participant := app_current_participant(v_option.trip_id);
  if v_participant is null then
    raise exception 'not_participant' using errcode = '42501';
  end if;

  delete from votes where option_id = v_option.id and participant_id = v_participant;
end;
$$;

revoke all on function app_retract_vote(uuid) from public, anon;
grant execute on function app_retract_vote(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────── updated_at

create or replace function app_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trips_set_updated_at
  before update on trips
  for each row execute function app_touch_updated_at();

create trigger votes_set_updated_at
  before update on votes
  for each row execute function app_touch_updated_at();

-- ───────────────────────────────────────────────────── last_activity_at
--
-- Alimente la purge du doc 03 §3.11 : un sondage sans activité depuis 180
-- jours est archivé. `security definer` parce que l'auteur du vote n'a pas le
-- droit de modifier `trips` s'il n'est pas organisateur.
create or replace function app_touch_last_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid;
begin
  if tg_op = 'DELETE' then
    v_trip := old.trip_id;
  else
    v_trip := new.trip_id;
  end if;

  update trips set last_activity_at = now() where id = v_trip;
  return null;
end;
$$;

create trigger votes_touch_activity
  after insert or update or delete on votes
  for each row execute function app_touch_last_activity();

create trigger options_touch_activity
  after insert or update or delete on options
  for each row execute function app_touch_last_activity();

-- ───────────────────────────────────────────────────── choix unique

-- Mode `single` : voter pour une proposition retire le vote précédent. Le
-- `delete` ne réarme pas ce déclencheur (il n'écoute pas les suppressions).
create or replace function app_enforce_single_choice()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mode vote_mode;
begin
  select vote_mode into v_mode from categories where id = new.category_id;

  if v_mode = 'single' then
    delete from votes
    where category_id = new.category_id
      and participant_id = new.participant_id
      and option_id <> new.option_id;
  end if;

  return new;
end;
$$;

create trigger votes_single_choice
  before insert or update on votes
  for each row execute function app_enforce_single_choice();

-- ───────────────────────────────────────────────────── plafond de choix

create or replace function app_enforce_max_choices()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mode vote_mode;
  v_max smallint;
  v_count int;
begin
  select vote_mode, max_choices into v_mode, v_max
  from categories where id = new.category_id;

  if v_mode = 'multiple' and v_max is not null and new.value = 1 then
    select count(*) into v_count
    from votes
    where category_id = new.category_id
      and participant_id = new.participant_id
      and option_id <> new.option_id
      and value = 1;

    if v_count >= v_max then
      raise exception 'max_choices_reached';
    end if;
  end if;

  return new;
end;
$$;

create trigger votes_max_choices
  before insert or update on votes
  for each row execute function app_enforce_max_choices();

-- ───────────────────────────────────────────────────── catégorie clôturée

create or replace function app_guard_closed_category()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_category uuid;
  v_status category_status;
begin
  if tg_op = 'DELETE' then
    v_category := old.category_id;
  else
    v_category := new.category_id;
  end if;

  select status into v_status from categories where id = v_category;
  if v_status = 'closed' then
    raise exception 'category_closed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger votes_guard_closed
  before insert or update or delete on votes
  for each row execute function app_guard_closed_category();

create trigger options_guard_closed
  before insert or update or delete on options
  for each row execute function app_guard_closed_category();

-- ───────────────────────────────────────────────────── plafond de propositions

create or replace function app_cap_options()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from options where category_id = new.category_id) >= 100 then
    raise exception 'option_limit_reached';
  end if;
  return new;
end;
$$;

create trigger options_cap
  before insert on options
  for each row execute function app_cap_options();

-- Les fonctions de déclencheur n'ont pas à être appelables directement.
revoke all on function app_touch_updated_at() from public, anon, authenticated;
revoke all on function app_touch_last_activity() from public, anon, authenticated;
revoke all on function app_enforce_single_choice() from public, anon, authenticated;
revoke all on function app_enforce_max_choices() from public, anon, authenticated;
revoke all on function app_guard_closed_category() from public, anon, authenticated;
revoke all on function app_cap_options() from public, anon, authenticated;
