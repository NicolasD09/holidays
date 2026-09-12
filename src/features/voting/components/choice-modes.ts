import { labels } from '@/lib/labels'
import type { VoteMode } from '@/types/domain'

/**
 * Ce qui distingue les trois modes de vote à l'écran.
 *
 * En `single` et `multiple`, la valeur envoyée est toujours **1** :
 * `app_cast_vote` refuse toute autre valeur dans ces modes, et ce sont les
 * déclencheurs `votes_single_choice` et `votes_max_choices` qui tiennent les
 * règles en base (doc 03 §3.9). L'écran ne fait que les dire avant.
 *
 * Hors composant pour la règle `react/only-export-components`.
 */

export type ChoiceMode = 'single' | 'multiple'

export function isChoiceMode(mode: VoteMode): mode is ChoiceMode {
  return mode === 'single' || mode === 'multiple'
}

export const choiceModeCopy: Record<
  ChoiceMode,
  { idle: string; active: string; accessibleLabel: (option: string) => string }
> = {
  single: {
    idle: labels.voting.choose,
    active: labels.voting.chosen,
    accessibleLabel: labels.voting.chooseLabel,
  },
  multiple: {
    idle: labels.voting.keep,
    active: labels.voting.kept,
    accessibleLabel: labels.voting.keepLabel,
  },
}

/**
 * Combien de choix reste-t-il ? `null` quand le mode n'est pas plafonné —
 * distinct de `0`, qui veut dire « plus aucun ».
 */
export function remainingChoices(
  mode: VoteMode,
  maxChoices: number | null,
  selectedCount: number,
): number | null {
  if (mode !== 'multiple' || maxChoices === null) return null
  return Math.max(0, maxChoices - selectedCount)
}
