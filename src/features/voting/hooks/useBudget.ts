import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setBudget } from '@/features/voting/api/budget'
import { qk } from '@/lib/queryKeys'

/**
 * Enregistrement du budget.
 *
 * **Pas optimiste**, contrairement à `useVote` et `useAvailability`, et c'est
 * voulu : un vote se donne d'un tap, un montant se tape puis se valide. Il y a
 * déjà un bouton et un état « Enregistrement… » ; afficher le chiffre comme
 * acquis avant la réponse du serveur n'apporterait rien, et le reprendre en
 * cas d'échec ferait croire qu'il a été enregistré un instant.
 *
 * Au succès : ma ligne est écrite dans le cache telle que le serveur l'a
 * confirmée ; le résumé du groupe et la progression du hub, qui en dépendent,
 * sont invalidés.
 */
export function useBudget(categoryId: string, tripId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (amount: number | null) => setBudget(categoryId, amount),
    onSuccess: async (amount) => {
      queryClient.setQueryData<number | null>(qk.myBudget(categoryId), amount)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.budgetSummary(categoryId) }),
        queryClient.invalidateQueries({ queryKey: qk.progress(tripId) }),
      ])
    },
  })
}
