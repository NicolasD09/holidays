import { z } from 'zod'
import { ensureSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { CreatedTrip } from '@/types/domain'

/**
 * Création d'un sondage — RPC `app_create_trip` (doc 03 §3.7).
 *
 * `app_create_trip` est le seul chemin d'écriture vers `trips` et
 * `participants` : aucune policy `insert` n'existe sur ces tables. Inutile
 * donc de chercher un `from('trips').insert(...)` ailleurs, il n'y en a pas.
 *
 * Le retour est typé `Json` côté généré, ce qui ne protège personne : on le
 * valide ici avant de le présenter sous `CreatedTrip` (doc 04 §4.3).
 */

const createdTripSchema = z.object({
  trip_id: z.uuid(),
  slug: z.string().min(1),
  participant_id: z.uuid(),
  display_name: z.string().min(1),
})

export type CreateTripInput = {
  title: string
  emoji: string
  displayName: string
}

export async function createTrip({
  title,
  emoji,
  displayName,
}: CreateTripInput): Promise<CreatedTrip> {
  // La session anonyme n'est créée qu'ici : ouvrir la page d'accueil ne doit
  // fabriquer aucune identité (doc 04 §4.5).
  await ensureSession()

  const { data, error } = await supabase.rpc('app_create_trip', {
    p_title: title,
    p_emoji: emoji,
    p_display_name: displayName,
    // Sprint 2 : une seule catégorie, un seul mode de vote. Le sélecteur de
    // catégories arrive au sprint 3 (doc 08).
    p_categories: [
      {
        kind: 'destination',
        label: 'Destination',
        vote_mode: 'approval',
        allow_participant_options: true,
      },
    ],
  })

  if (error) throw error
  return createdTripSchema.parse(data)
}
