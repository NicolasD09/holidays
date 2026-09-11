-- Sprint 1 · Migration 3 — cycle de vie d'un sondage
-- Réf. doc 03 §3.7 : app_create_trip, app_trip_preview, app_join_trip.
--
-- Ces trois fonctions sont le seul chemin d'écriture vers `trips` et
-- `participants` : aucune policy `insert` n'existe sur ces tables.

-- ───────────────────────────────────────────────────── génération du slug
--
-- 16 caractères en base58 (alphabet sans 0/O/I/l, illisibles à l'oral et à
-- l'écran) ≈ 93 bits d'entropie. À comparer à l'ordre de grandeur du produit
-- (quelques milliers de sondages) : deviner un lien est hors de portée.
--
-- Le `% 58` sur un octet introduit un biais léger (les 22 premiers caractères
-- de l'alphabet sortent 5 fois sur 256 au lieu de 4). Sur 16 positions la perte
-- d'entropie est inférieure à 0,5 bit — assumé plutôt qu'un tirage par
-- réjection qui compliquerait la fonction pour rien.
create or replace function app_slug_candidate()
returns text language plpgsql volatile set search_path = public as $$
declare
  c_alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  v_bytes bytea := gen_random_bytes(16);
  v_slug text := '';
  v_i int;
begin
  for v_i in 0..15 loop
    v_slug := v_slug || substr(c_alphabet, (get_byte(v_bytes, v_i) % 58) + 1, 1);
  end loop;
  return v_slug;
end;
$$;

revoke all on function app_slug_candidate() from public, anon, authenticated;

-- ────────────────────────────────────────────────────────── app_create_trip

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

    -- `availability` et `amount` demandent des colonnes de configuration qui
    -- n'ont pas encore d'écran (sprints 4 et 6). Refuser explicitement vaut
    -- mieux que laisser remonter une violation de contrainte illisible.
    if v_mode in ('availability', 'amount') then
      raise exception 'unsupported_vote_mode';
    end if;

    insert into categories (
      trip_id, kind, label, vote_mode, position, allow_participant_options, max_choices
    )
    values (
      v_trip.id,
      coalesce(nullif(v_item->>'kind', ''), 'custom')::category_kind,
      coalesce(nullif(trim(coalesce(v_item->>'label', '')), ''), 'Sans titre'),
      v_mode,
      v_position,
      coalesce((v_item->>'allow_participant_options')::boolean, true),
      nullif(v_item->>'max_choices', '')::smallint
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

-- ───────────────────────────────────────────────────────── app_trip_preview
--
-- Alimente l'écran d'adhésion : ce qu'on montre AVANT d'entrer son prénom.
-- Ni propositions, ni votes, ni prénoms — juste de quoi reconnaître le sondage
-- et décider d'y entrer. Accessible sans session (rôle `anon`), parce qu'à ce
-- stade le client n'a pas encore appelé signInAnonymously().
create or replace function app_trip_preview(p_slug text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_trip trips%rowtype;
begin
  select * into v_trip from trips where slug = p_slug;
  if not found or v_trip.status = 'archived' then
    raise exception 'trip_not_found' using errcode = 'P0002';
  end if;

  return json_build_object(
    'trip_id', v_trip.id,
    'slug', v_trip.slug,
    'title', v_trip.title,
    'description', v_trip.description,
    'cover_emoji', v_trip.cover_emoji,
    'status', v_trip.status,
    'participant_count', (select count(*) from participants p where p.trip_id = v_trip.id),
    'is_participant', app_is_participant(v_trip.id),
    'categories', coalesce((
      select json_agg(json_build_object('id', c.id, 'label', c.label, 'kind', c.kind) order by c.position)
      from categories c where c.trip_id = v_trip.id
    ), '[]'::json)
  );
end;
$$;

-- Seule RPC ouverte à `anon` : l'aperçu s'affiche avant que le client ait
-- appelé signInAnonymously().
revoke all on function app_trip_preview(text) from public;
grant execute on function app_trip_preview(text) to anon, authenticated;

-- ──────────────────────────────────────────────────────────── app_join_trip

create or replace function app_join_trip(p_slug text, p_display_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_trip trips%rowtype;
  v_participant participants%rowtype;
  v_name text := trim(coalesce(p_display_name, ''));
  v_suffix int := 1;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select * into v_trip from trips where slug = p_slug;
  if not found then
    raise exception 'trip_not_found' using errcode = 'P0002';
  end if;
  if v_trip.status = 'archived' then
    raise exception 'trip_archived';
  end if;

  -- Déjà participant sur cet appareil : idempotent, on ne crée pas de doublon.
  select * into v_participant
  from participants
  where trip_id = v_trip.id and auth_uid = auth.uid();

  if found then
    update participants set last_seen_at = now() where id = v_participant.id;
    return json_build_object(
      'trip_id', v_trip.id,
      'participant_id', v_participant.id,
      'display_name', v_participant.display_name,
      'is_organizer', v_participant.is_organizer,
      'created', false
    );
  end if;

  if v_name = '' or char_length(v_name) > 40 then
    raise exception 'invalid_display_name';
  end if;

  if (select count(*) from participants where trip_id = v_trip.id) >= 50 then
    raise exception 'participant_limit_reached';
  end if;

  -- Déduplication du prénom : « Thomas » puis « Thomas (2) ». On ne refuse
  -- jamais un prénom — refuser ferait sortir la personne du parcours.
  while exists (
    select 1 from participants
    where trip_id = v_trip.id and lower(display_name) = lower(v_name)
  ) loop
    v_suffix := v_suffix + 1;
    v_name := trim(p_display_name) || ' (' || v_suffix || ')';
  end loop;

  insert into participants (trip_id, display_name, auth_uid)
  values (v_trip.id, v_name, auth.uid())
  returning * into v_participant;

  update trips set last_activity_at = now() where id = v_trip.id;

  return json_build_object(
    'trip_id', v_trip.id,
    'participant_id', v_participant.id,
    'display_name', v_name,
    'is_organizer', false,
    'created', true
  );
end;
$$;

revoke all on function app_join_trip(text, text) from public, anon;
grant execute on function app_join_trip(text, text) to authenticated;
