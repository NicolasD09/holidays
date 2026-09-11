import { supabase } from '@/lib/supabase'
import type { Participant } from '@/types/domain'

/**
 * Participants du sondage — pour nommer l'auteur d'une proposition.
 *
 * La policy `participants_select` n'ouvre cette liste qu'aux participants :
 * les prénoms ne fuient pas hors du sondage, même en connaissant le lien.
 */
export async function listParticipants(tripId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}
