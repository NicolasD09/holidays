import { Outlet, useParams } from 'react-router'
import type { TripContext } from '@/app/layouts/tripContext'
import { NotFoundPage } from '@/app/pages/NotFoundPage'
import { PageShell } from '@/components/common/PageShell'
import { ErrorState, LoadingState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { JoinGate } from '@/features/participant/components/JoinGate'
import { TripPreviewBackdrop } from '@/features/participant/components/TripPreviewBackdrop'
import { useTripAccess } from '@/features/participant/hooks/useTripAccess'
import { extractCode, toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'

/**
 * Enveloppe des écrans d'un sondage, et garde de participation (doc 04 §4.4).
 *
 * Elle ne redirige **jamais** : si cet appareil n'est pas participant, elle
 * superpose le `JoinGate` à l'aperçu. Le lien partagé reste donc valide et
 * identique pour tout le monde — c'est lui qu'on recolle dans le groupe, il ne
 * doit pas se transformer en `/join` en route.
 */
export function TripLayout() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { preview, participant, categories, isParticipant } = useTripAccess(slug)

  if (preview.isPending) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (preview.isError) {
    // Lien invalide, sondage supprimé ou archivé : la page dédiée, au ton
    // léger, sans jamais révéler l'existence d'autres sondages (doc 05 §5.3).
    const code = extractCode(preview.error)
    if (code === 'trip_not_found' || code === 'trip_archived') return <NotFoundPage />

    return (
      <PageShell>
        <ErrorState
          body={toUserMessage(preview.error)}
          action={
            <Button onClick={() => void preview.refetch()}>{labels.error.retry}</Button>
          }
        />
      </PageShell>
    )
  }

  // Pas encore participant — ou fiche introuvable parce que l'identité de
  // l'appareil a changé entre deux lectures (session effacée, autre
  // navigateur) : dans les deux cas on repropose l'adhésion plutôt que
  // d'afficher un écran cassé.
  const gate = (
    <>
      <TripPreviewBackdrop preview={preview.data} />
      <JoinGate preview={preview.data} slug={slug} />
    </>
  )

  if (!isParticipant) return gate

  if (participant.isPending || categories.isPending) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (!participant.data) return gate

  const context: TripContext = {
    slug,
    preview: preview.data,
    participant: participant.data,
    categories: categories.data ?? [],
  }

  return <Outlet context={context} />
}
