import { z } from 'zod'
import { ensureSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { JoinedTrip } from '@/types/domain'

/**
 * Adhésion à un sondage — RPC `app_join_trip` (doc 03 §3.7).
 *
 * Idempotente : si cet appareil participe déjà, la fonction renvoie le
 * participant existant avec `created: false` plutôt que d'en créer un second.
 * Le prénom, lui, n'est jamais refusé : un doublon devient « Thomas (2) », car
 * refuser ferait sortir la personne du parcours (doc 03 §3.7).
 */

const joinedSchema = z.object({
  trip_id: z.uuid(),
  participant_id: z.uuid(),
  display_name: z.string(),
  is_organizer: z.boolean(),
  created: z.boolean(),
})

export async function joinTrip(slug: string, displayName: string): Promise<JoinedTrip> {
  await ensureSession()

  const { data, error } = await supabase.rpc('app_join_trip', {
    p_slug: slug,
    p_display_name: displayName,
  })

  if (error) throw error
  return joinedSchema.parse(data)
}
