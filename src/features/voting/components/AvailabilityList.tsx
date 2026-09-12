import { useMemo, useState } from 'react'
import type { AvailabilityDraft } from '@/features/voting/api/availabilities'
import {
  brushStyles,
  densityByDay,
  paintedDaysOf,
  strokeToDrafts,
} from '@/features/voting/components/availability-brush'
import { buildCalendar, formatDay } from '@/lib/dates'
import { labels } from '@/lib/labels'
import { respondents } from '@/lib/scoring'
import type { AvailabilityEntry } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { availabilityStatuses, type AvailabilityStatus } from '@/types/domain'

/**
 * L'équivalent en liste de la grille (tâche 3.4, doc 05 §5.5).
 *
 * **Pourquoi il existe.** Une grille qu'on peint au pointeur n'est pas
 * utilisable au lecteur d'écran, quel que soit le soin mis aux `aria-label` :
 * peindre suppose de viser, et viser suppose de voir. Ici chaque jour est une
 * ligne, et chaque ligne un groupe de trois boutons — la même idiomatique que
 * `ApprovalButtons`, retap compris : retaper le choix courant efface le jour.
 *
 * Ce n'est pas une vue dégradée. C'est la même donnée, le même `onPaint`, et
 * les deux vues se répondent : ce qu'on saisit ici se retrouve dans la grille.
 */
export function AvailabilityList({
  windowStart,
  windowEnd,
  entries,
  participantId,
  disabled,
  onPaint,
}: {
  windowStart: string
  windowEnd: string
  entries: AvailabilityEntry[]
  participantId: string
  disabled?: boolean
  onPaint: (drafts: AvailabilityDraft[]) => void
}) {
  const [announcement, setAnnouncement] = useState('')

  // On réutilise le découpage de la grille plutôt que d'en écrire un second :
  // les mois sont les mêmes, seules les cases à vide disparaissent.
  const months = useMemo(
    () =>
      buildCalendar(windowStart, windowEnd).map((month) => ({
        key: month.key,
        label: month.label,
        days: month.weeks.flat().filter((day): day is string => day !== null),
      })),
    [windowStart, windowEnd],
  )

  const mine = useMemo(() => paintedDaysOf(entries, participantId), [entries, participantId])
  const density = useMemo(() => densityByDay(entries), [entries])
  const respondentCount = useMemo(() => respondents(entries).length, [entries])

  function choose(day: string, status: AvailabilityStatus | null) {
    const drafts = strokeToDrafts(mine, [day], status ?? 'erase')
    if (drafts.length === 0) return

    onPaint(drafts)
    setAnnouncement(
      labels.availability.announceDay(
        formatDay(day),
        labels.availability.brushes[status ?? 'erase'],
      ),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">{labels.availability.listHint}</p>

      {months.map((month) => (
        <section key={month.key} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold capitalize">{month.label}</h3>

          <ul className="flex flex-col">
            {month.days.map((day) => {
              const label = formatDay(day)
              const available = density.get(day)?.yes ?? 0

              return (
                <li
                  key={day}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium capitalize">{label}</span>
                    {respondentCount > 0 ? (
                      <span className="text-xs text-text-muted">
                        {labels.availability.density(available, respondentCount)}
                      </span>
                    ) : null}
                  </div>

                  <div
                    role="radiogroup"
                    aria-label={labels.availability.dayGroupLabel(label)}
                    className="flex gap-1"
                  >
                    {availabilityStatuses.map((status) => {
                      const selected = mine[day] === status
                      return (
                        <button
                          key={status}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={disabled}
                          onClick={() => choose(day, selected ? null : status)}
                          className={cn(
                            'flex h-11 items-center justify-center gap-1 px-3',
                            'rounded-[var(--radius-control)] border text-sm font-medium',
                            'transition-colors duration-150',
                            'disabled:pointer-events-none disabled:opacity-50',
                            selected
                              ? brushStyles[status].className
                              : 'border-border-strong bg-transparent text-text hover:bg-surface-2',
                          )}
                        >
                          <span aria-hidden="true">{brushStyles[status].glyph}</span>
                          {labels.availability.brushes[status]}
                        </button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
