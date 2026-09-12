import { useState } from 'react'
import { Link } from 'react-router'
import { PageShell } from '@/components/common/PageShell'
import { EmptyState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'
import { forgetTrip, readVisitedTrips } from '@/lib/visitedTrips'

/**
 * `/mine` — les sondages ouverts depuis cet appareil (tâche 2.6).
 *
 * Lecture unique au montage, pas de `useQuery` : la source est
 * `localStorage`, pas le réseau. La retenir dans un état évite de relire à
 * chaque rendu, et rien d'autre que cet écran ne la modifie.
 *
 * Les sondages ouverts **avant ce sprint** n'y figurent pas : rien n'était
 * enregistré jusqu'ici. C'est attendu, et l'écran vide le dit plutôt que de
 * laisser croire à une perte.
 */
export function MyTripsPage() {
  const [trips, setTrips] = useState(() => readVisitedTrips())

  function forget(slug: string) {
    forgetTrip(slug)
    setTrips((current) => current.filter((trip) => trip.slug !== slug))
  }

  if (trips.length === 0) {
    return (
      <PageShell>
        <EmptyState
          title={labels.myTrips.empty}
          body={labels.myTrips.emptyHint}
          action={
            <Button asChild>
              <Link to={routes.createTrip}>{labels.home.createCta}</Link>
            </Button>
          }
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{labels.myTrips.title}</h1>
        <p className="text-text-muted">{labels.myTrips.subtitle}</p>
      </header>

      <ul className="flex flex-col gap-3">
        {trips.map((trip) => (
          <li
            key={trip.slug}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface-2 p-3"
          >
            <Link
              to={routes.trip(trip.slug)}
              className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true" className="text-2xl">
                {trip.emoji ?? '🏖️'}
              </span>
              <span className="truncate font-medium text-text">{trip.title}</span>
            </Link>
            <Button
              variant="ghost"
              aria-label={labels.myTrips.forgetLabel(trip.title)}
              onClick={() => forget(trip.slug)}
            >
              <span aria-hidden="true">✕</span>
            </Button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-text-muted">{labels.myTrips.localOnly}</p>
    </PageShell>
  )
}
