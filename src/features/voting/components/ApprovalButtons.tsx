import { useRef } from 'react'
import { approvalChoices } from '@/features/voting/components/approval-choices'
import { labels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { approvalValues, type ApprovalValue } from '@/types/domain'

/**
 * Les trois boutons de vote (doc 05 §5.3, §5.5).
 *
 * Un `radiogroup` navigable aux flèches avec `tabindex` mobile : un seul
 * bouton du groupe est dans l'ordre de tabulation, les flèches se déplacent à
 * l'intérieur. C'est le comportement attendu d'un groupe de radios, et ça
 * évite de traverser 30 boutons à la tabulation sur une liste de 10
 * propositions.
 *
 * Le sens n'est jamais porté par la seule couleur : chaque bouton porte une
 * icône *et* un libellé.
 */

export function ApprovalButtons({
  optionTitle,
  value,
  disabled,
  onVote,
}: {
  optionTitle: string
  value: ApprovalValue | null
  disabled?: boolean
  /** `null` quand on retape le bouton déjà sélectionné : le vote est retiré. */
  onVote: (value: ApprovalValue | null) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  function onKeyDown(event: React.KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(event.key)) return

    const buttons = Array.from(
      container.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
    )
    const current = buttons.findIndex((button) => button === document.activeElement)
    if (current === -1) return

    event.preventDefault()
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const next = buttons[(current + (forward ? 1 : -1) + buttons.length) % buttons.length]
    next?.focus()
  }

  // Sans sélection, c'est le premier bouton qui porte la tabulation.
  const focusable = value ?? approvalValues[0]

  return (
    <div
      ref={container}
      role="radiogroup"
      aria-label={labels.voting.groupLabel(optionTitle)}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 gap-2"
    >
      {approvalValues.map((choice) => {
        const selected = value === choice
        const { label, icon, className } = approvalChoices[choice]
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={choice === focusable ? 0 : -1}
            onClick={() => onVote(selected ? null : choice)}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)]',
              'border text-base font-medium transition-colors duration-150',
              'disabled:pointer-events-none disabled:opacity-50',
              selected
                ? className
                : 'border-border-strong bg-transparent text-text hover:bg-surface-2',
            )}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
