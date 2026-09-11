import { supabase } from '@/lib/supabase'
import type { Option } from '@/types/domain'

/** Propositions d'une catégorie, dans leur ordre d'ajout. */
export async function listOptions(categoryId: string): Promise<Option[]> {
  const { data, error } = await supabase
    .from('options')
    .select('*')
    .eq('category_id', categoryId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export type AddOptionInput = {
  tripId: string
  categoryId: string
  participantId: string
  title: string
  url?: string | null
  position: number
}

/**
 * Ajout d'une proposition — `insert` direct, pas de RPC.
 *
 * La policy `options_insert` fait tout le travail : elle exige d'être
 * participant, que `created_by` soit l'id du participant courant (impossible
 * de proposer au nom d'un autre), que la catégorie soit ouverte, et que
 * `allow_participant_options` soit vrai — sauf pour l'organisateur. Le
 * déclencheur `app_cap_options` plafonne à 100 propositions.
 */
export async function addOption({
  tripId,
  categoryId,
  participantId,
  title,
  url,
  position,
}: AddOptionInput): Promise<Option> {
  const { data, error } = await supabase
    .from('options')
    .insert({
      trip_id: tripId,
      category_id: categoryId,
      created_by: participantId,
      title,
      url: url?.trim() ? url.trim() : null,
      position,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
