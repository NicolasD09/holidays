import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { useTripContext } from '@/app/layouts/tripContext'
import { PageShell } from '@/components/common/PageShell'
import { ErrorState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import {
  swapCategoryPositions,
  updateCategory,
  type CategoryPatch,
} from '@/features/admin/api/updateCategory'
import { deleteTrip } from '@/features/admin/api/deleteTrip'
import { CategorySettingsCard } from '@/features/admin/components/CategorySettingsCard'
import { DangerZone } from '@/features/admin/components/DangerZone'
import { fetchTripProgress } from '@/features/trip/api/tripProgress'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import { routes } from '@/lib/routes'
import { forgetTrip } from '@/lib/visitedTrips'

/**
 * É7, partie « catégories » (tâche 2.5). Le reste de l'écran de réglages —
 * titre du sondage, participants, clôture, zone sensible — arrive au
 * sprint 7 ; l'annoncer vaut mieux que de laisser croire à un oubli.
 *
 * L'écran n'est qu'une commodité : c'est la policy `categories_write` qui
 * refuse l'écriture à un non-organisateur. Le masquer ici évite un bouton
 * qui échouerait, il ne protège rien par lui-même.
 */
export function TripSettingsPage() {
  const { slug, preview, participant, categories } = useTripContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const progress = useQuery({
    queryKey: qk.progress(preview.trip_id),
    queryFn: () => fetchTripProgress(preview.trip_id, participant.id, categories),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.categories(preview.trip_id) })
    await queryClient.invalidateQueries({ queryKey: qk.progress(preview.trip_id) })
  }

  const save = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CategoryPatch }) =>
      updateCategory(id, patch),
    onSuccess: invalidate,
  })

  const move = useMutation({
    mutationFn: ({ index, direction }: { index: number; direction: -1 | 1 }) => {
      const current = categories[index]
      const target = categories[index + direction]
      if (!current || !target) return Promise.resolve()
      return swapCategoryPositions(
        { id: current.id, position: current.position },
        { id: target.id, position: target.position },
      )
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: () => deleteTrip(preview.trip_id),
    onSuccess: () => {
      // Le sondage n'existe plus : purger le cache avant de naviguer évite
      // qu'un écran se remonte une seconde sur des données fantômes.
      forgetTrip(slug)
      queryClient.removeQueries({ queryKey: qk.trip(slug) })
      void navigate(routes.home, { replace: true })
    },
  })

  if (!participant.is_organizer) {
    return (
      <PageShell>
        <ErrorState
          title={labels.notFound.title}
          body={labels.categorySettings.subtitle}
          action={
            <Button asChild variant="outline">
              <Link to={routes.trip(slug)}>{labels.categoryNav.backToHub}</Link>
            </Button>
          }
        />
      </PageShell>
    )
  }

  const pending = save.isPending || move.isPending || remove.isPending

  return (
    <PageShell className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{labels.categorySettings.title}</h1>
        <p className="text-text-muted">{labels.categorySettings.subtitle}</p>
      </header>

      {save.isError || move.isError || remove.isError ? (
        <p role="alert" className="text-sm text-no">
          {toUserMessage(save.error ?? move.error ?? remove.error)}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {categories.map((category, index) => (
          <CategorySettingsCard
            key={category.id}
            category={category}
            hasVotes={(progress.data?.[category.id]?.voterIds.length ?? 0) > 0}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
            pending={pending}
            onSave={(patch) => save.mutate({ id: category.id, patch })}
            onMove={(direction) => move.mutate({ index, direction })}
          />
        ))}
      </div>

      <p className="text-sm text-text-muted">{labels.categorySettings.restSoon}</p>

      <Button asChild variant="outline" className="self-start">
        <Link to={routes.trip(slug)}>{labels.categoryNav.backToHub}</Link>
      </Button>

      <DangerZone
        tripTitle={preview.title}
        pending={remove.isPending}
        onDelete={() => remove.mutate()}
      />
    </PageShell>
  )
}
