-- Sprint 1 · Migration 5 — lecture des résultats
-- Réf. doc 03 §3.8 (vue option_scores) et §3.7 (app_category_results).
--
-- Hors du périmètre littéral du sprint 1, mais la recette du sprint 2 exige
-- « Marie voit le résultat » : sans agrégat côté serveur, cet écran se
-- construirait en comptant les votes dans le navigateur, ce qui casserait le
-- mode aveugle. Mieux vaut la poser ici, avec les tests de sécurité.

-- ────────────────────────────────────────────────────────── option_scores
--
-- `security_invoker = on` : la vue s'évalue sous les droits de l'appelant,
-- donc la RLS de `votes` s'applique. En mode aveugle, un participant qui n'a
-- pas voté ne voit naturellement que ses propres votes — c'est le
-- comportement voulu, l'interface n'affiche pas de score dans cet état.
create view option_scores with (security_invoker = on) as
select
  o.id as option_id,
  o.category_id,
  o.trip_id,
  count(*) filter (where v.value = 1)  as yes_count,
  count(*) filter (where v.value = 0)  as maybe_count,
  count(*) filter (where v.value = -1) as no_count,
  coalesce(sum(case v.value when 1 then 2 when 0 then 1 else 0 end), 0) as score
from options o
left join votes v on v.option_id = o.id
group by o.id;

revoke all on option_scores from anon;
grant select on option_scores to authenticated;

-- ───────────────────────────────────────────────────── app_category_results
--
-- Chemin de lecture privilégié pour l'écran de vote : un aller-retour, un
-- classement déjà trié, et le mode aveugle tranché par une erreur explicite
-- plutôt que par des compteurs à zéro qu'il faudrait interpréter côté client.
create or replace function app_category_results(p_category uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_trip uuid;
  v_result json;
begin
  select trip_id into v_trip from categories where id = p_category;
  if v_trip is null then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if not app_is_participant(v_trip) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if not app_can_see_votes(p_category) then
    raise exception 'blind_mode_active';
  end if;

  select coalesce(json_agg(r order by r.score desc, r.title), '[]'::json)
  into v_result
  from (
    select
      o.id as option_id,
      o.title,
      count(v.id) filter (where v.value = 1)::int  as yes_count,
      count(v.id) filter (where v.value = 0)::int  as maybe_count,
      count(v.id) filter (where v.value = -1)::int as no_count,
      coalesce(sum(case v.value when 1 then 2 when 0 then 1 else 0 end), 0)::int as score,
      count(distinct v.participant_id)::int as voter_count
    from options o
    left join votes v on v.option_id = o.id
    where o.category_id = p_category
    group by o.id, o.title
  ) r;

  return v_result;
end;
$$;

revoke all on function app_category_results(uuid) from public, anon;
grant execute on function app_category_results(uuid) to authenticated;
