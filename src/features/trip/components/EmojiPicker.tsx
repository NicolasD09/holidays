import { cn } from '@/lib/utils'

/**
 * Sélecteur d'emoji de couverture.
 *
 * Vingt-quatre choix, pas un sélecteur complet : personne ne cherche 🫙 pour
 * des vacances, et un vrai sélecteur pèserait plus lourd que tout le reste de
 * l'écran. Un `radiogroup` plutôt qu'un `select` — on veut voir les options,
 * et les atteindre au pouce.
 */
const emojis = [
  '🏖️',
  '🏝️',
  '⛰️',
  '🏔️',
  '🗺️',
  '✈️',
  '🚐',
  '⛵',
  '🏕️',
  '🎿',
  '🌴',
  '🌊',
  '🍹',
  '🎒',
  '🧳',
  '🏰',
  '🎡',
  '🗿',
  '🌋',
  '🏄',
  '🚴',
  '🥾',
  '🎉',
  '☀️',
] as const

export function EmojiPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (emoji: string) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {emojis.map((emoji) => {
        const selected = emoji === value
        return (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={emoji}
            onClick={() => onChange(emoji)}
            className={cn(
              'size-11 rounded-[var(--radius-control)] text-2xl transition-colors duration-150',
              selected
                ? 'border-2 border-brand bg-surface-2'
                : 'border border-border hover:bg-surface-2',
            )}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        )
      })}
    </div>
  )
}
