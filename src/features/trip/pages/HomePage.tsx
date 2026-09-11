import { Link } from 'react-router'
import { PageShell } from '@/components/common/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardTitle } from '@/components/ui/card'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'

export function HomePage() {
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
        <Button asChild variant="link">
          <Link to={routes.myTrips}>{labels.home.myTrips}</Link>
        </Button>
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
