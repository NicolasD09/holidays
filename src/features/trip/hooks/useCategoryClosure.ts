import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { closeCategory, listDecisions, reopenCategory } from '@/features/trip/api/decisions'
import { qk } from '@/lib/queryKeys'
import { routes } from '@/lib/routes'
import type { CloseChoice } from '@/types/domain'

/** Les décisions du sondage, partagées par le hub, l'écran de vote et le récap. */
export function useDecisions(tripId: string) {
  return useQuery({
    queryKey: qk.decisions(tripId),
    queryFn: () => listDecisions(tripId),
  })
}

/**
 * Clôturer et rouvrir une catégorie.
 *
 * Une clôture change beaucoup de choses à la fois, et toutes viennent du
 * serveur : l'état de la catégorie, la décision, la progression du hub,
 * l'état du sondage (porté par l'aperçu), et ce que la catégorie laisse voir —
 * une catégorie clôturée ouvre ses résultats à tous, mode aveugle compris.
 * On invalide donc tout ce qui en dépend, sans jamais patcher le cache à la
 * main (ADR-005).
 *
 * **Clôturer la dernière catégorie mène au récap** : c'est désormais l'écran
 * d'accueil du lien (doc 02 §2.4, étape 5), autant y aller tout de suite.
 */
export function useCategoryClosure({
  slug,
  tripId,
  categoryId,
}: {
  slug: string
  tripId: string
  categoryId: string
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.categories(tripId) }),
      queryClient.invalidateQueries({ queryKey: qk.decisions(tripId) }),
      queryClient.invalidateQueries({ queryKey: qk.progress(tripId) }),
      queryClient.invalidateQueries({ queryKey: qk.tripPreview(slug) }),
      // Résultats, disponibilités, résumé du budget : tout ce qui est rangé
      // sous la catégorie.
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] }),
    ])
  }

  const close = useMutation({
    mutationFn: (choice: CloseChoice) => closeCategory(categoryId, choice),
    onSuccess: async (tripStatus) => {
      await invalidate()
      if (tripStatus === 'closed') void navigate(routes.results(slug))
    },
  })

  const reopen = useMutation({
    mutationFn: () => reopenCategory(categoryId),
    onSuccess: invalidate,
  })

  return { close, reopen }
}
