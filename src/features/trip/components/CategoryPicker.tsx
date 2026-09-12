import {
  categoryCatalogue,
  selectableVoteModes,
  type CategorySelection,
  type SelectableVoteMode,
} from '@/features/trip/components/category-catalogue'
import { Input } from '@/components/ui/input'
import { labels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { CategoryKind } from '@/types/domain'

/**
 * Sélecteur de catégories à la création (doc 05 §5.3 É2, tâche 2.1).
 *
 * Des **cases à cocher**, pas des radios : les catégories se cumulent. La
 * destination est cochée et verrouillée — un sondage sans rien à décider
 * n'existe pas, et la retirer n'aurait aucun sens utilisateur.
 *
 * Les catégories dont l'écran n'existe pas encore sont affichées **grisées**
 * plutôt qu'absentes : le plan du produit se voit, et rien ne part au serveur.
 */
export function CategoryPicker({
  value,
  onChange,
  error,
}: {
  value: CategorySelection
  onChange: (next: CategorySelection) => void
  error?: string
}) {
  function toggleKind(kind: CategoryKind, checked: boolean) {
    onChange({
      ...value,
      kinds: checked
        ? [...value.kinds, kind]
        : value.kinds.filter((item) => item !== kind),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {categoryCatalogue.map((entry) => {
          const checked = value.kinds.includes(entry.kind)
          const disabled = !entry.available || entry.locked

          return (
            <li key={entry.kind}>
              <label
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border p-3',
                  'transition-colors duration-150',
                  entry.available
                    ? 'cursor-pointer border-border bg-surface-2 has-[:checked]:border-brand'
                    : 'cursor-not-allowed border-border bg-surface opacity-60',
                  entry.locked && 'cursor-default',
                )}
              >
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--color-brand)]"
                  checked={entry.available && (checked || Boolean(entry.locked))}
                  disabled={disabled}
                  onChange={(event) => toggleKind(entry.kind, event.target.checked)}
                />
                <span aria-hidden="true" className="text-xl">
                  {entry.emoji}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium text-text">{entry.label}</span>
                  {entry.locked ? (
                    <span className="text-sm text-text-muted">
                      {labels.create.categoryLocked}
                    </span>
                  ) : null}
                  {!entry.available ? (
                    <span className="text-sm text-text-muted">
                      {labels.create.categorySoon}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}

        <li>
          <label
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-card)]',
              'border border-border bg-surface-2 p-3 transition-colors duration-150',
              'has-[:checked]:border-brand',
            )}
          >
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-brand)]"
              checked={value.custom.enabled}
              onChange={(event) =>
                onChange({
                  ...value,
                  custom: { ...value.custom, enabled: event.target.checked },
                })
              }
            />
            <span aria-hidden="true" className="text-xl">
              ➕
            </span>
            <span className="font-medium text-text">{labels.categories.custom}</span>
          </label>
        </li>
      </ul>

      <p className="text-sm text-text-muted">{labels.create.categorySoonHint}</p>

      {value.kinds.includes('dates') ? (
        <fieldset className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4">
          <legend className="font-medium">{labels.create.datesWindowLabel}</legend>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="dates-from" className="text-sm font-medium">
                {labels.create.datesFrom}
              </label>
              <Input
                id="dates-from"
                type="date"
                value={value.dates.windowStart}
                onChange={(event) =>
                  onChange({
                    ...value,
                    dates: { ...value.dates, windowStart: event.target.value },
                  })
                }
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="dates-to" className="text-sm font-medium">
                {labels.create.datesTo}
              </label>
              <Input
                id="dates-to"
                type="date"
                value={value.dates.windowEnd}
                onChange={(event) =>
                  onChange({
                    ...value,
                    dates: { ...value.dates, windowEnd: event.target.value },
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="dates-nights" className="text-sm font-medium">
              {labels.create.datesNights}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="dates-nights"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                className="max-w-24"
                value={value.dates.nights}
                onChange={(event) =>
                  onChange({ ...value, dates: { ...value.dates, nights: event.target.value } })
                }
              />
              <span className="text-text-muted">{labels.create.datesNightsSuffix}</span>
            </div>
          </div>

          <p className="text-sm text-text-muted">{labels.create.datesHint}</p>
        </fieldset>
      ) : null}

      {value.custom.enabled ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="custom-category-label" className="font-medium">
              {labels.create.customLabelField}
            </label>
            <Input
              id="custom-category-label"
              maxLength={60}
              placeholder={labels.create.customLabelPlaceholder}
              value={value.custom.label}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'custom-category-error' : undefined}
              onChange={(event) =>
                onChange({
                  ...value,
                  custom: { ...value.custom, label: event.target.value },
                })
              }
            />
            {error ? (
              <p id="custom-category-error" role="alert" className="text-sm text-no">
                {error}
              </p>
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">{labels.create.customModeLabel}</legend>
            {selectableVoteModes.map((mode) => (
              <label key={mode} className="flex cursor-pointer items-start gap-3 py-1">
                <input
                  type="radio"
                  name="custom-vote-mode"
                  className="mt-1 size-5 accent-[var(--color-brand)]"
                  checked={value.custom.voteMode === mode}
                  onChange={() => onChange({ ...value, custom: { ...value.custom, voteMode: mode } })}
                />
                <span className="flex flex-col">
                  <span className="text-text">{voteModeLabel(mode)}</span>
                  <span className="text-sm text-text-muted">{voteModeHint(mode)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  )
}

function voteModeLabel(mode: SelectableVoteMode): string {
  return labels.voteModes[mode].label
}

function voteModeHint(mode: SelectableVoteMode): string {
  return labels.voteModes[mode].hint
}
