import { isChoiceMode } from '@/features/voting/components/choice-modes'
import { labels } from '@/lib/labels'
import type { OptionResult, VoteMode } from '@/types/domain'

/**
 * Barre de résultats d'une proposition — du CSS, pas de librairie de
 * graphiques (doc 04 §4.2).
 *
 * Deux lectures selon le mode :
 *
 * - **approbation** : trois segments proportionnels, et le compte en toutes
 *   lettres juste à côté. La barre est un raccourci visuel, jamais la seule
 *   façon de lire le score.
 * - **choix unique / multiple** : il n'y a que des « pour ». Trois segments
 *   dont deux vides n'apprendraient rien, et la part interne vaudrait
 *   toujours 100 %. On montre donc une barre unique, relative à la
 *   proposition en tête — c'est la comparaison qui a du sens ici.
 */
export function ResultBar({
  result,
  mode,
  topCount,
}: {
  result: OptionResult
  mode: VoteMode
  /** Nombre de voix de la proposition en tête, pour l'échelle des modes de choix. */
  topCount?: number
}) {
  if (isChoiceMode(mode)) {
    const scale = Math.max(1, topCount ?? result.yes_count)
    const text = labels.voting.votes(result.yes_count)

    return (
      <div className="flex flex-col gap-1">
        <div
          className="h-2 overflow-hidden rounded-full bg-surface"
          role="img"
          aria-label={text}
        >
          <div
            className="h-full bg-brand transition-[width] duration-150"
            style={{ width: `${Math.min(100, (result.yes_count / scale) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-text-muted">{text}</p>
      </div>
    )
  }

  const total = result.yes_count + result.maybe_count + result.no_count
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100)
  const tally = labels.voting.tally(
    result.yes_count,
    result.maybe_count,
    result.no_count,
  )

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-surface"
        role="img"
        aria-label={tally}
      >
        <div className="bg-yes" style={{ width: `${share(result.yes_count)}%` }} />
        <div className="bg-maybe" style={{ width: `${share(result.maybe_count)}%` }} />
        <div className="bg-no" style={{ width: `${share(result.no_count)}%` }} />
      </div>
      <p className="text-sm text-text-muted">{tally}</p>
    </div>
  )
}
