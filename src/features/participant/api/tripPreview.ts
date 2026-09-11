import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { TripPreview } from '@/types/domain'

/**
 * Aperçu d'un sondage — RPC `app_trip_preview` (doc 03 §3.7).
 *
 * C'est ce qu'on montre AVANT d'entrer son prénom : titre, emoji, nombre de
 * participants, catégories. Ni propositions, ni votes, ni prénoms.
 *
 * Seule RPC joignable sans session : on l'appelle donc **sans** passer par
 * `ensureSession()`. Un pote qui ouvre le lien et repart sans rejoindre ne
 * laisse aucune trace côté `auth.users`.
 */

const previewSchema = z.object({
  trip_id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  cover_emoji: z.string().nullable(),
  status: z.enum(['draft', 'open', 'closed', 'archived']),
  participant_count: z.number().int().nonnegative(),
  is_participant: z.boolean(),
  categories: z.array(
    z.object({
      id: z.uuid(),
      label: z.string(),
      kind: z.enum(['destination', 'dates', 'budget', 'lodging', 'activity', 'custom']),
    }),
  ),
})

export async function fetchTripPreview(slug: string): Promise<TripPreview> {
  const { data, error } = await supabase.rpc('app_trip_preview', { p_slug: slug })
  if (error) throw error
  return previewSchema.parse(data)
}
