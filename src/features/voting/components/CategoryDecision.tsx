import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { listParticipants } from '@/features/participant/api/listParticipants'
import { fetchTripProgress } from '@/features/trip/api/tripProgress'
import { useCategoryClosure, useDecisions } from '@/features/trip/hooks/useCategoryClosure'
import { CloseCategoryDialog } from '@/features/voting/components/CloseCategoryDialog'
import { describeDecision } from '@/lib/decisions'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import type { Category } from '@/types/domain'

/**
 * Le haut d'une catégorie, côté décision (tâches 5.1 et 5.2).
 *
 * - Clôturée : la décision **en toutes lettres**, pour tout le monde, et le
 *   rappel que les votes sont figés. L'organisateur peut rouvrir.
 * - Ouverte : rien pour un participant ; un bouton « Clôturer » pour
 *   l'organisateur.
 *
 * Le bouton n'est qu'une commodité : c'est `app_close_category` qui refuse un
 * non-organisateur, pas l'absence de bouton.
 */
export function CategoryDecision({
  category,
  categories,
  slug,
  tripId,
  participantId,
  isOrganizer,
}: {
  category: Category
  categories: Category[]
  slug: string
  tripId: string
  participantId: string
  isOrganizer: boolean
}) {
  const [closing, setClosing] = useState(false)
  const closed = category.status === 'closed'
  const decisions = useDecisions(tripId)
  const { close, reopen } = useCategoryClosure({ slug, tripId, categoryId: category.id })

  if (closed) {
    const decision = decisions.data?.find((item) => item.categoryId === category.id)

    return (
      <section
        aria-label={labels.closure.decided}
        className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-brand bg-surface-2 p-4"
      >
        {decision ? (
          <>
            <p className="text-sm font-medium text-text-muted">{labels.closure.decided}</p>
            <p className="text-xl font-semibold text-text">{describeDecision(decision)}</p>
          </>
        ) : (
          <p className="font-medium">{labels.closure.closedWithoutDecision}</p>
        )}
        <p className="text-sm text-text-muted">{labels.closure.readOnly}</p>

        {isOrganizer ? (
          <Button
            variant="outline"
            className="self-start"
            disabled={reopen.isPending}
            onClick={() => reopen.mutate()}
          >
            {reopen.isPending ? labels.closure.reopening : labels.closure.reopenCta}
          </Button>
        ) : null}
        {reopen.isError ? (
          <p role="alert" className="text-sm text-no">
            {toUserMessage(reopen.error)}
          </p>
        ) : null}
      </section>
    )
  }

  if (!isOrganizer) return null

  return (
    <>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          close.reset()
          setClosing(true)
        }}
      >
        {labels.closure.closeCta}
      </Button>

      {closing ? (
        <CloseDialogWithParticipation
          category={category}
          categories={categories}
          tripId={tripId}
          participantId={participantId}
          pending={close.isPending}
          error={close.error}
          onCancel={() => setClosing(false)}
          onConfirm={(choice) => close.mutate(choice, { onSuccess: () => setClosing(false) })}
        />
      ) : null}
    </>
  )
}

/**
 * La modale, plus ce qu'il faut pour son avertissement : combien ne se sont
 * pas prononcés.
 *
 * Montée seulement à l'ouverture, et **les deux termes y sont relus** :
 * - qui s'est prononcé — le cache vient souvent du hub, consulté avant les
 *   derniers votes ;
 * - combien participent — l'aperçu du sondage date parfois de sa création,
 *   quand l'organisateur était seul (l'E2E du sprint 7 l'a attrapé deux fois
 *   de suite, une par terme).
 *
 * Tant que les deux lectures fraîches ne sont pas arrivées, on n'avertit de
 * rien plutôt que d'un nombre faux.
 */
function CloseDialogWithParticipation({
  categories,
  tripId,
  participantId,
  ...dialog
}: Omit<Parameters<typeof CloseCategoryDialog>[0], 'nonVoters'> & {
  categories: Category[]
  tripId: string
  participantId: string
}) {
  const progress = useQuery({
    queryKey: qk.progress(tripId),
    queryFn: () => fetchTripProgress(tripId, participantId, categories),
    refetchOnMount: 'always',
  })

  const participants = useQuery({
    queryKey: qk.participants(tripId),
    queryFn: () => listParticipants(tripId),
    refetchOnMount: 'always',
  })

  const fresh = progress.isFetchedAfterMount && participants.isFetchedAfterMount
  const entry = fresh ? progress.data?.[dialog.category.id] : undefined
  const responded = entry ? (entry.respondentCount ?? entry.voterIds.length) : null
  const total = participants.data?.length ?? 0

  return (
    <CloseCategoryDialog
      {...dialog}
      nonVoters={responded === null ? null : Math.max(0, total - responded)}
    />
  )
}
