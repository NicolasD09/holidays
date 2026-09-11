import { z } from 'zod'
import { extractCode } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { OptionResult } from '@/types/domain'

/**
 * Résultats agrégés d'une catégorie — RPC `app_category_results`.
 *
 * Les scores sont calculés **côté serveur**. Les compter dans le navigateur
 * reviendrait à devoir lire les votes des autres, ce que le mode aveugle
 * interdit précisément : la RPC lève alors `blind_mode_active`.
 *
 * On traduit cette erreur en `null` — « pas encore visible » — plutôt que de
 * la laisser remonter : ce n'est pas une panne, c'est un état normal de
 * l'écran, qui affiche son bandeau d'explication.
 */

const resultsSchema = z.array(
  z.object({
    option_id: z.uuid(),
    title: z.string(),
    yes_count: z.number().int(),
    maybe_count: z.number().int(),
    no_count: z.number().int(),
    score: z.number().int(),
    voter_count: z.number().int(),
  }),
)

export async function fetchCategoryResults(
  categoryId: string,
): Promise<OptionResult[] | null> {
  const { data, error } = await supabase.rpc('app_category_results', {
    p_category: categoryId,
  })

  if (error) {
    if (extractCode(error) === 'blind_mode_active') return null
    throw error
  }

  return resultsSchema.parse(data)
}
