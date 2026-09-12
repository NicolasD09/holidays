import type { AvailabilityDraft } from '@/features/voting/api/availabilities'
import type { AvailabilityEntry } from '@/lib/scoring'
import { availabilityStatuses, type AvailabilityStatus } from '@/types/domain'

/**
 * Toute la logique de la peinture, **hors React** (tâche 3.3).
 *
 * C'est la pièce du sprint 5 qui peut se tromper en silence : un coup de
 * pinceau mal appliqué ne lève aucune erreur, il enregistre simplement autre
 * chose que ce que le doigt a dessiné. Elle est donc pure et testée à part,
 * comme `patchVote` l'est pour le vote (doc 11 §11.8).
 *
 * Séparé du composant aussi pour `react/only-export-components`, qui interdit
 * d'exporter autre chose qu'un composant depuis un `.tsx`.
 */

/** Le pinceau courant. `erase` est la gomme : elle efface le jour. */
export type Brush = AvailabilityStatus | 'erase'

export const brushes = [...availabilityStatuses, 'erase'] as const satisfies readonly Brush[]

/**
 * L'habillage des quatre pinceaux, partagé par la grille, la case et la liste.
 *
 * Une seule source : trois copies divergeraient au premier changement de
 * palette, et c'est exactement le genre d'écart qu'aucun test n'attrape. Chaque
 * état porte un glyphe **et** une couleur — le sens n'est jamais porté par la
 * seule couleur (doc 05 §5.2).
 */
export const brushStyles: Record<Brush, { className: string; glyph: string }> = {
  yes: { className: 'bg-yes text-vote-fg border-yes', glyph: '✓' },
  maybe: { className: 'bg-maybe text-vote-fg border-maybe', glyph: '~' },
  no: { className: 'bg-no text-vote-fg border-no', glyph: '✕' },
  erase: { className: 'bg-surface-2 text-text border-border-strong', glyph: '⌫' },
}

/**
 * L'état peint d'un participant : `jour → statut`.
 * Un jour **absent** n'est pas un refus, c'est un jour non renseigné — et
 * `lib/scoring.ts` le compte comme « peut-être » (doc 13).
 */
export type PaintedDays = Record<string, AvailabilityStatus>

/** Ce que le fond de la grille montre : combien de monde est libre ce jour-là. */
export type DayDensity = { yes: number; maybe: number; no: number }

/** Ce qu'un participant a peint, extrait de toutes les disponibilités visibles. */
export function paintedDaysOf(
  entries: AvailabilityEntry[],
  participantId: string,
): PaintedDays {
  const days: PaintedDays = {}
  for (const entry of entries) {
    if (entry.participantId === participantId) days[entry.day] = entry.status
  }
  return days
}

/**
 * La densité du groupe, jour par jour.
 *
 * En mode aveugle, `entries` ne contient que mes propres jours : la densité
 * tombe d'elle-même à « moi seul ». Aucun `if` d'interface — la policy
 * `availabilities_select` a déjà filtré (ADR-007).
 */
export function densityByDay(entries: AvailabilityEntry[]): Map<string, DayDensity> {
  const density = new Map<string, DayDensity>()
  for (const entry of entries) {
    const day = density.get(entry.day) ?? { yes: 0, maybe: 0, no: 0 }
    day[entry.status] += 1
    density.set(entry.day, day)
  }
  return density
}

/**
 * Applique un coup de pinceau à l'état local — l'aperçu pendant le geste.
 *
 * Le pinceau **remplace**, il ne cumule pas : repeindre « pas dispo » sur un
 * jour déjà « dispo » le passe en « pas dispo ». C'est ce qu'un pinceau fait,
 * et c'est l'étape 3 de la recette.
 */
export function applyStroke(
  days: PaintedDays,
  stroke: Iterable<string>,
  brush: Brush,
): PaintedDays {
  const next = { ...days }
  for (const day of stroke) {
    if (brush === 'erase') delete next[day]
    else next[day] = brush
  }
  return next
}

/**
 * Le lot à envoyer au serveur pour un coup de pinceau — **seulement ce qui
 * change vraiment**.
 *
 * Repasser le doigt sur un jour déjà de la bonne couleur ne produit donc aucune
 * écriture, et effacer un jour vide non plus. Sur un glissement qui revient sur
 * ses pas, ça divise le lot par deux ou trois.
 */
export function strokeToDrafts(
  days: PaintedDays,
  stroke: Iterable<string>,
  brush: Brush,
): AvailabilityDraft[] {
  const drafts: AvailabilityDraft[] = []
  const seen = new Set<string>()

  for (const day of stroke) {
    if (seen.has(day)) continue
    seen.add(day)

    const current = days[day]
    if (brush === 'erase') {
      if (current !== undefined) drafts.push({ day, status: null })
    } else if (current !== brush) {
      drafts.push({ day, status: brush })
    }
  }

  return drafts
}

/**
 * Rejoue un lot sur les disponibilités en cache — le patch optimiste.
 *
 * N'affecte **que** les lignes du participant concerné : les jours peints par
 * les autres sont recopiés tels quels, y compris sur les mêmes dates.
 */
export function applyDrafts(
  entries: AvailabilityEntry[],
  drafts: AvailabilityDraft[],
  participantId: string,
): AvailabilityEntry[] {
  const byDay = new Map(drafts.map((draft) => [draft.day, draft.status]))

  const next = entries.filter(
    (entry) => entry.participantId !== participantId || !byDay.has(entry.day),
  )

  for (const [day, status] of byDay) {
    if (status !== null) next.push({ participantId, day, status })
  }

  return next
}
