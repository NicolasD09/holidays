import { choiceModeCopy, type ChoiceMode } from '@/features/voting/components/choice-modes'
import { cn } from '@/lib/utils'

/**
 * Le contrôle de vote des modes `single` et `multiple` (tâche 2.4).
 *
 * Un seul bouton par proposition — on retient, ou pas. Rien à voir avec
 * l'approbation, qui demande une nuance sur chaque ligne : ici la question
 * est binaire, et trois boutons pour y répondre seraient trois fois trop.
 *
 * Le rôle ARIA suit le mode : `radio` quand un seul choix est possible — le
 * `radiogroup` est porté par la liste, dans `CategoryPage` —, `checkbox`
 * quand plusieurs le sont. Ce n'est pas cosmétique : c'est ce qui dit à un
 * lecteur d'écran si cocher ici décoche ailleurs.
 *
 * Hauteur 44 px minimum, sans exception (doc 05 §5.2).
 */
export function ChoiceButton({
  mode,
  optionTitle,
  selected,
  disabled,
  onToggle,
}: {
  mode: ChoiceMode
  optionTitle: string
  selected: boolean
  /** Vrai quand la catégorie est clôturée, ou le plafond atteint ailleurs. */
  disabled?: boolean
  onToggle: (next: boolean) => void
}) {
  const copy = choiceModeCopy[mode]

  return (
    <button
      type="button"
      role={mode === 'single' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      aria-label={copy.accessibleLabel(optionTitle)}
      disabled={disabled}
      onClick={() => onToggle(!selected)}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)]',
        'border text-base font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-brand bg-brand text-brand-fg'
          : 'border-border-strong bg-transparent text-text hover:bg-surface-2',
      )}
    >
      <span aria-hidden="true">{selected ? '✓' : '+'}</span>
      {selected ? copy.active : copy.idle}
    </button>
  )
}
