-- Contrôles RLS locaux — miroir hors-ligne des tests de sécurité du doc 04 §4.7.
--
-- Ils attaquent les policies depuis la position d'un client : rôle
-- `authenticated` (ou `anon`), aucun privilège de propriétaire. Trois appareils
-- distincts : Marie (organisatrice), Thomas (participant), un intrus.

\set ON_ERROR_STOP on
\pset pager off
\pset footer off

-- Les appels d'assertion ne renvoient rien d'utile : on ne garde à l'écran
-- que le tableau de verdict, en fin de script.
\o /dev/null

insert into auth.users (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'),  -- Marie
  ('bbbbbbbb-0000-4000-8000-000000000002'),  -- Thomas
  ('cccccccc-0000-4000-8000-000000000003');  -- l'intrus

-- ═══════════════════════════════════ Marie crée un sondage et vote

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select app_create_trip('Vacances test', '🏖️', 'Marie') as created \gset
select set_config('t.trip', ((:'created')::json->>'trip_id'), false) as trip,
       set_config('t.pid', ((:'created')::json->>'participant_id'), false) as pid,
       set_config('t.slug', ((:'created')::json->>'slug'), false) as slug \gset
select set_config('t.cat', (select id::text from categories
        where trip_id = current_setting('t.trip')::uuid), false) as cat \gset

insert into options (trip_id, category_id, title, created_by, position)
select current_setting('t.trip')::uuid, current_setting('t.cat')::uuid, v.title,
       current_setting('t.pid')::uuid, v.pos
from (values ('Lisbonne', 0), ('Porto', 1)) as v(title, pos);

select set_config('t.opt1', (select id::text from options
        where category_id = current_setting('t.cat')::uuid and title = 'Lisbonne'), false),
       set_config('t.opt2', (select id::text from options
        where category_id = current_setting('t.cat')::uuid and title = 'Porto'), false) \gset

select app_cast_vote(current_setting('t.opt1')::uuid, 1::smallint),
       app_cast_vote(current_setting('t.opt2')::uuid, -1::smallint) \gset

select chk_egal('slug de 16 caractères base58',
  current_setting('t.slug') ~ '^[1-9A-HJ-NP-Za-km-z]{16}$', true);

-- ═══════════════════════════════════ 1. l'intrus ne lit rien

set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';

select chk_egal('intrus · trips', (select count(*) from trips where id = current_setting('t.trip')::uuid), 0::bigint);
select chk_egal('intrus · participants', (select count(*) from participants where trip_id = current_setting('t.trip')::uuid), 0::bigint);
select chk_egal('intrus · categories', (select count(*) from categories where trip_id = current_setting('t.trip')::uuid), 0::bigint);
select chk_egal('intrus · options', (select count(*) from options where trip_id = current_setting('t.trip')::uuid), 0::bigint);
select chk_egal('intrus · votes', (select count(*) from votes where trip_id = current_setting('t.trip')::uuid), 0::bigint);
select chk_egal('intrus · option_scores', (select count(*) from option_scores where trip_id = current_setting('t.trip')::uuid), 0::bigint);

select chk_refuse('intrus · voter',
  format('select app_cast_vote(%L::uuid, 1::smallint)', current_setting('t.opt1')));
select chk_refuse('intrus · s''inscrire lui-même',
  format('insert into participants (trip_id, display_name) values (%L::uuid, ''Intrus'')', current_setting('t.trip')));
select chk_refuse('intrus · forger un sondage',
  'insert into trips (slug, title) values (''intrusintrusintr'', ''Forgé'')');
select chk_refuse('intrus · lire les résultats',
  format('select app_category_results(%L::uuid)', current_setting('t.cat')));

-- ═══════════════════════════════════ 1bis. sans session (rôle anon)

reset role;
set role anon;

select chk_egal('anon · aperçu accessible avec le slug',
  (app_trip_preview(current_setting('t.slug'))::jsonb ->> 'title'), 'Vacances test');
select chk_egal('anon · aperçu sans propositions',
  (app_trip_preview(current_setting('t.slug'))::jsonb ? 'options'), false);
select chk_refuse('anon · slug inconnu', 'select app_trip_preview(''slugquinexistepas'')');
select chk_refuse('anon · lire trips', 'select count(*) from trips');
select chk_refuse('anon · créer un sondage', 'select app_create_trip(''Forgé'', ''🏖️'', ''Anon'')');
select chk_refuse('anon · rejoindre',
  format('select app_join_trip(%L, ''Anon'')', current_setting('t.slug')));

-- ═══════════════════════════════════ 2. mode aveugle

reset role;
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update trips set blind_mode = true where id = current_setting('t.trip')::uuid;

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select app_join_trip(current_setting('t.slug'), 'Thomas') \gset

select chk_egal('aveugle · aucun vote d''autrui visible',
  (select count(*) from votes where trip_id = current_setting('t.trip')::uuid), 0::bigint);
select chk_egal('aveugle · aucun score ne fuit par la vue',
  (select coalesce(sum(yes_count + maybe_count + no_count), 0)::bigint
   from option_scores where trip_id = current_setting('t.trip')::uuid), 0::bigint);
select chk_refuse('aveugle · résultats refusés avant de voter',
  format('select app_category_results(%L::uuid)', current_setting('t.cat')));

select app_cast_vote(current_setting('t.opt1')::uuid, 1::smallint) \gset

select chk_autorise('aveugle · résultats ouverts après avoir voté',
  format('select app_category_results(%L::uuid)', current_setting('t.cat')));
select chk_egal('aveugle · le gagnant compte bien 2 oui',
  ((app_category_results(current_setting('t.cat')::uuid)::jsonb -> 0 ->> 'yes_count')::int), 2);

-- ═══════════════════════════════════ 3. non-organisateur

select chk_lignes('non-organisateur · renommer le sondage',
  format('update trips set title = ''Détourné'' where id = %L::uuid', current_setting('t.trip')), 0);
select chk_lignes('non-organisateur · désactiver le mode aveugle',
  format('update trips set blind_mode = false where id = %L::uuid', current_setting('t.trip')), 0);
select chk_lignes('non-organisateur · clôturer une catégorie',
  format('update categories set status = ''closed'' where id = %L::uuid', current_setting('t.cat')), 0);
select chk_lignes('non-organisateur · supprimer le sondage',
  format('delete from trips where id = %L::uuid', current_setting('t.trip')), 0);

select chk_refuse('non-organisateur · se promouvoir organisateur',
  format('update participants set is_organizer = true where trip_id = %L::uuid and auth_uid = auth.uid()',
         current_setting('t.trip')));
select chk_refuse('non-organisateur · voter à la place d''un autre',
  format('insert into votes (trip_id, category_id, option_id, participant_id, value) values (%L::uuid, %L::uuid, %L::uuid, %L::uuid, 1)',
         current_setting('t.trip'), current_setting('t.cat'),
         current_setting('t.opt2'), current_setting('t.pid')));

-- ═══════════════════════════════════ 4. règles métier

select chk_autorise('participant · ajouter une proposition',
  format('insert into options (trip_id, category_id, title, created_by) values (%L::uuid, %L::uuid, ''Séville'', app_current_participant(%L::uuid))',
         current_setting('t.trip'), current_setting('t.cat'), current_setting('t.trip')));
select chk_refuse('participant · proposer au nom d''un autre',
  format('insert into options (trip_id, category_id, title, created_by) values (%L::uuid, %L::uuid, ''Usurpée'', %L::uuid)',
         current_setting('t.trip'), current_setting('t.cat'), current_setting('t.pid')));

select app_join_trip(current_setting('t.slug'), 'Marie') \gset
select chk_egal('adhésion · idempotente (toujours 2 participants)',
  (select count(*) from participants where trip_id = current_setting('t.trip')::uuid), 2::bigint);

select chk_refuse('vote · valeur hors -1/0/1',
  format('select app_cast_vote(%L::uuid, 5::smallint)', current_setting('t.opt1')));

set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update categories set status = 'closed' where id = current_setting('t.cat')::uuid;
select chk_refuse('vote · catégorie clôturée',
  format('select app_cast_vote(%L::uuid, 1::smallint)', current_setting('t.opt1')));
select chk_egal('clôturée · scores visibles de tous',
  app_can_see_votes(current_setting('t.cat')::uuid), true);
update categories set status = 'open' where id = current_setting('t.cat')::uuid;

select chk_autorise('vote · retrait',
  format('select app_retract_vote(%L::uuid)', current_setting('t.opt1')));
select chk_egal('retrait · un seul vote de Marie restant',
  (select count(*) from votes where participant_id = current_setting('t.pid')::uuid), 1::bigint);

select chk_egal('last_activity_at mis à jour par les votes',
  (select last_activity_at > created_at from trips where id = current_setting('t.trip')::uuid), true);

update categories set vote_mode = 'single' where id = current_setting('t.cat')::uuid;
select app_cast_vote(current_setting('t.opt1')::uuid, 1::smallint) \gset
select app_cast_vote(current_setting('t.opt2')::uuid, 1::smallint) \gset
select chk_egal('mode single · un vote remplace le précédent',
  (select count(*) from votes
   where participant_id = current_setting('t.pid')::uuid
     and category_id = current_setting('t.cat')::uuid), 1::bigint);

update categories set vote_mode = 'multiple', max_choices = 1 where id = current_setting('t.cat')::uuid;
select chk_refuse('mode multiple · plafond de choix',
  format('select app_cast_vote(%L::uuid, 1::smallint)', current_setting('t.opt1')));

-- ═══════════════════════════════════ verdict

reset role;
\o

\echo ''
select id, case when ok then '✓' else '✗' end as etat, nom, case when ok then null else detail end as echec
from check_results order by id;

\echo ''
select count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echecs from check_results;

do $$
declare v_echecs int;
begin
  select count(*) into v_echecs from check_results where not ok;
  if v_echecs > 0 then
    raise exception '% contrôle(s) RLS en échec', v_echecs;
  end if;
  raise notice 'Tous les contrôles RLS passent.';
end $$;
