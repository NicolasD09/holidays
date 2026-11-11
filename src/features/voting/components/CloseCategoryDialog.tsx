import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { LoadingState } from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { listAvailabilities } from '@/features/voting/api/availabilities'
import { fetchBudgetSummary } from '@/features/voting/api/budget'
import { fetchCategoryResults } from '@/features/voting/api/categoryResults'
import { listOptions } from '@/features/voting/api/options'
import {
  type ClosePick,
  optionPicks,
  suggestedPick,
  windowPicks,
} from '@/features/voting/components/close-picks'
import { followersAt, formatEuros, parseAmount } from '@/lib/budget'
import { DECISION_TEXT_MAX, isCompleteChoice } from '@/lib/decisions'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import { rankWindows } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { Category, CloseChoice } from '@/types/domain'

/** Valeur de la radio « Autre chose… ». */
const OTHER = '__other__'

/**
 * Modale de clôture (tâche 5.2).
 *
 * **L'organisateur tranche.** La tête de liste est pré-sélectionnée, parce
 * que c'est presque toujours elle ; mais n'importe quelle proposition, ou un
 * texte libre, se retient d'un tap. La base ne vérifie jamais que la décision
 * est « la gagnante » (recette du sprint 7, étape 2).
 *
 * **L'avertissement sur les non-votants est un nombre.** Pas de prénom ici :
 * c'est le hub qui nomme, et seulement à qui est à jour. La modale dit juste
 * ce que l'organisateur s'apprête à faire sans eux, sans l'en empêcher.
 *
 * Elle ne se monte qu'à l'ouverture : ses lectures — propositions, scores,
 * disponibilités ou résumé du budget — ne coûtent rien à qui ne clôture pas.
 * Elles réutilisent les clés de l'écran de vote, mais sont **relues à
 * l'ouverture** : le cache peut dater d'avant les derniers votes.
 */
export function CloseCategoryDialog({
  category,
  nonVoters,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  category: Category
  /** Participants qui ne se sont pas prononcés ici ; `null` si inconnu. */
  nonVoters: number | null
  pending: boolean
  error: unknown
  onConfirm: (choice: CloseChoice) => void
  onCancel: () => void
}) {
  const ids = useId()
  const mode = category.vote_mode
  const isDates = mode === 'availability'
  const isBudget = mode === 'amount'
  const hasOptions = !isDates && !isBudget

  const options = useQuery({
    queryKey: qk.options(category.id),
    queryFn: () => listOptions(category.id),
    enabled: hasOptions,
    refetchOnMount: 'always',
  })
  const results = useQuery({
    queryKey: qk.results(category.id),
    queryFn: () => fetchCategoryResults(category.id),
    enabled: hasOptions,
    refetchOnMount: 'always',
  })
  const availabilities = useQuery({
    queryKey: qk.availabilities(category.id),
    queryFn: () => listAvailabilities(category.id),
    enabled: isDates,
    refetchOnMount: 'always',
  })
  const summary = useQuery({
    queryKey: qk.budgetSummary(category.id),
    queryFn: () => fetchBudgetSummary(category.id),
    enabled: isBudget,
    refetchOnMount: 'always',
  })

  const picks = useMemo<ClosePick[]>(() => {
    if (hasOptions) return optionPicks(options.data ?? [], results.data ?? null, mode)
    if (isDates) {
      const { window_start: from, window_end: to, nights } = category
      if (from === null || to === null || nights === null) return []
      return windowPicks(
        rankWindows({
          windowStart: from,
          windowEnd: to,
          nights,
          availabilities: availabilities.data ?? [],
        }),
      )
    }
    return []
  }, [hasOptions, isDates, category, mode, options.data, results.data, availabilities.data])

  /*
    On attend la lecture **faite à l'ouverture**, pas seulement une donnée en
    cache : l'écran de vote a souvent mis les scores en cache avant les
    derniers votes, et le `staleTime` de l'app (30 s) les garderait. Trancher
    sur des chiffres périmés, c'est pré-sélectionner la mauvaise tête de liste
    — l'E2E du sprint 7 l'a attrapé.
  */
  const loading = hasOptions
    ? !options.isFetchedAfterMount || !results.isFetchedAfterMount
    : isDates
      ? !availabilities.isFetchedAfterMount
      : !summary.isFetchedAfterMount

  /*
    Sélection : tant que l'organisateur n'a rien touché, on suit la
    suggestion — elle arrive avec les données. Dès qu'il choisit, son choix
    gagne et ne bouge plus.
  */
  const [touched, setTouched] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [amountInput, setAmountInput] = useState<string | null>(null)

  const suggested = suggestedPick(picks)
  const readyBudget = summary.data?.status === 'ready' ? summary.data : null
  // Le montant que tout le monde suit : le plus inclusif, celui que Sarah
  // n'a pas à négocier (persona du doc 01).
  const amountText = amountInput ?? (readyBudget ? String(readyBudget.min) : '')

  const selected = touched ?? (isBudget ? 'amount' : (suggested?.id ?? (picks.length === 0 ? OTHER : null)))

  const choice: CloseChoice | null = (() => {
    if (selected === OTHER) return { kind: 'text', text: otherText }
    if (selected === 'amount') {
      const amount = parseAmount(amountText)
      return amount === null ? null : { kind: 'amount', amount }
    }
    return picks.find((pick) => pick.id === selected)?.choice ?? null
  })()

  const parsedAmount = isBudget ? parseAmount(amountText) : null
  const blind = hasOptions && results.data === null

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onInteractOutside={(event) => pending && event.preventDefault()}
      >
        <DialogTitle className="text-xl font-semibold">
          {labels.closure.dialogTitle(category.label)}
        </DialogTitle>
        <DialogDescription className="text-text-muted">
          {labels.closure.dialogBody}
        </DialogDescription>

        {nonVoters !== null && nonVoters > 0 ? (
          <p className="rounded-[var(--radius-control)] border border-maybe bg-surface-2 p-3 text-sm">
            {labels.closure.nonVoters(nonVoters)}
          </p>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : (
          <fieldset className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto">
            <legend className="mb-2 font-medium">{labels.closure.pickLegend}</legend>

            {blind ? <p className="mb-2 text-sm text-text-muted">{labels.closure.blindHint}</p> : null}

            {isBudget ? (
              <>
                <PickRow
                  name={`${ids}-pick`}
                  checked={selected === 'amount'}
                  disabled={pending}
                  label={labels.closure.amountLabel}
                  detail={null}
                  badge={null}
                  onSelect={() => setTouched('amount')}
                />
                {selected === 'amount' ? (
                  <div className="flex flex-col gap-1 pt-1 pb-2 pl-8">
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${ids}-amount`}
                        aria-label={labels.closure.amountLabel}
                        inputMode="numeric"
                        autoComplete="off"
                        className="max-w-40"
                        value={amountText}
                        disabled={pending}
                        onChange={(event) => setAmountInput(event.target.value)}
                      />
                      <span aria-hidden="true">€</span>
                    </div>
                    {readyBudget && parsedAmount !== null ? (
                      <p className="text-sm text-text-muted">
                        {labels.closure.amountHint(
                          labels.budget.affordability(
                            formatEuros(parsedAmount),
                            followersAt(readyBudget.curve, parsedAmount),
                            readyBudget.respondents,
                          ),
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : picks.length === 0 ? (
              <p className="mb-2 text-sm text-text-muted">{labels.closure.nothingToPick}</p>
            ) : (
              picks.map((pick) => (
                <PickRow
                  key={pick.id}
                  name={`${ids}-pick`}
                  checked={selected === pick.id}
                  disabled={pending}
                  label={pick.label}
                  detail={pick.detail}
                  badge={suggested?.id === pick.id ? labels.closure.leading : null}
                  onSelect={() => setTouched(pick.id)}
                />
              ))
            )}

            <PickRow
              name={`${ids}-pick`}
              checked={selected === OTHER}
              disabled={pending}
              label={labels.closure.other}
              detail={null}
              badge={null}
              onSelect={() => setTouched(OTHER)}
            />
            {selected === OTHER ? (
              <div className="flex flex-col gap-1 pt-1 pl-8">
                <label htmlFor={`${ids}-other`} className="text-sm font-medium">
                  {labels.closure.otherLabel}
                </label>
                <Input
                  id={`${ids}-other`}
                  autoFocus
                  maxLength={DECISION_TEXT_MAX}
                  placeholder={labels.closure.otherPlaceholder}
                  value={otherText}
                  disabled={pending}
                  onChange={(event) => setOtherText(event.target.value)}
                />
              </div>
            ) : null}
          </fieldset>
        )}

        {error ? (
          <p role="alert" className="text-sm text-no">
            {toUserMessage(error)}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            {labels.closure.cancel}
          </Button>
          <Button
            disabled={pending || loading || !isCompleteChoice(choice)}
            onClick={() => choice && onConfirm(choice)}
          >
            {pending ? labels.closure.closing : labels.closure.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PickRow({
  name,
  checked,
  disabled,
  label,
  detail,
  badge,
  onSelect,
}: {
  name: string
  checked: boolean
  disabled: boolean
  label: string
  detail: string | null
  badge: string | null
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] px-2 py-2',
        checked && 'bg-surface-2',
      )}
    >
      <input
        type="radio"
        name={name}
        className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span className="flex flex-col">
        <span className="flex flex-wrap items-center gap-2 text-text">
          {label}
          {badge ? (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-fg">
              {badge}
            </span>
          ) : null}
        </span>
        {detail ? <span className="text-sm text-text-muted">{detail}</span> : null}
      </span>
    </label>
  )
}
