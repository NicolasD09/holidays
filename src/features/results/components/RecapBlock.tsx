import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { LoadingState } from '@/components/common/StateBlock'
import type { CategoryProgress } from '@/features/trip/api/tripProgress'
import { categoryEmoji } from '@/features/trip/components/category-catalogue'
import { listAvailabilities } from '@/features/voting/api/availabilities'
import { fetchCategoryResults } from '@/features/voting/api/categoryResults'
import { tallyFor } from '@/features/voting/components/close-picks'
import { WindowRanking } from '@/features/voting/components/WindowRanking'
import { describeDecision } from '@/lib/decisions'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Category, Decision, Participant } from '@/types/domain'

/**
 * Un bloc du récap : une catégorie, ce qui a été décidé ou ce qui mène, et
 * qui s'est prononcé.
 *
 * Le classement complet est **replié** (doc 05 §5.3 É6) et ne se charge qu'à
 * l'ouverture : quelqu'un qui ouvre le récap pour lire la décision n'a pas à
 * télécharger tous les scores.
 */
export function RecapBlock({
  category,
  slug,
  decision,
  progress,
  voterNames,
  participants,
}: {
  category: Category
  slug: string
  decision: Decision | null
  progress: CategoryProgress | undefined
  voterNames: string[]
  participants: Participant[]
}) {
  const [expanded, setExpanded] = useState(false)
  const closed = category.status === 'closed'
  const isBudget = category.vote_mode === 'amount'

  const current = progress?.leader
    ? isBudget
      ? labels.hub.budgetComfortable(progress.leader.title)
      : labels.recap.leading(progress.leader.title)
    : labels.recap.noLeader

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface-2 p-4',
        closed ? 'border-brand' : 'border-border',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden="true">{categoryEmoji(category.kind)}</span>
          {category.label}
        </h2>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-sm font-medium',
            closed ? 'bg-brand text-brand-fg' : 'bg-surface text-text-muted',
          )}
        >
          {closed ? labels.closure.decided : labels.recap.inProgress}
        </span>
      </header>

      {closed && decision ? (
        <p className="text-xl font-semibold text-text">{describeDecision(decision)}</p>
      ) : closed ? (
        <p className="text-text-muted">{labels.closure.closedWithoutDecision}</p>
      ) : (
        <p className="text-text">{current}</p>
      )}

      <p className="text-sm text-text-muted">
        {isBudget
          ? labels.recap.budgetVoters(progress?.respondentCount ?? 0)
          : labels.recap.voters(voterNames)}
      </p>

      {/* Le budget n'a pas de classement à déplier : son résumé vit dans la catégorie. */}
      {isBudget ? null : (
        <details
          className="group"
          onToggle={(event) => setExpanded((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer py-2 text-sm font-medium text-brand">
            {labels.recap.fullRanking}
          </summary>
          {expanded ? <FullRanking category={category} participants={participants} /> : null}
        </details>
      )}

      <Link
        to={routes.category(slug, category.id)}
        className="self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        {labels.recap.openCategory}
      </Link>
    </article>
  )
}

function FullRanking({
  category,
  participants,
}: {
  category: Category
  participants: Participant[]
}) {
  const isDates = category.vote_mode === 'availability'

  const results = useQuery({
    queryKey: qk.results(category.id),
    queryFn: () => fetchCategoryResults(category.id),
    enabled: !isDates,
  })
  const availabilities = useQuery({
    queryKey: qk.availabilities(category.id),
    queryFn: () => listAvailabilities(category.id),
    enabled: isDates,
  })

  if (isDates) {
    const { window_start: from, window_end: to, nights } = category
    if (availabilities.isPending) return <LoadingState />
    if (availabilities.isError) return <p className="text-sm text-no">{toUserMessage(availabilities.error)}</p>
    if (from === null || to === null || nights === null) return null
    return (
      <WindowRanking
        windowStart={from}
        windowEnd={to}
        nights={nights}
        entries={availabilities.data}
        participants={participants}
      />
    )
  }

  if (results.isPending) return <LoadingState />
  if (results.isError) return <p className="text-sm text-no">{toUserMessage(results.error)}</p>
  // Mode aveugle, catégorie ouverte, pas encore voté : la RPC refuse, et on le dit.
  if (results.data === null) return <p className="text-sm text-text-muted">{labels.voting.blindNotice}</p>
  if (results.data.length === 0) return <p className="text-sm text-text-muted">{labels.recap.rankingEmpty}</p>

  return (
    <ol className="flex flex-col gap-2">
      {results.data.map((row, index) => (
        <li key={row.option_id} className="flex items-baseline justify-between gap-3">
          <span className="text-text">
            <span className="text-text-muted">{index + 1}. </span>
            {row.title}
          </span>
          <span className="shrink-0 text-sm text-text-muted">
            {tallyFor(category.vote_mode, row)}
          </span>
        </li>
      ))}
    </ol>
  )
}
