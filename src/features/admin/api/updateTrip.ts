import { supabase } from '@/lib/supabase'
import type { Trip } from '@/types/domain'

/**
 * Le sondage lui-même, pour l'écran de réglages (tâche 5.5).
 *
 * L'aperçu (`app_trip_preview`) ne porte ni `blind_mode` ni rien de ce qui ne
 * regarde que l'organisateur ; on relit donc la ligne, sous RLS — la policy
 * `trips_select` l'ouvre à tout participant.
 */
export async function fetchTripDetails(tripId: string): Promise<Trip> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (error) throw error
  return data
}

/**
 * Ce que l'organisateur peut modifier en direct. Depuis la migration 9, ce
 * sont **les seules** colonnes de `trips` inscriptibles : `status` et `slug`
 * ne bougent que par une RPC.
 */
export type TripPatch = {
  title?: string
  description?: string | null
  cover_emoji?: string
  blind_mode?: boolean
}

/**
 * `update` direct sous la policy `trips_update` (organisateur seulement).
 *
 * Même piège que la suppression (`deleteTrip`) : sous RLS, une écriture
 * refusée n'échoue pas, elle touche zéro ligne. On exige donc que la ligne
 * revienne — sans quoi un « Enregistré » s'afficherait sur un réglage qui n'a
 * pas bougé.
 */
export async function updateTrip(tripId: string, patch: TripPatch): Promise<Trip> {
  const { data, error } = await supabase.from('trips').update(patch).eq('id', tripId).select()
  if (error) throw error
  const [row] = data
  if (!row) throw new Error('trip_update_refused')
  return row
}
