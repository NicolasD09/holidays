import { Link } from 'react-router'
import type { CategoryProgress } from '@/features/trip/api/tripProgress'
import { categoryEmoji } from '@/features/trip/components/category-catalogue'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/domain'

/**
 * Une carte du hub (doc 05 §5.3 É4).
 *
 * Toute la carte est cliquable — la cible tactile la plus généreuse possible,
 * plutôt qu'un lien « Voter » de 44 px perdu dans un coin.
 *
 * La pastille d'état n'est jamais rouge et ne mentionne jamais de délai :
 * `À voter` est une invitation, pas un reproche (doc 05 §5.1-5).
 */
export function CategoryCard({
  category,
  progress,
  slug,
  participantCount,
}: {
  category: Category
  progress: CategoryProgress | undefined
  slug: string
  participantCount: number
}) {
  const closed = category.status === 'closed'
  const voted = progress?.votedByMe ?? false
  const optionCount = progress?.optionCount ?? 0
  const voterCount = progress?.voterIds.length ?? 0
  // Une catégorie dates n'a pas de proposition : annoncer « Aucune proposition »
  // y serait exact et totalement trompeur.
  const isDates = category.vote_mode === 'availability'

  const status = closed
    ? { text: labels.hub.statusClosed, className: 'bg-surface text-text-muted' }
    : voted
      ? { text: labels.hub.statusVoted, className: 'bg-surface text-text-muted' }
      : { text: labels.hub.statusToVote, className: 'bg-brand text-brand-fg' }

  return (
    <Link
      to={routes.category(slug, category.id)}
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4',
        'transition-colors duration-150 hover:bg-surface',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-text">
          <span aria-hidden="true">{categoryEmoji(category.kind)}</span>
          {category.label}
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-sm font-medium',
            status.className,
          )}
        >
          {status.text}
        </span>
      </div>

      <p className="text-sm text-text-muted">
        {isDates ? labels.hub.stayLength(category.nights) : labels.hub.options(optionCount)}
        {participantCount > 0 ? (
          <> · {labels.hub.participation(voterCount, participantCount)}</>
        ) : null}
      </p>

      {/*
        La barre de participation double l'information chiffrée juste au-dessus.
        Purement décorative, donc masquée aux lecteurs d'écran.
      */}
      {participantCount > 0 ? (
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-brand transition-[width] duration-150"
            style={{ width: `${Math.min(100, (voterCount / participantCount) * 100)}%` }}
          />
        </div>
      ) : null}

      {progress?.leader ? (
        <p className="text-sm text-text-muted">{labels.hub.leader(progress.leader.title)}</p>
      ) : isDates ? (
        <p className="text-sm text-text-muted">{labels.hub.noAvailabilityYet}</p>
      ) : optionCount === 0 ? (
        <p className="text-sm text-text-muted">{labels.hub.noOptionsYet}</p>
      ) : null}
    </Link>
  )
}
