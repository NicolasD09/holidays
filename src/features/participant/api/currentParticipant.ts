import { getCurrentUserId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Participant } from '@/types/domain'

/**
 * Ma fiche de participant sur ce sondage.
 *
 * Nécessaire dès qu'on écrit : l'ajout d'une proposition est un `insert`
 * direct, et la policy `options_insert` exige que `created_by` soit
 * précisément l'id du participant courant. `app_join_trip` le renvoie à
 * l'adhésion, mais un appareil qui revient le lendemain ne l'a plus — d'où
 * cette lecture, sur laquelle la RLS veille de toute façon.
 *
 * Ne crée jamais de session : sans identité, la réponse est `null`.
 */
export async function fetchCurrentParticipant(
  tripId: string,
): Promise<Participant | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('trip_id', tripId)
    .eq('auth_uid', userId)
    .maybeSingle()

  if (error) throw error
  return data
}
