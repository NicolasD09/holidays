import { formatRange } from '@/lib/dates'
import { labels } from '@/lib/labels'
import type { WindowScore } from '@/lib/scoring'
import type { CloseChoice, Option, OptionResult, VoteMode } from '@/types/domain'

/**
 * Ce que la modale de clôture propose de retenir. Pur : la règle « qui est
 * pré-sélectionné » se teste sans rendre la modale.
 */

export type ClosePick = {
  id: string
  label: string
  detail: string | null
  /** `null` quand le score n'est pas visible (mode aveugle, organisateur qui n'a pas voté). */
  score: number | null
  choice: CloseChoice
}

/** Combien de créneaux on propose — les mêmes que le classement de l'écran. */
export const WINDOW_PICKS = 5

/**
 * Les propositions, de la mieux classée à la moins bien classée quand les
 * scores sont visibles ; dans l'ordre d'ajout sinon — un ordre qui ne révèle
 * rien.
 */
export function optionPicks(
  options: Option[],
  results: OptionResult[] | null,
  mode: VoteMode,
): ClosePick[] {
  const byOption = new Map((results ?? []).map((row) => [row.option_id, row]))

  const ordered = results
    ? [...options].sort(
        (a, b) => (byOption.get(b.id)?.score ?? 0) - (byOption.get(a.id)?.score ?? 0),
      )
    : options

  return ordered.map((option) => {
    const row = byOption.get(option.id)
    return {
      id: option.id,
      label: option.title,
      detail: row ? tallyFor(mode, row) : null,
      score: results ? (row?.score ?? 0) : null,
      choice: { kind: 'option', optionId: option.id },
    }
  })
}

/** Les meilleurs créneaux, tels que `rankWindows` les classe. */
export function windowPicks(windows: WindowScore[]): ClosePick[] {
  return windows.slice(0, WINDOW_PICKS).map((slot) => ({
    id: `${slot.start}/${slot.end}`,
    label: formatRange(slot.start, slot.end),
    detail: labels.ranking.counts(slot.fullyAvailable.length, slot.tentative.length),
    score: slot.score,
    choice: { kind: 'range', start: slot.start, end: slot.end },
  }))
}

/**
 * La tête de liste, pré-sélectionnée (tâche 5.2). Seulement si elle mène
 * vraiment : un score nul ne désigne rien, et sans scores visibles on ne
 * suggère pas — ce serait suggérer au hasard.
 */
export function suggestedPick(picks: ClosePick[]): ClosePick | null {
  const [first] = picks
  if (!first || first.score === null || first.score <= 0) return null
  return first
}

/**
 * Le décompte d'une proposition, dans les mots de son mode : « 3 oui · 1 ~ ·
 * 0 non » en approbation, « 3 voix » en choix unique ou multiple — où chaque
 * vote vaut 1 et « oui » ne voudrait rien dire.
 */
export function tallyFor(mode: VoteMode, row: OptionResult): string {
  return mode === 'approval'
    ? labels.voting.tally(row.yes_count, row.maybe_count, row.no_count)
    : labels.voting.votes(row.yes_count)
}
