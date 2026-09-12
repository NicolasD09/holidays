import { useMemo } from 'react'
import { formatRange } from '@/lib/dates'
import { labels } from '@/lib/labels'
import { rankWindows, respondents } from '@/lib/scoring'
import type { AvailabilityEntry } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { Participant } from '@/types/domain'

/**
 * Le classement des créneaux, sous la grille (tâche 3.6, doc 05 §5.3 5.b).
 *
 * Ce composant ne calcule rien : `rankWindows` a été écrit et prouvé au
 * sprint 4, couverture 100 %. Tout ce qui est ici est de la mise en mots — et
 * c'est précisément le partage voulu, l'algorithme d'un côté, l'écran de
 * l'autre.
 *
 * **Nommer les absents est factuel, pas accusateur.** « Julien n'est pas
 * dispo » dit pourquoi un créneau descend dans le classement ; sans le nom,
 * l'information est inexploitable — on ne sait pas à qui parler. C'est la
 * contrepartie que l'ADR-009 prévoit explicitement, et elle s'arrête là : pas
 * de rouge sur le nom, pas de relance, pas de retard.
 */

/** Cinq créneaux. Une fenêtre de 90 jours en produit 83 : les montrer tous, c'est cacher la réponse. */
const TOP = 5

export function WindowRanking({
  windowStart,
  windowEnd,
  nights,
  entries,
  participants,
}: {
  windowStart: string
  windowEnd: string
  nights: number
  entries: AvailabilityEntry[]
  participants: Participant[]
}) {
  const slots = useMemo(
    () => rankWindows({ windowStart, windowEnd, nights, availabilities: entries }),
    [windowStart, windowEnd, nights, entries],
  )
  const answered = useMemo(() => respondents(entries).length, [entries])
  const nameOf = useMemo(
    () => new Map(participants.map((person) => [person.id, person.display_name])),
    [participants],
  )

  // Tant que personne n'a rien peint, un classement à zéro partout ne dit rien
  // et laisse croire qu'aucune date ne convient.
  if (answered === 0) {
    return <p className="text-sm text-text-muted">{labels.ranking.empty}</p>
  }

  // `rankWindows` renvoie un tableau vide si la fenêtre ne peut plus contenir un
  // séjour entier — l'organisateur a resserré la fenêtre après coup.
  if (slots.length === 0) {
    return <p className="text-sm text-text-muted">{labels.ranking.none}</p>
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{labels.ranking.title}</h2>

      <ol className="flex flex-col gap-2">
        {slots.slice(0, TOP).map((slot, index) => {
          const blocked = slot.blocked
            .map((id) => nameOf.get(id))
            .filter((name): name is string => name !== undefined)

          return (
            <li
              key={slot.start}
              className={cn(
                'flex flex-col gap-1 rounded-[var(--radius-card)] border p-3',
                index === 0 ? 'border-brand bg-surface-2' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{formatRange(slot.start, slot.end)}</span>
                {index === 0 ? (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-vote-fg">
                    {labels.ranking.top}
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-text-muted">
                {labels.ranking.counts(slot.fullyAvailable.length, slot.tentative.length)}
              </p>

              {blocked.length > 0 ? (
                <p className="text-sm text-no">{labels.ranking.blocked(blocked)}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
