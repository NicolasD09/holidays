import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
import { PageShell } from '@/components/common/PageShell'
import { LoadingState } from '@/components/common/StateBlock'
import { labels } from '@/lib/labels'

export function RootLayout() {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-fg"
      >
        {labels.nav.skipToContent}
      </a>
      <main id="contenu">
        <RouteErrorBoundary>
          {/*
            Les écrans sont chargés à la demande (tâche 7.3) : il faut donc une
            frontière d'attente. Elle est **sous** l'`ErrorBoundary`, pour
            qu'un morceau qui ne se télécharge pas — réseau coupé en cours de
            route — tombe sur le message d'erreur de la route plutôt que sur un
            écran blanc.

            Le repli reprend la forme d'un écran en chargement, jamais un
            spinner plein écran (doc 05 §5.3 É8).
          */}
          <Suspense
            fallback={
              <PageShell>
                <LoadingState />
              </PageShell>
            }
          >
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </>
  )
}
