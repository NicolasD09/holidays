import { Navigate } from 'react-router'
import { useTripContext } from '@/app/layouts/tripContext'
import { PageShell } from '@/components/common/PageShell'
import { EmptyState } from '@/components/common/StateBlock'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'

/**
 * Hub du sondage — **pas encore un hub** (doc 08, sprint 3).
 *
 * Au sprint 2 il n'y a qu'une catégorie : afficher un tableau de bord pour la
 * choisir serait un écran de plus entre le lien et le vote. On redirige donc
 * vers l'unique catégorie. Le vrai hub É4 remplacera cette page au sprint 3
 * sans toucher au reste : l'URL `/t/:slug` ne change pas.
 */
export function TripHubPage() {
  const { slug, categories } = useTripContext()
  const first = categories[0]

  if (!first) {
    return (
      <PageShell>
        <EmptyState title={labels.trip.noCategories} />
      </PageShell>
    )
  }

  return <Navigate to={routes.category(slug, first.id)} replace />
}
