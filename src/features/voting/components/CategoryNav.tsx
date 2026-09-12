import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/domain'

/**
 * Barre de navigation basse, persistante pendant le vote (doc 05 §5.3 É5,
 * tâche 2.3).
 *
 * Ancrée en bas, sous le pouce, et **hors flux** : la page réserve la hauteur
 * correspondante par un `padding-bottom`, faute de quoi la barre recouvrirait
 * le champ d'ajout de proposition — exactement le genre de chose invisible en
 * émulation et fatale sur un vrai téléphone (doc 11 §11.8).
 *
 * `env(safe-area-inset-bottom)` tient compte de la barre d'accueil iOS.
 */
export function CategoryNav({
  slug,
  categories,
  currentId,
}: {
  slug: string
  categories: Category[]
  currentId: string
}) {
  const index = categories.findIndex((category) => category.id === currentId)
  if (index === -1 || categories.length < 2) return null

  const previous = index > 0 ? categories[index - 1] : null
  const next = index < categories.length - 1 ? categories[index + 1] : null

  return (
    <nav
      aria-label={labels.categoryNav.ariaLabel}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2',
      )}
    >
      <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-2 px-4">
        {previous ? (
          <Link
            to={routes.category(slug, previous.id)}
            className={cn(buttonVariants({ variant: 'ghost' }), 'shrink-0')}
          >
            <span aria-hidden="true">←</span>
            <span className="sr-only sm:not-sr-only">{labels.categoryNav.previous}</span>
          </Link>
        ) : (
          <span className="w-11" />
        )}

        {/*
          Le compteur « 2/3 » est un raccourci visuel : sans nom explicite, un
          lecteur d'écran annoncerait « lien, 2 sur 3 » sans dire où il mène.
        */}
        <Link
          to={routes.trip(slug)}
          aria-label={labels.categoryNav.backToHub}
          className={cn(buttonVariants({ variant: 'ghost' }), 'min-w-0 flex-1')}
        >
          <span className="truncate">
            {labels.categoryNav.position(index + 1, categories.length)}
          </span>
        </Link>

        {next ? (
          <Link
            to={routes.category(slug, next.id)}
            className={cn(buttonVariants({ variant: 'ghost' }), 'shrink-0')}
          >
            <span className="sr-only sm:not-sr-only">{labels.categoryNav.next}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="w-11" />
        )}
      </div>
    </nav>
  )
}
