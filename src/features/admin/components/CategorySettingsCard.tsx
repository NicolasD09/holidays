import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CategoryPatch } from '@/features/admin/api/updateCategory'
import {
  BUDGET_SCOPE_MAX,
  categoryEmoji,
  type DatesConfig,
  selectableVoteModes,
  validateDatesConfig,
} from '@/features/trip/components/category-catalogue'
import { labels } from '@/lib/labels'
import type { Category, VoteMode } from '@/types/domain'

/**
 * Les réglages d'une catégorie (tâche 2.5) : nom, mode de vote, plafond,
 * propositions autorisées, et sa place dans la liste.
 *
 * Le changement de mode **n'efface jamais de votes**. Il les laisse en place
 * et prévient qu'ils peuvent devenir incohérents — par exemple deux choix
 * dans une catégorie passée en choix unique. Supprimer des votes serait
 * irréversible, donc hors de ce que je décide seul (doc 08 §8.2) ; et
 * interdire le changement créerait un cul-de-sac. Prévenir laisse la main.
 *
 * Depuis le sprint 7, deux réglages de plus :
 * - la **précision** de la catégorie — pour le budget, ce que couvre le
 *   montant (dette n° 6 du doc 16) ;
 * - la **période de recherche** d'une catégorie dates (dette n° 5 du doc 15).
 *   La réduire n'efface rien : les jours qui en sortent dorment en base et
 *   reviennent si on l'élargit. C'est ce qui la rend modifiable sans ton
 *   accord. Elle se fige une fois la catégorie tranchée — le créneau retenu
 *   pourrait en sortir.
 */
export function CategorySettingsCard({
  category,
  hasVotes,
  isFirst,
  isLast,
  pending,
  onSave,
  onMove,
}: {
  category: Category
  hasVotes: boolean
  isFirst: boolean
  isLast: boolean
  pending: boolean
  onSave: (patch: CategoryPatch) => void
  onMove: (direction: -1 | 1) => void
}) {
  const [label, setLabel] = useState(category.label)
  const [voteMode, setVoteMode] = useState<VoteMode>(category.vote_mode)
  const [maxChoices, setMaxChoices] = useState(
    category.max_choices === null ? '' : String(category.max_choices),
  )
  const [allowOptions, setAllowOptions] = useState(category.allow_participant_options)
  const [description, setDescription] = useState(category.description ?? '')
  const [dates, setDates] = useState<DatesConfig>({
    windowStart: category.window_start ?? '',
    windowEnd: category.window_end ?? '',
    nights: category.nights === null ? '' : String(category.nights),
  })
  const [error, setError] = useState<string | null>(null)

  const isDates = category.vote_mode === 'availability'
  const fixedMode = isDates || category.vote_mode === 'amount'
  const closed = category.status === 'closed'
  const datesDirty =
    isDates &&
    (dates.windowStart !== (category.window_start ?? '') ||
      dates.windowEnd !== (category.window_end ?? '') ||
      dates.nights !== (category.nights === null ? '' : String(category.nights)))

  const dirty =
    label !== category.label ||
    voteMode !== category.vote_mode ||
    allowOptions !== category.allow_participant_options ||
    (maxChoices === '' ? null : Number(maxChoices)) !== category.max_choices ||
    description !== (category.description ?? '') ||
    datesDirty

  function save() {
    const trimmed = label.trim()
    if (!trimmed) {
      setError(labels.categorySettings.errorLabelRequired)
      return
    }

    let parsedMax: number | null = null
    if (voteMode === 'multiple' && maxChoices !== '') {
      parsedMax = Number(maxChoices)
      if (!Number.isInteger(parsedMax) || parsedMax < 1) {
        setError(labels.categorySettings.errorMaxChoices)
        return
      }
    }

    if (description.trim().length > BUDGET_SCOPE_MAX) {
      setError(labels.categorySettings.errorDescriptionTooLong(BUDGET_SCOPE_MAX))
      return
    }

    if (datesDirty) {
      const problem = validateDatesConfig(dates)
      if (problem) {
        setError(labels.create[problem])
        return
      }
    }

    setError(null)

    // Dates et budget : ni mode, ni plafond, ni propositions à régler — la
    // base refuse d'ailleurs de changer leur mode (migration 9).
    if (fixedMode) {
      onSave({
        label: trimmed,
        description: description.trim() || null,
        ...(datesDirty
          ? {
              window_start: dates.windowStart,
              window_end: dates.windowEnd,
              nights: Number(dates.nights),
            }
          : {}),
      })
      return
    }

    onSave({
      description: description.trim() || null,
      label: trimmed,
      vote_mode: voteMode,
      // Le plafond n'a de sens qu'en choix multiple : changer de mode le
      // remet à zéro plutôt que de le laisser traîner en base.
      max_choices: voteMode === 'multiple' ? parsedMax : null,
      allow_participant_options: allowOptions,
    })
  }

  const fieldId = (name: string) => `category-${category.id}-${name}`

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden="true">{categoryEmoji(category.kind)}</span>
          {category.label}
        </h2>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            disabled={isFirst || pending}
            aria-label={labels.categorySettings.moveUpLabel(category.label)}
            onClick={() => onMove(-1)}
          >
            <span aria-hidden="true">↑</span>
          </Button>
          <Button
            variant="ghost"
            disabled={isLast || pending}
            aria-label={labels.categorySettings.moveDownLabel(category.label)}
            onClick={() => onMove(1)}
          >
            <span aria-hidden="true">↓</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId('label')} className="font-medium">
          {labels.categorySettings.labelField}
        </label>
        <Input
          id={fieldId('label')}
          maxLength={60}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId('description')} className="font-medium">
          {labels.categorySettings.descriptionField}
        </label>
        <Input
          id={fieldId('description')}
          maxLength={BUDGET_SCOPE_MAX}
          value={description}
          placeholder={category.vote_mode === 'amount' ? labels.create.budgetScopePlaceholder : undefined}
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="text-sm text-text-muted">
          {category.vote_mode === 'amount'
            ? labels.categorySettings.budgetScopeHint
            : labels.categorySettings.descriptionHint}
        </p>
      </div>

      {isDates ? (
        <fieldset className="flex flex-col gap-3" disabled={closed}>
          <legend className="mb-2 font-medium">{labels.categorySettings.windowField}</legend>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {labels.create.datesFrom}
              <Input
                type="date"
                value={dates.windowStart}
                onChange={(event) => setDates({ ...dates, windowStart: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {labels.create.datesTo}
              <Input
                type="date"
                value={dates.windowEnd}
                onChange={(event) => setDates({ ...dates, windowEnd: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {labels.create.datesNights}
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                className="max-w-24"
                value={dates.nights}
                onChange={(event) => setDates({ ...dates, nights: event.target.value })}
              />
            </label>
          </div>
          <p className="text-sm text-text-muted">
            {closed ? labels.categorySettings.closedLocked : labels.categorySettings.windowHint}
          </p>
        </fieldset>
      ) : null}

      {/*
        Dates et budget ne se « votent » pas : leur fonctionnement découle du
        type. Proposer ici « Approbation » sur un budget le casserait — plus
        d'écran de saisie, et des montants orphelins en base.
      */}
      {fixedMode ? (
        <p className="text-sm text-text-muted">{labels.categorySettings.fixedMode}</p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">{labels.categorySettings.modeField}</legend>
            {selectableVoteModes.map((mode) => (
              <label key={mode} className="flex cursor-pointer items-start gap-3 py-1">
                <input
                  type="radio"
                  name={fieldId('mode')}
                  className="mt-1 size-5 accent-[var(--color-brand)]"
                  checked={voteMode === mode}
                  onChange={() => setVoteMode(mode)}
                />
                <span className="flex flex-col">
                  <span className="text-text">{labels.voteModes[mode].label}</span>
                  <span className="text-sm text-text-muted">{labels.voteModes[mode].hint}</span>
                </span>
              </label>
            ))}
            {hasVotes && voteMode !== category.vote_mode ? (
              <p role="alert" className="text-sm text-maybe">
                {labels.categorySettings.votesWarning}
              </p>
            ) : null}
          </fieldset>

          {voteMode === 'multiple' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId('max')} className="font-medium">
                {labels.categorySettings.maxChoicesField}
              </label>
              <Input
                id={fieldId('max')}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                className="max-w-32"
                value={maxChoices}
                onChange={(event) => setMaxChoices(event.target.value)}
              />
              <p className="text-sm text-text-muted">{labels.categorySettings.maxChoicesHint}</p>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--color-brand)]"
              checked={allowOptions}
              onChange={(event) => setAllowOptions(event.target.checked)}
            />
            <span className="flex flex-col">
              <span className="text-text">{labels.categorySettings.allowOptions}</span>
              <span className="text-sm text-text-muted">
                {labels.categorySettings.allowOptionsHint}
              </span>
            </span>
          </label>
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm text-no">
          {error}
        </p>
      ) : null}

      <Button onClick={save} disabled={!dirty || pending} className="self-start">
        {pending ? labels.categorySettings.saving : labels.categorySettings.save}
      </Button>
    </section>
  )
}
