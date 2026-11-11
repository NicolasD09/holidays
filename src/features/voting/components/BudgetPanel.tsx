import { useQuery } from '@tanstack/react-query'
import { ErrorState, LoadingState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { fetchBudgetSummary, fetchMyBudget } from '@/features/voting/api/budget'
import { BudgetInput } from '@/features/voting/components/BudgetInput'
import { BudgetSummary } from '@/features/voting/components/BudgetSummary'
import { useBudget } from '@/features/voting/hooks/useBudget'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'

/**
 * É5c — le corps de l'écran budget (doc 05 §5.3 5.c).
 *
 * Deux lectures, deux droits : **mon** montant (ma ligne, lisible par moi
 * seul) et le **résumé** du groupe (des agrégats). Elles ne se croisent
 * jamais, ni ici ni en cache.
 *
 * Sorti de `CategoryPage` pour que ses requêtes ne soient montées que sur une
 * catégorie budget : pas de `enabled` à maintenir en miroir de trois autres.
 */
export function BudgetPanel({
  categoryId,
  tripId,
  participantId,
  closed,
}: {
  categoryId: string
  tripId: string
  participantId: string
  closed: boolean
}) {
  const mine = useQuery({
    queryKey: qk.myBudget(categoryId),
    queryFn: () => fetchMyBudget(categoryId, participantId),
  })

  const summary = useQuery({
    queryKey: qk.budgetSummary(categoryId),
    queryFn: () => fetchBudgetSummary(categoryId),
  })

  const save = useBudget(categoryId, tripId)

  if (mine.isPending || summary.isPending) return <LoadingState />

  if (mine.isError || summary.isError) {
    return (
      <ErrorState
        body={toUserMessage(mine.error ?? summary.error)}
        action={
          <Button
            onClick={() => {
              void mine.refetch()
              void summary.refetch()
            }}
          >
            {labels.error.tryAgain}
          </Button>
        }
      />
    )
  }

  return (
    <>
      <BudgetInput
        saved={mine.data}
        disabled={closed}
        pending={save.isPending}
        error={save.isError ? toUserMessage(save.error, labels.budget.failed) : null}
        onSave={(amount) => save.mutate(amount)}
        onClear={() => save.mutate(null)}
      />
      <BudgetSummary summary={summary.data} />
    </>
  )
}
