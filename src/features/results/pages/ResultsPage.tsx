import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTripContext } from '@/app/layouts/tripContext'
import { PageShell } from '@/components/common/PageShell'
import { ErrorState, LoadingState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { listParticipants } from '@/features/participant/api/listParticipants'
import { RecapBlock } from '@/features/results/components/RecapBlock'
import { fetchTripProgress } from '@/features/trip/api/tripProgress'
import { categoryEmoji } from '@/features/trip/components/category-catalogue'
import { useDecisions } from '@/features/trip/hooks/useCategoryClosure'
import { useClipboard } from '@/hooks/useClipboard'
import { summaryItems } from '@/lib/decisions'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import { routes } from '@/lib/routes'
import { canShareNatively, recapUrl, shareNatively } from '@/lib/share'

/**
 * É6 — le récapitulatif (doc 05 §5.3, tâche 5.4) : la page qu'on renvoie dans
 * le groupe pour clore le débat.
 *
 * - En tête, **le bandeau de synthèse** : une ligne, une décision par
 *   catégorie tranchée — « 🌍 Lisbonne · 📅 10 → 17 juil. · 💶 ~750 € ».
 * - Puis un bloc par catégorie : la décision mise en avant, ou le meneur du
 *   moment si elle est encore ouverte ; qui s'est prononcé ; et le classement
 *   complet, replié.
 *
 * Quand toutes les catégories sont tranchées, le lien du sondage arrive ici
 * directement (`TripHubPage` redirige). « Revenir au sondage » disparaît
 * alors : il ramènerait ici.
 *
 * Rien n'est calculé de neuf : décisions, participation et meneurs viennent
 * des mêmes lectures que le hub, et le budget n'y donne, comme partout, qu'un
 * nombre de réponses (ADR-006).
 */
export function ResultsPage() {
  const { slug, preview, participant, categories } = useTripContext()
  const { copy, copied } = useClipboard()
  const [copyFailed, setCopyFailed] = useState(false)

  const decisions = useDecisions(preview.trip_id)
  const progress = useQuery({
    queryKey: qk.progress(preview.trip_id),
    queryFn: () => fetchTripProgress(preview.trip_id, participant.id, categories),
  })
  const participants = useQuery({
    queryKey: qk.participants(preview.trip_id),
    queryFn: () => listParticipants(preview.trip_id),
  })

  if (decisions.isPending || progress.isPending) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (decisions.isError || progress.isError) {
    return (
      <PageShell>
        <ErrorState
          body={toUserMessage(decisions.error ?? progress.error)}
          action={
            <Button
              onClick={() => {
                void decisions.refetch()
                void progress.refetch()
              }}
            >
              {labels.error.tryAgain}
            </Button>
          }
        />
      </PageShell>
    )
  }

  const items = summaryItems(categories, decisions.data, (category) =>
    categoryEmoji(category.kind),
  )
  const line = items.join(' · ')
  const decided = categories.filter((category) => category.status === 'closed').length
  const finished = preview.status === 'closed'
  const emoji = preview.cover_emoji ?? '🏖️'
  const url = recapUrl(slug)
  const message = labels.recap.shareMessage(emoji, preview.title, line)

  async function onShare() {
    // Le partage natif d'abord sur téléphone ; la copie reste le chemin sûr
    // partout ailleurs, y compris dans les navigateurs intégrés.
    if (canShareNatively() && (await shareNatively(preview.title, message, url))) return
    const ok = await copy(`${message}\n${url}`)
    setCopyFailed(!ok)
  }

  const names = new Map((participants.data ?? []).map((item) => [item.id, item.display_name]))

  return (
    <PageShell className="flex flex-col gap-6 pb-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-text-muted">{labels.recap.title}</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <span aria-hidden="true">{emoji}</span>
          {preview.title}
        </h1>
        <p className="text-text-muted">
          {finished ? labels.recap.allDecided : labels.recap.progress(decided, categories.length)}
        </p>
      </header>

      {line ? (
        <section
          aria-label={labels.recap.summaryLabel}
          className="rounded-[var(--radius-card)] border border-brand bg-surface-2 p-4"
        >
          <p className="text-lg font-semibold leading-snug text-text">
            {items.map((item, index) => (
              <span key={item}>
                {index > 0 ? ' · ' : null}
                <span className="whitespace-nowrap">{item}</span>
              </span>
            ))}
          </p>
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={() => void onShare()}>
          {copied ? labels.recap.shareCopied : labels.recap.share}
        </Button>
        {finished ? null : (
          <Button asChild size="lg" variant="outline">
            <Link to={routes.trip(slug)}>{labels.recap.backToTrip}</Link>
          </Button>
        )}
      </div>
      {copyFailed ? (
        <p role="alert" className="text-sm text-no">
          {labels.share.copyFailed}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {categories.map((category) => (
          <li key={category.id}>
            <RecapBlock
              category={category}
              slug={slug}
              decision={decisions.data.find((item) => item.categoryId === category.id) ?? null}
              progress={progress.data[category.id]}
              voterNames={(progress.data[category.id]?.voterIds ?? []).flatMap((id) => {
                const name = names.get(id)
                return name ? [name] : []
              })}
              participants={participants.data ?? []}
            />
          </li>
        ))}
      </ul>

      {participant.is_organizer ? (
        <Button asChild variant="link" className="self-start">
          <Link to={routes.settings(slug)}>{labels.hub.settings}</Link>
        </Button>
      ) : null}
    </PageShell>
  )
}
