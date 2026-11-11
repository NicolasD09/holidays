import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatEuros, parseAmount } from '@/lib/budget'
import { labels } from '@/lib/labels'

/**
 * La saisie du budget (doc 05 §5.3 5.c, tâche 4.2).
 *
 * Un seul champ, grand, clavier numérique. La **promesse de confidentialité**
 * est sous le champ, toujours visible, jamais repliée : c'est elle qui rend
 * une réponse sincère possible (persona Sarah, ADR-006). Elle n'est pas une
 * mention légale, elle fait partie du formulaire — d'où `aria-describedby`.
 *
 * `type="text"` + `inputMode="numeric"` plutôt que `type="number"` : ce
 * dernier accepte « e », ôte les zéros, change de valeur à la molette, et sur
 * iOS n'ouvre même pas le pavé numérique.
 */
export function BudgetInput({
  saved,
  disabled,
  pending,
  error,
  onSave,
  onClear,
}: {
  /** Le montant enregistré, ou `null` si je n'ai pas encore répondu. */
  saved: number | null
  disabled: boolean
  pending: boolean
  /** Message d'échec du dernier enregistrement, déjà traduit. */
  error: string | null
  onSave: (amount: number) => void
  onClear: () => void
}) {
  const [draft, setDraft] = useState(saved === null ? '' : String(saved))
  const [invalid, setInvalid] = useState(false)

  const parsed = parseAmount(draft)
  const unchanged = parsed !== null && parsed === saved

  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSave(parsed)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="budget-amount" className="font-medium">
        {labels.budget.question}
      </label>

      <div className="flex items-center gap-2">
        <Input
          id="budget-amount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={9}
          className="h-14 max-w-48 text-2xl font-semibold"
          placeholder={labels.budget.placeholder}
          value={draft}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'budget-error budget-promise' : 'budget-promise'}
          onChange={(event) => {
            setDraft(event.target.value)
            setInvalid(false)
          }}
        />
        <span aria-hidden="true" className="text-2xl font-semibold text-text-muted">
          €
        </span>
      </div>

      {invalid ? (
        <p id="budget-error" role="alert" className="text-sm text-no">
          {labels.budget.errorInvalid}
        </p>
      ) : null}

      <p id="budget-promise" className="text-sm text-text-muted">
        <span aria-hidden="true">🔒 </span>
        {labels.budget.promise}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-no">
          {error}
        </p>
      ) : null}

      {disabled ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || unchanged}>
            {pending
              ? labels.budget.saving
              : saved === null
                ? labels.budget.save
                : labels.budget.update}
          </Button>
          {saved !== null ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setDraft('')
                setInvalid(false)
                onClear()
              }}
            >
              {labels.budget.clear}
            </Button>
          ) : null}
        </div>
      )}

      {/* Confirmation lue par les lecteurs d'écran (doc 05 §5.5). */}
      <p aria-live="polite" className="text-sm text-text-muted">
        {saved !== null && !pending ? labels.budget.saved(formatEuros(saved)) : ''}
      </p>
    </form>
  )
}
