import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useTripContext } from '@/app/layouts/tripContext'
import { NotFoundPage } from '@/app/pages/NotFoundPage'
import { PageShell } from '@/components/common/PageShell'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { listParticipants } from '@/features/participant/api/listParticipants'
import { fetchCategoryResults } from '@/features/voting/api/categoryResults'
import { addOption, listOptions } from '@/features/voting/api/options'
import { fetchMyVotes } from '@/features/voting/api/votes'
import { AddOptionInline } from '@/features/voting/components/AddOptionInline'
import { approvalLabel } from '@/features/voting/components/approval-choices'
import { OptionCard } from '@/features/voting/components/OptionCard'
import { useVote } from '@/features/voting/hooks/useVote'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import type { ApprovalValue, Option, OptionResult, Participant } from '@/types/domain'

/**
 * É5a — vote d'une catégorie en mode approbation (doc 05 §5.3).
 *
 * Trois règles tiennent cet écran :
 * 1. un tap enregistre, sans bouton Valider ;
 * 2. l'ordre des cartes est figé pendant qu'on vote — rien ne bouge sous le
 *    doigt, un bouton « Reclasser » rend la main ;
 * 3. les résultats viennent du serveur, ou pas du tout (mode aveugle).
 */
export function CategoryPage() {
  const { categoryId = '' } = useParams<{ categoryId: string }>()
  const { preview, participant, categories } = useTripContext()
  const queryClient = useQueryClient()

  const category = categories.find((item) => item.id === categoryId)

  const options = useQuery({
    queryKey: qk.options(categoryId),
    queryFn: () => listOptions(categoryId),
    enabled: Boolean(category),
  })

  const myVotes = useQuery({
    queryKey: qk.myVotes(categoryId),
    queryFn: () => fetchMyVotes(categoryId, participant.id),
    enabled: Boolean(category),
  })

  const results = useQuery({
    queryKey: qk.results(categoryId),
    queryFn: () => fetchCategoryResults(categoryId),
    enabled: Boolean(category),
  })

  const participants = useQuery({
    queryKey: qk.participants(preview.trip_id),
    queryFn: () => listParticipants(preview.trip_id),
  })

  const vote = useVote(categoryId)
  const [announcement, setAnnouncement] = useState('')
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null)

  const create = useMutation({
    mutationFn: (values: { title: string; url: string | null }) =>
      addOption({
        tripId: preview.trip_id,
        categoryId,
        participantId: participant.id,
        title: values.title,
        url: values.url,
        position: options.data?.length ?? 0,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.options(categoryId) })
      await queryClient.invalidateQueries({ queryKey: qk.results(categoryId) })
      setFrozenOrder(null)
    },
  })

  const resultsByOption = useMemo(() => {
    const map = new Map<string, OptionResult>()
    for (const row of results.data ?? []) map.set(row.option_id, row)
    return map
  }, [results.data])

  const ordered = useMemo(() => {
    const list = options.data ?? []
    if (frozenOrder) return sortByIds(list, frozenOrder)

    // Hors mode aveugle, on classe par score décroissant ; sinon on garde
    // l'ordre d'ajout, qui ne révèle rien (doc 05 §5.3).
    if (!results.data) return list
    return [...list].sort(
      (a, b) =>
        (resultsByOption.get(b.id)?.score ?? 0) - (resultsByOption.get(a.id)?.score ?? 0),
    )
  }, [options.data, frozenOrder, results.data, resultsByOption])

  if (!category) return <NotFoundPage />

  if (options.isPending || myVotes.isPending) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (options.isError || myVotes.isError) {
    return (
      <PageShell>
        <ErrorState
          body={toUserMessage(options.error ?? myVotes.error)}
          action={
            <Button onClick={() => void options.refetch()}>{labels.error.tryAgain}</Button>
          }
        />
      </PageShell>
    )
  }

  const votes = myVotes.data ?? {}
  const closed = category.status === 'closed'
  const canPropose = !closed && (category.allow_participant_options || participant.is_organizer)
  const votedCount = ordered.filter((option) => votes[option.id] !== undefined).length

  function onVote(option: Option, value: ApprovalValue | null) {
    // L'ordre se fige au premier vote : une carte ne doit jamais glisser sous
    // le doigt parce que son score vient de changer.
    if (!frozenOrder) setFrozenOrder(ordered.map((item) => item.id))

    vote.mutate({ optionId: option.id, value })
    setAnnouncement(
      value === null
        ? labels.voting.retracted(option.title)
        : labels.voting.recorded(option.title, approvalLabel(value)),
    )

    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      navigator.vibrate?.(10)
    }
  }

  return (
    <PageShell className="flex flex-col gap-6 pb-16">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-text-muted">
          {preview.cover_emoji} {preview.title}
        </p>
        <h1 className="text-2xl font-semibold">{category.label}</h1>
        {category.description ? <p className="text-text-muted">{category.description}</p> : null}
      </header>

      {closed ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          {labels.voting.closed}
        </p>
      ) : null}

      {results.data === null ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          {labels.voting.blindNotice}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <EmptyState title={labels.empty.noOptions} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {votedCount === ordered.length && votedCount > 0
                ? labels.voting.allVoted
                : labels.voting.progress(votedCount, ordered.length)}
            </p>
            {frozenOrder && results.data ? (
              <Button variant="ghost" onClick={() => setFrozenOrder(null)}>
                {labels.voting.resort}
              </Button>
            ) : null}
          </div>

          <ul className="flex flex-col gap-4">
            {ordered.map((option) => (
              <li key={option.id}>
                <OptionCard
                  option={option}
                  result={resultsByOption.get(option.id) ?? null}
                  value={votes[option.id] ?? null}
                  proposedBy={nameOf(option.created_by, participants.data ?? [])}
                  disabled={closed}
                  onVote={(value) => onVote(option, value)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {canPropose ? (
        <AddOptionInline
          pending={create.isPending}
          onAdd={async (values) => {
            await create.mutateAsync(values)
          }}
        />
      ) : null}

      {create.isError ? (
        <p role="alert" className="text-sm text-no">
          {toUserMessage(create.error)}
        </p>
      ) : null}

      {/* Le vote enregistré est annoncé aux lecteurs d'écran (doc 05 §5.5). */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </PageShell>
  )
}

/**
 * Une proposition ajoutée après le gel passe en fin de liste plutôt que de
 * disparaître.
 */
function sortByIds(options: Option[], ids: string[]): Option[] {
  const rank = new Map(ids.map((id, index) => [id, index]))
  const last = Number.MAX_SAFE_INTEGER
  return [...options].sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last))
}

function nameOf(participantId: string | null, participants: Participant[]): string | null {
  if (!participantId) return null
  return participants.find((item) => item.id === participantId)?.display_name ?? null
}
