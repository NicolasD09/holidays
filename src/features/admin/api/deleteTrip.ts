import { supabase } from '@/lib/supabase'

/**
 * Suppression définitive d'un sondage — `delete` direct, sous RLS.
 *
 * La policy `trips_delete` ne laisse passer que l'organisateur, et les clés
 * étrangères des cinq tables portent `on delete cascade` depuis `trips` :
 * participants, catégories, propositions et votes partent avec. Aucune RPC,
 * aucune migration.
 *
 * **Le piège que ce fichier évite.** Sous RLS, un `delete` qui ne correspond
 * à aucune ligne visible ne lève pas d'erreur : il supprime zéro ligne et
 * réussit. Un non-organisateur verrait donc « c'est supprimé » sans que rien
 * ne le soit. D'où le `.select()` : on exige que la ligne supprimée revienne,
 * et on lève sinon. Sur une action irréversible, un succès qui n'en est pas
 * un est le pire des retours.
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const { data, error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('trip_delete_refused')
}
