import {
  brushStyles,
  type DayDensity,
} from '@/features/voting/components/availability-brush'
import { formatDay, formatDayNumber } from '@/lib/dates'
import { labels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { AvailabilityStatus } from '@/types/domain'

/**
 * Une case de la grille de disponibilités (doc 05 §5.3 5.b).
 *
 * Trois choses se superposent dans 44 pixels :
 * 1. **le fond de densité** — combien du groupe est libre ce jour-là ;
 * 2. **mon état**, en aplat de couleur ;
 * 3. **un glyphe**, parce que le sens n'est jamais porté par la seule couleur
 *    (doc 05 §5.2) — et parce que le fond de densité assombrit déjà l'aplat.
 *
 * La case ne gère **aucun geste** : `pointerdown` et `pointermove` vivent sur
 * la grille, qui capture le pointeur pour suivre le doigt d'une case à l'autre.
 * Elle expose seulement `data-day`, que la grille relit sous le curseur.
 */

export function DayCell({
  day,
  status,
  density,
  respondents,
  tabIndex,
  disabled,
  onKeyDown,
  onFocus,
}: {
  day: string
  /** Mon état sur ce jour, aperçu du geste en cours compris. */
  status: AvailabilityStatus | undefined
  density: DayDensity | undefined
  /** Combien de personnes ont peint quelque chose, toutes dates confondues. */
  respondents: number
  tabIndex: number
  disabled?: boolean
  onKeyDown: (event: React.KeyboardEvent) => void
  onFocus: () => void
}) {
  const available = density?.yes ?? 0
  // Un fond qui monte jusqu'à ~35 % d'opacité : lisible sous l'aplat, et
  // jamais au point de faire passer le texte sous le seuil de contraste.
  const ratio = respondents > 0 ? Math.min(available / respondents, 1) : 0
  const style = brushStyles[status ?? 'yes']

  return (
    <button
      type="button"
      role="gridcell"
      data-day={day}
      disabled={disabled}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      aria-label={labels.availability.dayLabel(
        formatDay(day),
        status ? labels.availability.statuses[status] : labels.availability.statusUnset,
        respondents > 0 ? labels.availability.density(available, respondents) : null,
      )}
      className={cn(
        'relative flex h-11 w-full items-center justify-center overflow-hidden',
        'rounded-[var(--radius-control)] border text-sm font-medium',
        'transition-colors duration-150 select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:pointer-events-none disabled:opacity-50',
        status ? style.className : 'border-border-strong bg-transparent text-text',
      )}
    >
      {/*
        Le fond de densité est un calque à part, sous le contenu : il ne
        modifie ni la couleur du texte ni celle de la bordure, donc il ne peut
        pas faire chuter le contraste du chiffre.
      */}
      {status === undefined && ratio > 0 ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-yes"
          style={{ opacity: ratio * 0.35 }}
        />
      ) : null}

      <span className="relative flex items-center gap-1">
        {status ? (
          <span aria-hidden="true" className="text-xs">
            {style.glyph}
          </span>
        ) : null}
        {formatDayNumber(day)}
      </span>
    </button>
  )
}
