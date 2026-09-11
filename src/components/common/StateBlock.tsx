import type { ReactNode } from 'react'
import { labels } from '@/lib/labels'

type StateBlockProps = {
  title: string
  body?: string
  icon?: ReactNode
  action?: ReactNode
}

/**
 * Bloc d'état centré, partagé par les états vide / erreur / chargement.
 * Règle (doc 05 §5.1) : jamais d'écran vide sans issue — d'où `action`.
 */
export function StateBlock({ title, body, icon, action }: StateBlockProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon ? <div className="text-4xl">{icon}</div> : null}
      <h2 className="text-xl font-semibold text-text">{title}</h2>
      {body ? <p className="max-w-prose text-text-muted">{body}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  )
}

export function EmptyState({ title, body, action }: StateBlockProps) {
  return <StateBlock title={title} body={body} action={action} icon="🏝️" />
}

export function ErrorState({
  title = labels.error.title,
  body = labels.error.body,
  action,
}: Partial<StateBlockProps>) {
  return (
    <div role="alert">
      <StateBlock title={title} body={body} action={action} icon="⚠️" />
    </div>
  )
}

export function LoadingState({ title = labels.loading.default }: { title?: string }) {
  return (
    <div role="status" aria-live="polite" className="py-12 text-center text-text-muted">
      {title}
    </div>
  )
}
