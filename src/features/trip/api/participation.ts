import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { TripParticipation } from '@/types/domain'

/**
 * Qui s'est prononcé, par catégorie — RPC `app_trip_participation`
 * (migration 9).
 *
 * Compté en base, et non plus à partir des votes que cet appareil peut lire :
 * en mode aveugle, ces votes-là sont masqués à qui n'a pas voté, et le hub
 * affichait « 1/8 » chez tout le monde (dette n° 6 du doc 15).
 *
 * La RPC ne dit que **qui**, jamais **quoi**. Et pour le budget, seulement
 * **combien** (ADR-006).
 */

const participationSchema = z.record(
  z.uuid(),
  z.object({
    respondents: z.array(z.uuid()),
    count: z.number().int().nonnegative(),
  }),
)

export async function fetchParticipation(tripId: string): Promise<TripParticipation> {
  const { data, error } = await supabase.rpc('app_trip_participation', { p_trip: tripId })
  if (error) throw error
  return participationSchema.parse(data)
}
