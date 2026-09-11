import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/common/StateBlock'
import { PageShell } from '@/components/common/PageShell'
import { Button } from '@/components/ui/button'
import { labels } from '@/lib/labels'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * Une frontière d'erreur par route (doc 04 §4.4) : une page qui casse ne doit
 * jamais emporter l'application entière ni laisser un écran blanc.
 * Le rapport Sentry sera branché ici au sprint 9.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[route]', error, info.componentStack)
  }

  override render() {
    if (!this.state.hasError) return this.props.children
    return (
      <PageShell>
        <ErrorState
          action={
            <Button onClick={() => window.location.reload()}>
              {labels.error.retry}
            </Button>
          }
        />
      </PageShell>
    )
  }
}
