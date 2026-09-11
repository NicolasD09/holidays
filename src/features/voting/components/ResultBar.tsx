import { labels } from '@/lib/labels'
import type { OptionResult } from '@/types/domain'

/**
 * Barre de résultats d'une proposition — du CSS, pas de librairie de
 * graphiques (doc 04 §4.2).
 *
 * Trois segments proportionnels, et le compte en toutes lettres juste à côté :
 * la barre est un raccourci visuel, jamais la seule façon de lire le score.
 */
export function ResultBar({ result }: { result: OptionResult }) {
  const total = result.yes_count + result.maybe_count + result.no_count
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100)

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-surface"
        role="img"
        aria-label={labels.voting.tally(
          result.yes_count,
          result.maybe_count,
          result.no_count,
        )}
      >
        <div className="bg-yes" style={{ width: `${share(result.yes_count)}%` }} />
        <div className="bg-maybe" style={{ width: `${share(result.maybe_count)}%` }} />
        <div className="bg-no" style={{ width: `${share(result.no_count)}%` }} />
      </div>
      <p className="text-sm text-text-muted">
        {labels.voting.tally(result.yes_count, result.maybe_count, result.no_count)}
      </p>
    </div>
  )
}
