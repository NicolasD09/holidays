import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/domain'

/**
 * Catégories d'un sondage, lues en direct sous RLS.
 *
 * L'aperçu (`app_trip_preview`) en donne déjà le libellé et le type, mais pas
 * le mode de vote, l'état, ni `allow_participant_options` — trois choses dont
 * l'écran de vote a besoin. Cette lecture n'est donc possible qu'une fois
 * participant, ce qui est exactement la règle voulue : la policy
 * `categories_select` exige `app_is_participant(trip_id)`.
 */
export async function listCategories(tripId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('trip_id', tripId)
    .order('position', { ascending: true })

  if (error) throw error
  return data
}
