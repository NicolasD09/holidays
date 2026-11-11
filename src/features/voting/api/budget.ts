import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { BudgetSummary } from '@/types/domain'

/**
 * Lecture et écriture du budget d'une catégorie (doc 03 §3.6, tâches 4.1–4.3).
 *
 * Ce fichier ne peut pas fuiter un montant, même par maladresse : la policy
 * `budget_select_self` ne renvoie jamais que **ma** ligne, quel que soit le
 * filtre envoyé, et tout le reste passe par `app_budget_summary`, qui ne
 * renvoie que des agrégats. La confidentialité ne dépend d'aucune ligne
 * d'ici (ADR-006) — c'est le test de sécurité n° 2 du doc 04 §4.7 qui la
 * tient, pas la relecture de ce fichier.
 */

const answerSchema = z.object({ amount: z.number().int() }).nullable()

const summarySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.enum(['answer_first', 'insufficient']),
    respondents: z.number().int(),
    answered: z.boolean(),
  }),
  z.object({
    status: z.literal('ready'),
    respondents: z.number().int(),
    answered: z.boolean(),
    min: z.number().int(),
    median: z.number().int(),
    max: z.number().int(),
    step: z.number().int().positive(),
    curve: z
      .array(z.object({ amount: z.number().int(), followers: z.number().int() }))
      .min(2),
  }),
])

const outcomeSchema = z.object({ amount: z.number().int().nullable() })

/**
 * Mon montant dans cette catégorie, ou `null` si je n'ai pas répondu.
 *
 * Le filtre sur `participant_id` n'est pas ce qui protège — sans lui, la RLS
 * renverrait la même ligne. Il est là pour que la requête dise ce qu'elle
 * cherche.
 */
export async function fetchMyBudget(
  categoryId: string,
  participantId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('budget_answers')
    .select('amount')
    .eq('category_id', categoryId)
    .eq('participant_id', participantId)
    .maybeSingle()

  if (error) throw error
  return answerSchema.parse(data)?.amount ?? null
}

/** Le résumé du groupe — RPC `app_budget_summary`. Jamais un montant nominatif. */
export async function fetchBudgetSummary(categoryId: string): Promise<BudgetSummary> {
  const { data, error } = await supabase.rpc('app_budget_summary', {
    p_category: categoryId,
  })

  if (error) throw error
  return summarySchema.parse(data)
}

/**
 * Enregistre mon montant — RPC `app_set_budget`. `null` **retire** la réponse.
 *
 * L'argument est omis plutôt qu'envoyé à `null` : c'est ainsi que la RPC
 * déclare le retrait (`default null`), et c'est ce que les types générés
 * savent exprimer.
 */
export async function setBudget(
  categoryId: string,
  amount: number | null,
): Promise<number | null> {
  const { data, error } = await supabase.rpc(
    'app_set_budget',
    amount === null
      ? { p_category: categoryId }
      : { p_category: categoryId, p_amount: amount },
  )

  if (error) throw error
  return outcomeSchema.parse(data).amount
}
