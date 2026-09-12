import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useTripContext } from '@/app/layouts/tripContext'
import { PageShell } from '@/components/common/PageShell'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { listParticipants } from '@/features/participant/api/listParticipants'
import { fetchTripProgress } from '@/features/trip/api/tripProgress'
import { CategoryCard } from '@/features/trip/components/CategoryCard'
import { ShareSheet } from '@/features/trip/components/ShareSheet'
import {
  countDone,
  missingParticipants,
  nextActionable,
} from '@/features/trip/hub-navigation'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import { routes } from '@/lib/routes'
import { tripUrl } from '@/lib/share'

/** Au-delà, on ne déroule plus la liste : un mur de prénoms n'informe personne. */
const MAX_NAMES = 3

/**
 * É4 — le hub du sondage (doc 05 §5.3, tâche 2.2).
 *
 * **Un sondage à une seule catégorie redirige toujours vers elle.** Un
 * tableau de bord pour choisir parmi un seul élément est un écran de plus
 * entre le lien et le vote ; c'était le comportement du sprint 2, il reste
 * juste. L'URL `/t/:slug` ne change pas pour autant : un lien envoyé dans le
 * groupe avant ce sprint continue de fonctionner.
 */
export function TripHubPage() {
  const { slug, preview, participant, categories } = useTripContext()
  const navigate = useNavigate()
  const [sharing, setSharing] = useState(false)

  const progress = useQuery({
    queryKey: qk.progress(preview.trip_id),
    queryFn: () => fetchTripProgress(preview.trip_id, participant.id, categories),
  })

  const participants = useQuery({
    queryKey: qk.participants(preview.trip_id),
    queryFn: () => listParticipants(preview.trip_id),
  })

  const only = categories.length === 1 ? categories[0] : null

  if (categories.length === 0) {
    return (
      <PageShell>
        <EmptyState title={labels.trip.noCategories} />
      </PageShell>
    )
  }

  if (only) return <Navigate to={routes.category(slug, only.id)} replace />

  if (progress.isPending) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (progress.isError) {
    return (
      <PageShell>
        <ErrorState
          body={toUserMessage(progress.error)}
          action={
            <Button onClick={() => void progress.refetch()}>{labels.error.tryAgain}</Button>
          }
        />
      </PageShell>
    )
  }

  const data = progress.data
  const { done, total } = countDone(categories, data)
  const next = nextActionable(categories, data)
  const missing = missingParticipants(
    categories,
    data,
    participants.data ?? [],
    participant.id,
  )
  const noOptionsAnywhere = categories.every(
    (category) => (data[category.id]?.optionCount ?? 0) === 0,
  )

  return (
    <PageShell className="flex flex-col gap-6 pb-28">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <span aria-hidden="true">{preview.cover_emoji}</span>
            {preview.title}
          </h1>
          <Button variant="outline" onClick={() => setSharing(true)}>
            {labels.trip.share}
          </Button>
        </div>
        <p className="text-text-muted">
          {labels.join.participants(preview.participant_count)}
        </p>
      </header>

      <section
        aria-live="polite"
        className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4"
      >
        <p className="font-medium text-text">
          {total > 0 && done === total
            ? missing.length > 0
              ? labels.hub.upToDateWithMissing(shorten(missing))
              : labels.hub.upToDate
            : labels.hub.progress(done, total)}
        </p>
        {total > 0 ? (
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-brand transition-[width] duration-150"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        ) : null}
      </section>

      {participant.is_organizer && noOptionsAnywhere ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          {labels.hub.organizerNudge}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <li key={category.id}>
            <CategoryCard
              category={category}
              progress={data[category.id]}
              slug={slug}
              participantCount={preview.participant_count}
            />
          </li>
        ))}
      </ul>

      {/*
        Action principale ancrée en bas : c'est là que le pouce tombe
        (doc 05 §5.1-1). Elle disparaît quand il n'y a plus rien à faire —
        un bouton qui ne mène nulle part est pire qu'un bouton absent.
      */}
      {next ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto w-full max-w-[960px] px-1">
            <Button
              size="lg"
              block
              onClick={() => void navigate(routes.category(slug, next.id))}
            >
              {labels.hub.continue}
            </Button>
          </div>
        </div>
      ) : null}

      {participant.is_organizer ? (
        <Button asChild variant="link" className="self-start">
          <Link to={routes.settings(slug)}>{labels.hub.settings}</Link>
        </Button>
      ) : null}

      {sharing ? (
        <ShareSheet
          open
          title={preview.title}
          url={tripUrl(slug)}
          onContinue={() => setSharing(false)}
        />
      ) : null}
    </PageShell>
  )
}

function shorten(names: string[]): string[] {
  if (names.length <= MAX_NAMES) return names
  return [...names.slice(0, MAX_NAMES), `${names.length - MAX_NAMES} autres`]
}
