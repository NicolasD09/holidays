import { ApprovalButtons } from '@/features/voting/components/ApprovalButtons'
import { ResultBar } from '@/features/voting/components/ResultBar'
import { labels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { ApprovalValue, Option, OptionResult } from '@/types/domain'

/**
 * Une proposition et son vote (doc 05 §5.3).
 *
 * Une proposition qui ne convient pas à quelqu'un porte un liseré et le dit en
 * toutes lettres : c'est l'information la plus utile du groupe — un « non »
 * ferme pèse plus lourd qu'un « oui » de plus, et l'organisateur doit le voir
 * sans lire les chiffres.
 */
export function OptionCard({
  option,
  result,
  value,
  proposedBy,
  disabled,
  onVote,
}: {
  option: Option
  result: OptionResult | null
  value: ApprovalValue | null
  proposedBy: string | null
  disabled?: boolean
  onVote: (value: ApprovalValue | null) => void
}) {
  const blocking = result?.no_count ?? 0

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface-2 p-4',
        blocking > 0 ? 'border-no' : 'border-border',
      )}
    >
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-text">{option.title}</h3>
        {option.description ? (
          <p className="text-[0.9375rem] text-text-muted">{option.description}</p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          {option.url ? (
            <a
              href={option.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand underline-offset-4 hover:underline"
            >
              🔗 {hostOf(option.url)}
            </a>
          ) : null}
          {proposedBy ? <span>{labels.voting.proposedBy(proposedBy)}</span> : null}
        </p>
      </header>

      <ApprovalButtons
        optionTitle={option.title}
        value={value}
        disabled={disabled}
        onVote={onVote}
      />

      {result ? <ResultBar result={result} /> : null}

      {blocking > 0 ? (
        <p className="text-sm font-medium text-no">{labels.voting.blocking(blocking)}</p>
      ) : null}
    </article>
  )
}

/** Le domaine seul : une URL complète déborde sur mobile et n'apprend rien. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
