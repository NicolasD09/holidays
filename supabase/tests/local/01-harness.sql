-- Outillage d'assertion pour les contrôles RLS locaux.
--
-- Chaque contrôle écrit une ligne dans `check_results`. Le script final relit
-- la table et lève une erreur s'il reste un échec : c'est ce qui permet à
-- `psql` de sortir en code non nul, et donc à un enchaînement de commandes de
-- s'arrêter là.

create table check_results (
  id     serial primary key,
  nom    text not null,
  ok     boolean not null,
  detail text
);

grant all on check_results to anon, authenticated;
grant all on sequence check_results_id_seq to anon, authenticated;

/** Le contrôle passe si `stmt` ÉCHOUE. */
create or replace function chk_refuse(p_nom text, p_stmt text)
returns void language plpgsql as $$
begin
  execute p_stmt;
  insert into check_results (nom, ok, detail)
  values (p_nom, false, 'l''opération est passée alors qu''elle devait être refusée');
exception when others then
  insert into check_results (nom, ok, detail) values (p_nom, true, sqlerrm);
end;
$$;

/** Le contrôle passe si `stmt` réussit. */
create or replace function chk_autorise(p_nom text, p_stmt text)
returns void language plpgsql as $$
begin
  execute p_stmt;
  insert into check_results (nom, ok, detail) values (p_nom, true, null);
exception when others then
  insert into check_results (nom, ok, detail) values (p_nom, false, sqlerrm);
end;
$$;

/** Le contrôle passe si les deux valeurs sont égales. */
create or replace function chk_egal(p_nom text, p_obtenu anyelement, p_attendu anyelement)
returns void language plpgsql as $$
begin
  insert into check_results (nom, ok, detail)
  values (
    p_nom,
    p_obtenu is not distinct from p_attendu,
    format('obtenu %s, attendu %s', coalesce(p_obtenu::text, 'null'), coalesce(p_attendu::text, 'null'))
  );
end;
$$;

/** Le contrôle passe si `stmt` affecte exactement `attendu` lignes.
    Le cas qui compte : une écriture bloquée par la RLS n'échoue pas, elle
    affecte zéro ligne. Sans compter, on croirait qu'elle est passée. */
create or replace function chk_lignes(p_nom text, p_stmt text, p_attendu int)
returns void language plpgsql as $$
declare v_count int;
begin
  execute p_stmt;
  get diagnostics v_count = row_count;
  insert into check_results (nom, ok, detail)
  values (p_nom, v_count = p_attendu, format('%s ligne(s) affectée(s), attendu %s', v_count, p_attendu));
exception when others then
  insert into check_results (nom, ok, detail) values (p_nom, false, sqlerrm);
end;
$$;

grant execute on function chk_refuse(text, text) to anon, authenticated;
grant execute on function chk_lignes(text, text, int) to anon, authenticated;
grant execute on function chk_autorise(text, text) to anon, authenticated;
grant execute on function chk_egal(text, anyelement, anyelement) to anon, authenticated;
