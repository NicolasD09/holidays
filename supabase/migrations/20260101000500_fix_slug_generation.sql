-- Sprint 1 · Migration 6 — correction de la génération du slug
--
-- `app_slug_candidate` échouait en production avec
-- « function gen_random_bytes(integer) does not exist ».
--
-- Cause : sur Supabase, `pgcrypto` vit dans le schéma `extensions`, pas dans
-- `public`. La fonction a un `search_path` figé à `public` — et c'est une
-- protection qu'on ne veut pas relâcher, puisque c'est elle qui empêche un
-- appelant de détourner la résolution des noms. Le `create extension if not
-- exists pgcrypto` de la migration 1 n'y changeait rien : l'extension étant
-- déjà présente ailleurs, l'instruction ne faisait rien.
--
-- Deux corrections possibles : élargir le `search_path` à `public, extensions`,
-- ou ne plus dépendre de l'extension. On prend la seconde. Élargir le chemin
-- reviendrait à coder en dur l'organisation des schémas de Supabase dans la
-- fonction la plus sensible du produit — exactement le couplage caché qui vient
-- de casser.
--
-- `gen_random_uuid()` est dans le cœur de Postgres depuis la 13 : aucune
-- extension, aucun schéma à deviner. Un UUID v4 porte 122 bits aléatoires sur
-- 16 octets, 6 bits étant figés (version et variante) dans les octets 6 et 8.
-- On écarte ces deux octets et on tire deux UUID pour disposer de 16 octets
-- pleinement aléatoires — soit la même entropie qu'avant, ≈ 93 bits.

create or replace function app_slug_candidate()
returns text language plpgsql volatile set search_path = public as $$
declare
  c_alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  -- Octets d'un UUID v4 exempts de bits figés : tous sauf le 6 et le 8.
  c_usable constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15];
  v_a bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_slug text := '';
  v_byte int;
  v_i int;
begin
  for v_i in 1..16 loop
    if v_i <= 13 then
      v_byte := get_byte(v_a, c_usable[v_i]);
    else
      v_byte := get_byte(v_b, c_usable[v_i - 13]);
    end if;
    v_slug := v_slug || substr(c_alphabet, (v_byte % 58) + 1, 1);
  end loop;
  return v_slug;
end;
$$;

revoke all on function app_slug_candidate() from public, anon, authenticated;
