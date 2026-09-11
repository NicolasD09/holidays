import { Link } from 'react-router'
import { StateBlock } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'

/**
 * Écran de remplacement pour une route dont l'implémentation viendra dans un
 * sprint ultérieur. Volontairement explicite : mieux vaut annoncer qu'un
 * écran n'existe pas encore que de laisser une page blanche.
 */
export function SoonState({ body }: { body: string }) {
  return (
    <StateBlock
      icon="🚧"
      title={labels.soon.badge}
      body={`${body} ${labels.soon.body}`}
      action={
        <Button asChild variant="outline">
          <Link to={routes.home}>{labels.nav.backToHome}</Link>
        </Button>
      }
    />
  )
}
