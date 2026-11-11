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
-- Depuis la migration 9, `status` ne s'écrit plus directement, pour personne :
-- l'`update` brut est refusé avant même la policy, et la RPC exige d'être
-- organisateur.
select chk_refuse('non-organisateur · clôturer une catégorie (update direct)',
  format('update categories set status = ''closed'' where id = %L::uuid', current_setting('t.cat')));
select chk_refuse('non-organisateur · clôturer une catégorie (RPC)',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.cat'), current_setting('t.opt1')));
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
select app_close_category(current_setting('t.cat')::uuid, current_setting('t.opt1')::uuid) \gset
select chk_refuse('vote · catégorie clôturée',
  format('select app_cast_vote(%L::uuid, 1::smallint)', current_setting('t.opt1')));
select chk_egal('clôturée · scores visibles de tous',
  app_can_see_votes(current_setting('t.cat')::uuid), true);
select app_reopen_category(current_setting('t.cat')::uuid) \gset

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

-- ═══════════════════════════════════ 7. disponibilités (sprint 4)

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

-- La configuration de la fenêtre est validée à la création, avec un code
-- lisible plutôt qu'une violation de contrainte.
select chk_refuse('dates · fenêtre absente refusée',
  $q$select app_create_trip('D', '📅', 'Marie',
      '[{"kind":"dates","label":"Dates","vote_mode":"availability"}]'::jsonb)$q$);

select chk_refuse('dates · fenêtre plus courte que le séjour',
  $q$select app_create_trip('D', '📅', 'Marie',
      '[{"kind":"dates","label":"Dates","vote_mode":"availability",
         "window_start":"2027-07-01","window_end":"2027-07-05","nights":7}]'::jsonb)$q$);

select app_create_trip('Vacances dates', '📅', 'Marie',
  '[{"kind":"dates","label":"Dates","vote_mode":"availability",
     "window_start":"2027-07-01","window_end":"2027-07-31","nights":7}]'::jsonb) as d \gset
select set_config('t.dtrip', ((:'d')::json->>'trip_id'), false),
       set_config('t.dpid',  ((:'d')::json->>'participant_id'), false),
       set_config('t.dslug', ((:'d')::json->>'slug'), false) \gset
select set_config('t.dcat', (select id::text from categories
        where trip_id = current_setting('t.dtrip')::uuid), false) \gset

select chk_egal('dates · fenêtre et nuits enregistrées',
  (select window_start::text || '/' || window_end::text || '/' || nights::text
   from categories where id = current_setting('t.dcat')::uuid),
  '2027-07-01/2027-07-31/7');

-- Écriture en masse, puis effacement d'un jour par un statut nul.
select app_set_availability(current_setting('t.dcat')::uuid,
  '[{"day":"2027-07-10","status":"yes"},
    {"day":"2027-07-11","status":"maybe"},
    {"day":"2027-07-12","status":"no"}]'::jsonb) \gset

select chk_egal('dispos · trois jours peints',
  (select count(*) from availabilities where category_id = current_setting('t.dcat')::uuid), 3::bigint);

select app_set_availability(current_setting('t.dcat')::uuid,
  '[{"day":"2027-07-12"}]'::jsonb) \gset
select chk_egal('dispos · un statut nul efface le jour',
  (select count(*) from availabilities where category_id = current_setting('t.dcat')::uuid), 2::bigint);

select chk_refuse('dispos · jour hors fenêtre',
  format('select app_set_availability(%L::uuid, ''[{"day":"2027-08-15","status":"yes"}]''::jsonb)',
         current_setting('t.dcat')));

select chk_refuse('dispos · statut inconnu',
  format('select app_set_availability(%L::uuid, ''[{"day":"2027-07-14","status":"peut-etre"}]''::jsonb)',
         current_setting('t.dcat')));

-- ── l'intrus ne voit rien et n'écrit rien
set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';

select chk_egal('intrus · availabilities',
  (select count(*) from availabilities where trip_id = current_setting('t.dtrip')::uuid), 0::bigint);

select chk_refuse('intrus · app_set_availability',
  format('select app_set_availability(%L::uuid, ''[{"day":"2027-07-10","status":"yes"}]''::jsonb)',
         current_setting('t.dcat')));

-- Un `insert` refusé par une clause `with check` **lève** : contrairement à
-- un `update`, il ne se contente pas de ne toucher aucune ligne.
select chk_refuse('intrus · insert direct dans availabilities',
  format('insert into availabilities (trip_id, category_id, participant_id, day, status)
          values (%L::uuid, %L::uuid, %L::uuid, ''2027-07-20'', ''yes'')',
         current_setting('t.dtrip'), current_setting('t.dcat'), current_setting('t.dpid')));

-- ── Thomas rejoint : il voit celles de Marie, mais n'écrit que les siennes
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select app_join_trip(current_setting('t.dslug'), 'Thomas') as j \gset
select set_config('t.tpid', ((:'j')::json->>'participant_id'), false) \gset

select chk_egal('participant · voit les dispos des autres (mode ouvert)',
  (select count(*) from availabilities where category_id = current_setting('t.dcat')::uuid), 2::bigint);

select chk_refuse('participant · ne peut pas peindre pour autrui',
  format('insert into availabilities (trip_id, category_id, participant_id, day, status)
          values (%L::uuid, %L::uuid, %L::uuid, ''2027-07-21'', ''yes'')',
         current_setting('t.dtrip'), current_setting('t.dcat'), current_setting('t.dpid')));

-- ── mode aveugle : la dette n° 4 du doc 09
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update trips set blind_mode = true where id = current_setting('t.dtrip')::uuid;

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select chk_egal('aveugle · Thomas n''a rien peint, il ne voit rien',
  (select count(*) from availabilities
   where category_id = current_setting('t.dcat')::uuid
     and participant_id <> current_setting('t.tpid')::uuid), 0::bigint);

select app_set_availability(current_setting('t.dcat')::uuid,
  '[{"day":"2027-07-10","status":"yes"}]'::jsonb) \gset

select chk_egal('aveugle · peindre suffit à voir les autres (dette n° 4)',
  (select count(*) from availabilities
   where category_id = current_setting('t.dcat')::uuid
     and participant_id <> current_setting('t.tpid')::uuid), 2::bigint);

-- ── catégorie clôturée
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select app_close_category(current_setting('t.dcat')::uuid, p_free_text => 'Plus tard') \gset

select chk_refuse('dispos · catégorie clôturée',
  format('select app_set_availability(%L::uuid, ''[{"day":"2027-07-15","status":"yes"}]''::jsonb)',
         current_setting('t.dcat')));

-- ═══════════════════════════════════ 8. budget (sprint 6)
--
-- Test de sécurité n° 2 du doc 04 §4.7 : le montant d'autrui est illisible,
-- **y compris pour l'organisateur**. Marie organise ; Thomas, Sarah et Julien
-- répondent ; l'intrus reste dehors.

reset role;
insert into auth.users (id) values
  ('dddddddd-0000-4000-8000-000000000004'),  -- Sarah
  ('eeeeeeee-0000-4000-8000-000000000005');  -- Julien

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select app_create_trip('Vacances budget', '💶', 'Marie',
  '[{"kind":"destination","label":"Destination","vote_mode":"approval"},
    {"kind":"budget","label":"Budget","vote_mode":"amount",
     "description":"  Par personne, hors transport  ","allow_participant_options":true}]'::jsonb) as b \gset
select set_config('t.btrip', ((:'b')::json->>'trip_id'), false),
       set_config('t.bpid',  ((:'b')::json->>'participant_id'), false),
       set_config('t.bslug', ((:'b')::json->>'slug'), false) \gset
select set_config('t.bcat', (select id::text from categories
        where trip_id = current_setting('t.btrip')::uuid and vote_mode = 'amount'), false),
       set_config('t.bdest', (select id::text from categories
        where trip_id = current_setting('t.btrip')::uuid and vote_mode = 'approval'), false) \gset

select chk_egal('budget · catégorie créée, description rognée, propositions fermées',
  (select description || '/' || allow_participant_options::text || '/' || currency
   from categories where id = current_setting('t.bcat')::uuid),
  'Par personne, hors transport/false/EUR');

select chk_refuse('budget · description trop longue refusée',
  format($q$select app_create_trip('B', '💶', 'Marie',
      jsonb_build_array(jsonb_build_object('kind','budget','label','Budget',
        'vote_mode','amount','description', repeat('x', 1001))))$q$));

-- ── écriture : par la RPC, et seulement par elle
select chk_refuse('budget · montant négatif',
  format('select app_set_budget(%L::uuid, -1)', current_setting('t.bcat')));
select chk_refuse('budget · montant au-delà du plafond',
  format('select app_set_budget(%L::uuid, 1000001)', current_setting('t.bcat')));
select chk_refuse('budget · refusé dans une catégorie qui n''est pas un budget',
  format('select app_set_budget(%L::uuid, 500)', current_setting('t.bdest')));
select chk_refuse('budget · résumé refusé hors catégorie budget',
  format('select app_budget_summary(%L::uuid)', current_setting('t.bdest')));

select chk_refuse('budget · insert direct refusé, même pour soi',
  format('insert into budget_answers (trip_id, category_id, participant_id, amount)
          values (%L::uuid, %L::uuid, %L::uuid, 500)',
         current_setting('t.btrip'), current_setting('t.bcat'), current_setting('t.bpid')));

-- ── avant de répondre : le résumé ne s'ouvre pas
select chk_egal('budget · sans réponse, le résumé demande de répondre d''abord',
  (select app_budget_summary(current_setting('t.bcat')::uuid)->>'status'), 'answer_first');

-- ── Thomas, Sarah et Julien rejoignent et répondent
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select app_join_trip(current_setting('t.bslug'), 'Thomas') as j \gset
select set_config('t.btpid', ((:'j')::json->>'participant_id'), false) \gset
select app_set_budget(current_setting('t.bcat')::uuid, 900) \gset

select chk_egal('budget · je relis mon propre montant',
  (select amount from budget_answers where category_id = current_setting('t.bcat')::uuid), 900);

select app_set_budget(current_setting('t.bcat')::uuid, 950) \gset
select chk_egal('budget · une nouvelle réponse remplace la précédente',
  (select string_agg(amount::text, ',') from budget_answers
   where category_id = current_setting('t.bcat')::uuid), '950');

select chk_egal('budget · 1 réponse : résumé insuffisant, sans aucun montant',
  (select app_budget_summary(current_setting('t.bcat')::uuid)::text),
  '{"status" : "insufficient", "respondents" : 1, "answered" : true}');

set request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000004';
select app_join_trip(current_setting('t.bslug'), 'Sarah') \gset
select app_set_budget(current_setting('t.bcat')::uuid, 700) \gset

select chk_egal('budget · Sarah ne voit que sa ligne',
  (select string_agg(amount::text, ',') from budget_answers
   where trip_id = current_setting('t.btrip')::uuid), '700');

select chk_egal('budget · 2 réponses : toujours insuffisant (RM-10)',
  (select app_budget_summary(current_setting('t.bcat')::uuid)->>'status'), 'insufficient');

-- ── l'organisatrice, à 2 réponses puis à 3 : jamais un montant d'autrui
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select chk_egal('ORGANISATEUR · ne lit aucune ligne de budget_answers',
  (select count(*) from budget_answers where trip_id = current_setting('t.btrip')::uuid), 0::bigint);

select chk_egal('ORGANISATEUR · ne lit pas non plus en visant un participant',
  (select count(*) from budget_answers
   where participant_id = current_setting('t.btpid')::uuid), 0::bigint);

-- Ici l'écriture ne « touche zéro ligne » pas : elle est refusée d'emblée,
-- faute de `grant`. La policy n'est même pas consultée.
select chk_refuse('ORGANISATEUR · ne modifie pas le montant d''autrui',
  format('update budget_answers set amount = 1 where category_id = %L::uuid',
         current_setting('t.bcat')));
select chk_refuse('ORGANISATEUR · ne supprime pas le montant d''autrui',
  format('delete from budget_answers where category_id = %L::uuid',
         current_setting('t.bcat')));

select chk_egal('ORGANISATEUR · sans réponse, pas de résumé non plus',
  (select app_budget_summary(current_setting('t.bcat')::uuid)->>'status'), 'answer_first');

set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000005';
select app_join_trip(current_setting('t.bslug'), 'Julien') \gset
select app_set_budget(current_setting('t.bcat')::uuid, 1200) \gset

select chk_egal('budget · 3 réponses : résumé prêt, agrégats exacts',
  (select (s->>'status') || '/' || (s->>'respondents') || '/' || (s->>'min') || '/' ||
          (s->>'median') || '/' || (s->>'max') || '/' || (s->>'step')
   from app_budget_summary(current_setting('t.bcat')::uuid) as s),
  'ready/3/700/950/1200/25');

select chk_egal('budget · la courbe part de « tout le monde suit »',
  (select (s->'curve'->0)::text from app_budget_summary(current_setting('t.bcat')::uuid) as s),
  '{"amount" : 700, "followers" : 3}');

select chk_egal('budget · à 950 €, 2 personnes suivent ; à 975 €, une seule',
  (select string_agg(p->>'followers', ',' order by (p->>'amount')::int)
   from app_budget_summary(current_setting('t.bcat')::uuid) as s,
        json_array_elements(s->'curve') as p
   where (p->>'amount')::int in (950, 975)), '2,1');

select chk_egal('budget · le résumé ne contient ni prénom ni identifiant',
  (select s::text ~* '(participant|display_name|thomas|sarah|julien|[0-9a-f]{8}-[0-9a-f]{4})'
   from app_budget_summary(current_setting('t.bcat')::uuid) as s), false);

select chk_egal('budget · Julien ne voit toujours que sa ligne',
  (select count(*) from budget_answers where trip_id = current_setting('t.btrip')::uuid), 1::bigint);

-- ── l'intrus
set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';
select chk_egal('intrus · budget_answers',
  (select count(*) from budget_answers where trip_id = current_setting('t.btrip')::uuid), 0::bigint);
select chk_refuse('intrus · app_budget_summary',
  format('select app_budget_summary(%L::uuid)', current_setting('t.bcat')));
select chk_refuse('intrus · app_set_budget',
  format('select app_set_budget(%L::uuid, 100)', current_setting('t.bcat')));

-- ── sans session
set role anon;
reset request.jwt.claim.sub;
select chk_refuse('anon · budget_answers illisible',
  'select count(*) from budget_answers');
select chk_refuse('anon · app_budget_summary',
  format('select app_budget_summary(%L::uuid)', current_setting('t.bcat')));
set role authenticated;

-- ── retirer sa réponse repasse sous le seuil
set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000005';
select app_set_budget(current_setting('t.bcat')::uuid, null) \gset
select chk_egal('budget · un montant nul retire la réponse',
  (select count(*) from budget_answers where category_id = current_setting('t.bcat')::uuid), 0::bigint);

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select chk_egal('budget · sous 3 réponses, le résumé se referme',
  (select app_budget_summary(current_setting('t.bcat')::uuid)->>'status'), 'insufficient');

set request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000005';
select app_set_budget(current_setting('t.bcat')::uuid, 1200) \gset

-- ── mode aveugle et clôture : ni l'un ni l'autre n'ouvre les montants
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update trips set blind_mode = true where id = current_setting('t.btrip')::uuid;
select app_close_category(current_setting('t.bcat')::uuid, p_payload => '{"amount": 750}'::jsonb) \gset

select chk_egal('ORGANISATEUR · catégorie clôturée : toujours aucune ligne',
  (select count(*) from budget_answers where trip_id = current_setting('t.btrip')::uuid), 0::bigint);

select chk_egal('budget · clôturée : le résumé s''ouvre à qui n''a pas répondu, en agrégat',
  (select (s->>'status') || '/' || (s->>'answered')
   from app_budget_summary(current_setting('t.bcat')::uuid) as s), 'ready/false');

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select chk_refuse('budget · catégorie clôturée : plus d''écriture',
  format('select app_set_budget(%L::uuid, 100)', current_setting('t.bcat')));

-- ═══════════════════════════════════ 9. clôture et décisions (sprint 7)
--
-- Marie organise un sondage Destination + Dates + Budget ; Thomas participe ;
-- l'intrus reste dehors. Ce qui compte : seule l'organisatrice tranche, une
-- catégorie tranchée ne reçoit plus rien, et la participation se compte en
-- base — juste même en mode aveugle.

set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select app_create_trip('Vacances finales', '🌍', 'Marie',
  '[{"kind":"destination","label":"Destination","vote_mode":"approval"},
    {"kind":"dates","label":"Dates","vote_mode":"availability",
     "window_start":"2027-07-01","window_end":"2027-07-31","nights":7},
    {"kind":"budget","label":"Budget","vote_mode":"amount"}]'::jsonb) as f \gset
select set_config('t.ftrip', ((:'f')::json->>'trip_id'), false),
       set_config('t.fpid',  ((:'f')::json->>'participant_id'), false),
       set_config('t.fslug', ((:'f')::json->>'slug'), false) \gset
select set_config('t.fdest', (select id::text from categories
        where trip_id = current_setting('t.ftrip')::uuid and vote_mode = 'approval'), false),
       set_config('t.fdates', (select id::text from categories
        where trip_id = current_setting('t.ftrip')::uuid and vote_mode = 'availability'), false),
       set_config('t.fbud', (select id::text from categories
        where trip_id = current_setting('t.ftrip')::uuid and vote_mode = 'amount'), false) \gset

insert into options (trip_id, category_id, title, created_by, position)
select current_setting('t.ftrip')::uuid, current_setting('t.fdest')::uuid, v.title,
       current_setting('t.fpid')::uuid, v.pos
from (values ('Lisbonne', 0), ('Porto', 1)) as v(title, pos);
select set_config('t.flis', (select id::text from options
        where category_id = current_setting('t.fdest')::uuid and title = 'Lisbonne'), false),
       set_config('t.fpor', (select id::text from options
        where category_id = current_setting('t.fdest')::uuid and title = 'Porto'), false) \gset

-- Une proposition d'un **autre** sondage, pour tenter de trancher avec.
select set_config('t.foreign_opt', current_setting('t.opt2'), false) \gset

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select app_join_trip(current_setting('t.fslug'), 'Thomas') \gset
select set_config('t.fthomas', (select id::text from participants
        where trip_id = current_setting('t.ftrip')::uuid and auth_uid = auth.uid()), false) \gset
select app_cast_vote(current_setting('t.fpor')::uuid, 1::smallint) \gset
select app_set_availability(current_setting('t.fdates')::uuid,
  '[{"day":"2027-07-10","status":"yes"},{"day":"2027-07-11","status":"yes"}]'::jsonb) \gset

-- ── seule l'organisatrice tranche
select chk_refuse('clôture · un participant ne clôture pas',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.fdest'), current_setting('t.fpor')));
select chk_refuse('clôture · un participant ne rouvre pas',
  format('select app_reopen_category(%L::uuid)', current_setting('t.fdest')));

set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';
select chk_refuse('intrus · clôturer',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.fdest'), current_setting('t.fpor')));
select chk_refuse('intrus · participation',
  format('select app_trip_participation(%L::uuid)', current_setting('t.ftrip')));

-- ── aucune porte dérobée, même pour l'organisatrice
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select chk_refuse('ORGANISATEUR · insert direct dans decisions',
  format('insert into decisions (trip_id, category_id, free_text) values (%L::uuid, %L::uuid, ''x'')',
         current_setting('t.ftrip'), current_setting('t.fdest')));
select chk_refuse('ORGANISATEUR · status d''une catégorie en update direct',
  format('update categories set status = ''closed'' where id = %L::uuid', current_setting('t.fdest')));
select chk_refuse('ORGANISATEUR · status du sondage en update direct',
  format('update trips set status = ''closed'' where id = %L::uuid', current_setting('t.ftrip')));
select chk_refuse('ORGANISATEUR · slug réécrit à la main',
  format('update trips set slug = ''AAAAAAAAAAAAAAAA'' where id = %L::uuid', current_setting('t.ftrip')));
select chk_lignes('ORGANISATEUR · titre et mode aveugle restent modifiables',
  format('update trips set title = ''Vacances finales !'', blind_mode = false where id = %L::uuid',
         current_setting('t.ftrip')), 1);

-- ── une décision, une seule forme
select chk_refuse('décision · ni proposition ni texte',
  format('select app_close_category(%L::uuid)', current_setting('t.fdest')));
select chk_refuse('décision · proposition ET texte',
  format('select app_close_category(%L::uuid, %L::uuid, ''Ailleurs'')', current_setting('t.fdest'), current_setting('t.flis')));
select chk_refuse('décision · proposition d''un autre sondage',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.fdest'), current_setting('t.foreign_opt')));
select chk_refuse('décision · créneau sur une catégorie destination',
  format('select app_close_category(%L::uuid, p_payload => ''{"start":"2027-07-10","end":"2027-07-17"}''::jsonb)',
         current_setting('t.fdest')));
select chk_refuse('décision · texte de plus de 200 caractères',
  format('select app_close_category(%L::uuid, p_free_text => repeat(''x'', 201))', current_setting('t.fdest')));

-- ── l'organisatrice tranche, même contre la tête de liste
select chk_autorise('clôture · sur une proposition qui n''est pas en tête',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.fdest'), current_setting('t.flis')));
select chk_egal('clôture · décision écrite, titre recopié, catégorie clôturée',
  (select d.payload->>'title' || '/' || c.status::text || '/' || (d.decided_by::text = current_setting('t.fpid'))::text
   from decisions d join categories c on c.id = d.category_id
   where d.category_id = current_setting('t.fdest')::uuid),
  'Lisbonne/closed/true');
select chk_refuse('clôture · deux fois de suite',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.fdest'), current_setting('t.fpor')));
select chk_egal('clôture · le sondage reste ouvert tant qu''une catégorie l''est',
  (select status::text from trips where id = current_setting('t.ftrip')::uuid), 'open');

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select chk_egal('clôture · la décision est lisible par les participants',
  (select count(*) from decisions where trip_id = current_setting('t.ftrip')::uuid), 1::bigint);
select chk_refuse('clôture · plus de vote, côté serveur',
  format('select app_cast_vote(%L::uuid, 1::smallint)', current_setting('t.flis')));
-- Sous RLS, un `delete` bloqué ne lève rien : il affecte zéro ligne.
select chk_lignes('clôture · plus de retrait de vote non plus',
  format('delete from votes where option_id = %L::uuid', current_setting('t.fpor')), 0);

set request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';
select chk_egal('intrus · decisions illisibles',
  (select count(*) from decisions where trip_id = current_setting('t.ftrip')::uuid), 0::bigint);

-- ── dates et budget
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select chk_refuse('décision dates · créneau hors fenêtre',
  format('select app_close_category(%L::uuid, p_payload => ''{"start":"2027-06-28","end":"2027-07-05"}''::jsonb)',
         current_setting('t.fdates')));
select chk_refuse('décision dates · fin avant début',
  format('select app_close_category(%L::uuid, p_payload => ''{"start":"2027-07-17","end":"2027-07-10"}''::jsonb)',
         current_setting('t.fdates')));
select chk_refuse('décision dates · proposition au lieu d''un créneau',
  format('select app_close_category(%L::uuid, %L::uuid)', current_setting('t.fdates'), current_setting('t.flis')));
select chk_refuse('décision budget · montant négatif',
  format('select app_close_category(%L::uuid, p_payload => ''{"amount": -1}''::jsonb)', current_setting('t.fbud')));
select chk_refuse('décision budget · montant non numérique',
  format('select app_close_category(%L::uuid, p_payload => ''{"amount": "beaucoup"}''::jsonb)', current_setting('t.fbud')));

select chk_autorise('décision dates · créneau dans la fenêtre',
  format('select app_close_category(%L::uuid, p_payload => ''{"start":"2027-07-10","end":"2027-07-17","bruit":1}''::jsonb)',
         current_setting('t.fdates')));
select chk_egal('décision dates · payload normalisé',
  (select payload from decisions where category_id = current_setting('t.fdates')::uuid),
  '{"start": "2027-07-10", "end": "2027-07-17"}'::jsonb);
select chk_refuse('dates clôturées · la fenêtre ne bouge plus',
  format('update categories set window_end = ''2027-08-15'' where id = %L::uuid', current_setting('t.fdates')));

select chk_egal('clôture · avant la dernière, le sondage est toujours ouvert',
  (select status::text from trips where id = current_setting('t.ftrip')::uuid), 'open');
select chk_autorise('décision budget · un montant',
  format('select app_close_category(%L::uuid, p_payload => ''{"amount": 750}''::jsonb)', current_setting('t.fbud')));
select chk_egal('clôture · la dernière catégorie clôture le sondage',
  (select status::text from trips where id = current_setting('t.ftrip')::uuid), 'closed');

-- ── rouvrir
select chk_autorise('réouverture · par l''organisatrice',
  format('select app_reopen_category(%L::uuid)', current_setting('t.fdest')));
select chk_egal('réouverture · décision supprimée, catégorie et sondage rouverts',
  (select count(*)::text || '/' ||
          (select status::text from categories where id = current_setting('t.fdest')::uuid) || '/' ||
          (select status::text from trips where id = current_setting('t.ftrip')::uuid)
   from decisions where category_id = current_setting('t.fdest')::uuid),
  '0/open/open');
select chk_autorise('réouverture · idempotente',
  format('select app_reopen_category(%L::uuid)', current_setting('t.fdest')));

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select chk_autorise('réouverture · les votes redeviennent modifiables',
  format('select app_cast_vote(%L::uuid, 0::smallint)', current_setting('t.fpor')));

-- ── participation : juste même en mode aveugle
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update trips set blind_mode = true where id = current_setting('t.ftrip')::uuid;

select chk_egal('aveugle · Marie, qui n''a pas voté, ne lit aucun vote de Thomas',
  (select count(*) from votes where category_id = current_setting('t.fdest')::uuid), 0::bigint);
select chk_egal('aveugle · mais la participation compte Thomas',
  (select (p->current_setting('t.fdest')->>'count') || '/' ||
          (p->current_setting('t.fdest')->'respondents'->>0 = current_setting('t.fthomas'))::text
   from app_trip_participation(current_setting('t.ftrip')::uuid) as p),
  '1/true');
select chk_egal('participation · ne renvoie que des identifiants, aucun vote',
  (select (select array_agg(k order by k) from json_object_keys(p->current_setting('t.fdest')) as k)::text
   from app_trip_participation(current_setting('t.ftrip')::uuid) as p),
  '{count,respondents}');

set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select app_reopen_category(current_setting('t.fbud')::uuid) \gset
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select app_set_budget(current_setting('t.fbud')::uuid, 900) \gset
select chk_egal('participation budget · un nombre, aucun identifiant (ADR-006)',
  (select (p->current_setting('t.fbud')->>'count') || '/' ||
          json_array_length(p->current_setting('t.fbud')->'respondents')::text
   from app_trip_participation(current_setting('t.ftrip')::uuid) as p),
  '1/0');

-- ── cohérence d'une catégorie, désormais tenue en base
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select app_reopen_category(current_setting('t.fdates')::uuid) \gset
select chk_refuse('catégorie · le mode du budget ne change pas',
  format('update categories set vote_mode = ''approval'' where id = %L::uuid', current_setting('t.fbud')));
select chk_refuse('catégorie · une destination ne devient pas un budget',
  format('update categories set vote_mode = ''amount'' where id = %L::uuid', current_setting('t.fdest')));
select chk_lignes('catégorie · approbation → choix unique reste permis',
  format('update categories set vote_mode = ''single'' where id = %L::uuid', current_setting('t.fdest')), 1);
select chk_refuse('fenêtre · plus courte que le séjour',
  format('update categories set window_end = ''2027-07-05'' where id = %L::uuid', current_setting('t.fdates')));
select chk_lignes('fenêtre · réduite par l''organisatrice',
  format('update categories set window_start = ''2027-07-12'' where id = %L::uuid', current_setting('t.fdates')), 1);
-- Compté hors RLS : en mode aveugle, Marie ne lirait pas les jours de Thomas.
reset role;
select chk_egal('fenêtre · réduire ne supprime aucun jour peint',
  (select count(*) from availabilities where category_id = current_setting('t.fdates')::uuid), 2::bigint);
set role authenticated;
select chk_egal('fenêtre · des jours hors fenêtre ne comptent plus dans la participation',
  (select p->current_setting('t.fdates')->>'count'
   from app_trip_participation(current_setting('t.ftrip')::uuid) as p), '0');

set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
select chk_lignes('fenêtre · un participant ne la modifie pas',
  format('update categories set window_start = ''2027-07-01'' where id = %L::uuid', current_setting('t.fdates')), 0);

-- ── off-by-one (dette n° 2 du doc 15) : 401 jours passent, 402 non
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
update categories set window_start = '2027-01-01', window_end = '2028-02-05'
 where id = current_setting('t.fdates')::uuid;
select chk_egal('fenêtre maximale · 400 jours d''écart, 401 jours',
  (select window_end - window_start + 1 from categories where id = current_setting('t.fdates')::uuid), 401);
select chk_autorise('off-by-one · « Tout dispo » sur 401 jours passe',
  format($q$select app_set_availability(%L::uuid,
    (select jsonb_agg(jsonb_build_object('day', d::date, 'status', 'yes'))
     from generate_series('2027-01-01'::date, '2028-02-05'::date, interval '1 day') d))$q$,
    current_setting('t.fdates')));
select chk_refuse('off-by-one · 402 jours restent refusés',
  format($q$select app_set_availability(%L::uuid,
    (select jsonb_agg(jsonb_build_object('day', '2027-01-01'::date, 'status', 'yes'))
     from generate_series(1, 402)))$q$,
    current_setting('t.fdates')));

-- ── un sondage tranché se supprime quand même
select app_close_category(current_setting('t.fdest')::uuid, current_setting('t.flis')::uuid) \gset
select app_close_category(current_setting('t.fdates')::uuid, p_free_text => 'Juillet') \gset
select chk_lignes('suppression · un sondage aux catégories tranchées part en entier',
  format('delete from trips where id = %L::uuid', current_setting('t.ftrip')), 1);
reset role;
select chk_egal('suppression · aucune décision orpheline',
  (select count(*) from decisions where trip_id = current_setting('t.ftrip')::uuid), 0::bigint);
set role authenticated;

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
