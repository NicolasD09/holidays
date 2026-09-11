import { Outlet } from 'react-router'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
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
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </>
  )
}
