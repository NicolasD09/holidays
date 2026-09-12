import { supabase } from '@/lib/supabase'
import type { Category, VoteMode } from '@/types/domain'

/**
 * Réglages d'une catégorie (tâche 2.5) — `update` direct, pas de RPC.
 *
 * La policy `categories_write` fait tout le travail : elle n'autorise
 * l'écriture qu'à l'organisateur du sondage (doc 03 §3.6). Un participant
 * ordinaire qui rejouerait cette requête se verrait refuser côté serveur, pas
 * seulement côté écran — c'est la différence entre un bouton grisé et une
 * règle.
 */

export type CategoryPatch = {
  label?: string
  vote_mode?: VoteMode
  max_choices?: number | null
  allow_participant_options?: boolean
  position?: number
}

export async function updateCategory(
  categoryId: string,
  patch: CategoryPatch,
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', categoryId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Échange la place de deux catégories.
 *
 * Deux écritures séparées, donc non atomiques : si la seconde échoue, deux
 * catégories partagent la même `position`. Sans conséquence visible —
 * `listCategories` trie par `position` puis départage de façon stable — et le
 * réessai remet tout d'aplomb. Une RPC transactionnelle serait la réponse
 * propre ; elle demanderait une migration pour un désordre cosmétique.
 */
export async function swapCategoryPositions(
  first: { id: string; position: number },
  second: { id: string; position: number },
): Promise<void> {
  await updateCategory(first.id, { position: second.position })
  await updateCategory(second.id, { position: first.position })
}
