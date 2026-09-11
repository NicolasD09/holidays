import { supabase } from '@/lib/supabase'
import type { ApprovalValue } from '@/types/domain'

/**
 * Mes votes dans une catégorie, sous la forme `option_id → valeur`.
 *
 * La policy `votes_select` laisse toujours voir ses propres votes, mode
 * aveugle ou non — c'est ce qui permet de retrouver ses choix en rouvrant le
 * lien le lendemain.
 */
export type MyVotes = Record<string, ApprovalValue>

export async function fetchMyVotes(
  categoryId: string,
  participantId: string,
): Promise<MyVotes> {
  const { data, error } = await supabase
    .from('votes')
    .select('option_id, value')
    .eq('category_id', categoryId)
    .eq('participant_id', participantId)

  if (error) throw error

  const votes: MyVotes = {}
  for (const row of data) {
    votes[row.option_id] = clampApproval(row.value)
  }
  return votes
}

/** Enregistre un vote — RPC `app_cast_vote`. */
export async function castVote(optionId: string, value: ApprovalValue): Promise<void> {
  const { error } = await supabase.rpc('app_cast_vote', {
    p_option_id: optionId,
    p_value: value,
  })
  if (error) throw error
}

/**
 * Retire un vote — RPC `app_retract_vote`.
 *
 * En approbation, « je ne me prononce plus » n'est pas « non » : sans cette
 * fonction, un tap malencontreux serait définitif (doc 09).
 */
export async function retractVote(optionId: string): Promise<void> {
  const { error } = await supabase.rpc('app_retract_vote', { p_option_id: optionId })
  if (error) throw error
}

/**
 * La colonne est un `smallint` borné à [-1, 1] par une contrainte de table ;
 * TypeScript ne le sait pas. On resserre ici plutôt que de laisser un `as`
 * traîner dans les composants.
 */
function clampApproval(value: number): ApprovalValue {
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}
