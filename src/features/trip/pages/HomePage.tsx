import { useState } from 'react'
import { Link } from 'react-router'
import { PageShell } from '@/components/common/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardTitle } from '@/components/ui/card'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'
import { readVisitedTrips } from '@/lib/visitedTrips'

export function HomePage() {
  // Le lien « Mes sondages » n'apparaît que s'il mène quelque part
  // (doc 05 §5.3 É1) : un lien vers une liste vide est une fausse piste.
  const [hasTrips] = useState(() => readVisitedTrips().length > 0)

  return (
    <PageShell className="flex min-h-dvh flex-col justify-center gap-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="text-6xl" role="img" aria-label="Plage">
          🏖️
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">{labels.app.tagline}</h1>
        <p className="max-w-prose text-lg text-text-muted">{labels.app.description}</p>
      </header>

      <div className="flex flex-col items-center gap-3">
        <Button asChild size="lg" block className="sm:max-w-sm">
          <Link to={routes.createTrip}>{labels.home.createCta}</Link>
        </Button>
        {hasTrips ? (
          <Button asChild variant="link">
            <Link to={routes.myTrips}>{labels.home.myTrips}</Link>
          </Button>
        ) : null}
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {labels.home.sellingPoints.map((point) => (
          <li key={point.title}>
            <Card className="h-full">
              <CardTitle className="text-base">{point.title}</CardTitle>
              <CardBody className="mt-1 text-[0.9375rem]">{point.body}</CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
