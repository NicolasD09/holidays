import { z } from 'zod'
import { toCloseArgs } from '@/lib/decisions'
import { supabase } from '@/lib/supabase'
import type { CloseChoice, Decision, TripStatus } from '@/types/domain'

/**
 * Décisions d'un sondage — lecture directe sous RLS, écriture par RPC.
 *
 * La policy `decisions_select` ouvre la lecture aux seuls participants, et la
 * table n'accorde aucune écriture : on ne tranche qu'en clôturant
 * (`app_close_category`), et on ne défait qu'en rouvrant (migration 9).
 */

const payloadSchema = z
  .object({
    title: z.string().optional(),
    start: z.iso.date().optional(),
    end: z.iso.date().optional(),
    amount: z.number().int().optional(),
  })
  // La base normalise déjà le payload ; on ignore ce qu'on ne connaît pas
  // plutôt que de faire échouer le récap entier pour une clé de plus.
  .loose()

const rowSchema = z.object({
  category_id: z.uuid(),
  option_id: z.uuid().nullable(),
  free_text: z.string().nullable(),
  payload: payloadSchema,
  decided_at: z.string(),
})

export function toDecision(row: z.infer<typeof rowSchema>): Decision {
  const { payload } = row
  return {
    categoryId: row.category_id,
    optionId: row.option_id,
    title: payload.title ?? null,
    range: payload.start && payload.end ? { start: payload.start, end: payload.end } : null,
    amount: payload.amount ?? null,
    freeText: row.free_text,
    decidedAt: row.decided_at,
  }
}

export async function listDecisions(tripId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decisions')
    .select('category_id, option_id, free_text, payload, decided_at')
    .eq('trip_id', tripId)

  if (error) throw error
  return z.array(rowSchema).parse(data).map(toDecision)
}

const closeResultSchema = z.object({
  trip_status: z.enum(['draft', 'open', 'closed', 'archived']),
})

/** Clôture une catégorie. Renvoie l'état du sondage **après** : `closed` si c'était la dernière. */
export async function closeCategory(
  categoryId: string,
  choice: CloseChoice,
): Promise<TripStatus> {
  const { data, error } = await supabase.rpc('app_close_category', toCloseArgs(categoryId, choice))
  if (error) throw error
  return closeResultSchema.parse(data).trip_status
}

/** Rouvre une catégorie : sa décision disparaît, les votes redeviennent modifiables. */
export async function reopenCategory(categoryId: string): Promise<TripStatus> {
  const { data, error } = await supabase.rpc('app_reopen_category', { p_category: categoryId })
  if (error) throw error
  return closeResultSchema.parse(data).trip_status
}
