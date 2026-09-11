import { Link } from 'react-router'
import { PageShell } from '@/components/common/PageShell'
import { StateBlock } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'

/**
 * Lien invalide ou sondage supprimé.
 * RM-11 : ne révèle jamais l'existence d'autres sondages.
 */
export function NotFoundPage() {
  return (
    <PageShell className="flex min-h-dvh flex-col justify-center">
      <StateBlock
        icon="🧭"
        title={labels.notFound.title}
        body={labels.notFound.body}
        action={
          <Button asChild>
            <Link to={routes.createTrip}>{labels.notFound.cta}</Link>
          </Button>
        }
      />
    </PageShell>
  )
}
