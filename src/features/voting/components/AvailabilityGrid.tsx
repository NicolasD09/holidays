import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AvailabilityDraft } from '@/features/voting/api/availabilities'
import {
  applyStroke,
  brushes,
  brushStyles,
  densityByDay,
  paintedDaysOf,
  strokeToDrafts,
  type Brush,
} from '@/features/voting/components/availability-brush'
import { DayCell } from '@/features/voting/components/DayCell'
import { buildCalendar, daysInWindow, formatDay, toUtc, weekdayHeaders } from '@/lib/dates'
import { labels } from '@/lib/labels'
import { respondents } from '@/lib/scoring'
import type { AvailabilityEntry } from '@/lib/scoring'
import { cn } from '@/lib/utils'

/**
 * La grille de disponibilités (tâche 3.3, doc 05 §5.3 5.b).
 *
 * **Pourquoi la grille capture le pointeur.** Peindre par glissement veut dire
 * suivre le doigt d'une case à l'autre — or `pointerenter` ne se déclenche plus
 * sur les cases dès qu'un geste est en cours. On capture donc le pointeur sur
 * le conteneur et on relit, à chaque `pointermove`, la case qui se trouve sous
 * le curseur (`elementFromPoint` + `data-day`). C'est le seul code de ce
 * fichier qui ne soit pas évident, et c'est aussi ce qui rend le même geste
 * valable au doigt, à la souris et au stylet.
 *
 * **`touch-none` n'est pas décoratif.** Sans `touch-action: none`, Safari iOS
 * fait défiler la page pendant qu'on peint, et le geste devient inutilisable.
 * C'est le piège n° 1 du sprint (doc 14 §14.8).
 *
 * **L'envoi est groupé.** Le geste ne produit qu'un seul lot, à la levée du
 * doigt : douze jours peints font un appel, pas douze. En cas d'échec, les
 * douze reviennent ensemble (`useAvailability`).
 */

export function AvailabilityGrid({
  windowStart,
  windowEnd,
  entries,
  participantId,
  disabled,
  onPaint,
}: {
  windowStart: string
  windowEnd: string
  /** Toutes les disponibilités visibles — les miennes et celles des autres. */
  entries: AvailabilityEntry[]
  participantId: string
  disabled?: boolean
  onPaint: (drafts: AvailabilityDraft[]) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const [brush, setBrush] = useState<Brush>('yes')
  /** Les jours touchés par le geste en cours. `null` = aucun geste. */
  const [stroke, setStroke] = useState<string[] | null>(null)
  const [focusDay, setFocusDay] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const months = useMemo(() => buildCalendar(windowStart, windowEnd), [windowStart, windowEnd])
  const allDays = useMemo(() => daysInWindow(windowStart, windowEnd), [windowStart, windowEnd])
  const mine = useMemo(() => paintedDaysOf(entries, participantId), [entries, participantId])
  const density = useMemo(() => densityByDay(entries), [entries])
  const respondentCount = useMemo(() => respondents(entries).length, [entries])

  // Pendant le geste, l'écran montre déjà le résultat : la peinture ne doit
  // jamais attendre la levée du doigt pour se voir.
  const shown = stroke ? applyStroke(mine, stroke, brush) : mine
  const roving = focusDay ?? allDays[0] ?? null

  function dayUnder(event: React.PointerEvent): string | null {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    return element?.closest<HTMLElement>('[data-day]')?.dataset.day ?? null
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return
    const day = dayUnder(event)
    if (!day) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setStroke([day])
    setFocusDay(day)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (stroke === null) return
    const day = dayUnder(event)
    if (!day) return
    setStroke((current) =>
      current && !current.includes(day) ? [...current, day] : current,
    )
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (stroke === null) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    commit(stroke, brush)
    setStroke(null)
  }

  function commit(days: string[], used: Brush) {
    const drafts = strokeToDrafts(mine, days, used)
    // Repasser sur des jours déjà de la bonne couleur ne change rien : pas de
    // lot, pas d'appel, pas d'annonce.
    if (drafts.length === 0) return

    onPaint(drafts)

    const [only] = drafts
    setAnnouncement(
      drafts.length === 1 && only
        ? labels.availability.announceDay(
            formatDay(only.day),
            labels.availability.brushes[used],
          )
        : labels.availability.announceStroke(drafts.length, labels.availability.brushes[used]),
    )
  }

  function moveFocus(from: string, delta: number) {
    const index = allDays.indexOf(from)
    if (index === -1) return

    const next = allDays[Math.min(Math.max(index + delta, 0), allDays.length - 1)]
    if (!next) return

    setFocusDay(next)
    container.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus()
  }

  function onCellKeyDown(event: React.KeyboardEvent, day: string) {
    // Le lundi est la première colonne : `getUTCDay` compte à partir de dimanche.
    const column = (new Date(toUtc(day)).getUTCDay() + 6) % 7
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -column,
      End: 6 - column,
    }

    if (event.key in moves) {
      event.preventDefault()
      moveFocus(day, moves[event.key] ?? 0)
      return
    }

    // Espace peint avec le pinceau courant — l'équivalent clavier du tap.
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!disabled) commit([day], brush)
    }
  }

  function fill(used: Brush) {
    if (disabled) return
    commit(allDays, used)
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="radiogroup"
        aria-label={labels.availability.brushLabel}
        className="grid grid-cols-4 gap-2"
      >
        {brushes.map((choice) => {
          const selected = brush === choice
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => setBrush(choice)}
              className={cn(
                'flex h-11 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)]',
                'border text-xs font-medium transition-colors duration-150',
                'disabled:pointer-events-none disabled:opacity-50',
                selected
                  ? brushStyles[choice].className
                  : 'border-border-strong bg-transparent text-text hover:bg-surface-2',
              )}
            >
              <span aria-hidden="true">{brushStyles[choice].glyph}</span>
              {labels.availability.brushes[choice]}
            </button>
          )
        })}
      </div>

      <p className="text-sm text-text-muted">{labels.availability.hint}</p>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={disabled} onClick={() => fill('yes')}>
          {labels.availability.allAvailable}
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={() => fill('erase')}>
          {labels.availability.clearAll}
        </Button>
      </div>

      <div
        ref={container}
        role="grid"
        aria-label={labels.availability.gridLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="flex touch-none flex-col gap-6 select-none"
      >
        {months.map((month) => (
          <section key={month.key} className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold capitalize">{month.label}</h3>

            <div role="row" className="grid grid-cols-7 gap-1">
              {weekdayHeaders.map((header) => (
                <span
                  key={header.key}
                  role="columnheader"
                  aria-label={header.long}
                  className="text-center text-xs text-text-muted uppercase"
                >
                  {header.narrow}
                </span>
              ))}
            </div>

            {month.weeks.map((week, index) => (
              <div
                key={week.find((day) => day !== null) ?? `${month.key}-${index}`}
                role="row"
                className="grid grid-cols-7 gap-1"
              >
                {week.map((day, column) =>
                  day === null ? (
                    <span
                      key={`${month.key}-${index}-${column}`}
                      role="gridcell"
                      aria-hidden="true"
                    />
                  ) : (
                    <DayCell
                      key={day}
                      day={day}
                      status={shown[day]}
                      density={density.get(day)}
                      respondents={respondentCount}
                      disabled={disabled}
                      tabIndex={day === roving ? 0 : -1}
                      onKeyDown={(event) => onCellKeyDown(event, day)}
                      onFocus={() => setFocusDay(day)}
                    />
                  ),
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* Chaque coup de pinceau est annoncé aux lecteurs d'écran (doc 05 §5.5). */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
