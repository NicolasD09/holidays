import { useState } from 'react'
import { useJoinTrip } from '@/features/participant/hooks/useTripAccess'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import type { TripPreview } from '@/types/domain'

/**
 * É3 — l'écran qui convertit le pote fantôme (doc 05 §5.3).
 *
 * Le sondage reste visible derrière, atténué : on voit ce qu'on rejoint avant
 * de donner son prénom. Un champ, un bouton, rien d'autre — pas de mot de
 * passe, pas d'email, pas de CGU, et aucun consentement cookie puisqu'il n'y a
 * pas de traceur.
 *
 * Le panneau est ancré en bas : c'est là que le pouce tombe.
 */
export function JoinGate({ preview, slug }: { preview: TripPreview; slug: string }) {
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const join = useJoinTrip(slug)

  const trimmed = name.trim()
  const showRequired = touched && trimmed.length === 0

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (trimmed.length === 0) return
    join.mutate(trimmed)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)]">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-[480px] flex-col gap-3"
        noValidate
      >
        <h2 className="text-lg font-semibold">{labels.join.heading}</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="join-name" className="text-sm font-medium">
            {labels.join.nameLabel}
          </label>
          <Input
            id="join-name"
            name="prenom"
            autoComplete="given-name"
            enterKeyHint="go"
            maxLength={40}
            placeholder={labels.join.namePlaceholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={showRequired}
            aria-describedby={showRequired ? 'join-name-error' : undefined}
          />
          {showRequired ? (
            <p id="join-name-error" role="alert" className="text-sm text-no">
              {labels.join.errorNameRequired}
            </p>
          ) : null}
        </div>

        {join.isError ? (
          <p role="alert" className="text-sm text-no">
            {toUserMessage(join.error)}
          </p>
        ) : null}

        <Button type="submit" size="lg" block disabled={join.isPending}>
          {join.isPending ? labels.join.submitting : labels.join.submit}
        </Button>

        <p className="text-center text-sm text-text-muted">
          {labels.join.noAccount} · {labels.join.participants(preview.participant_count)}
        </p>
      </form>
    </div>
  )
}
