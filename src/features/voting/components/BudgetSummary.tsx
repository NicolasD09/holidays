import { AffordabilitySlider } from '@/features/voting/components/AffordabilitySlider'
import { formatEuros } from '@/lib/budget'
import { labels } from '@/lib/labels'
import type { BudgetSummary as Summary } from '@/types/domain'

/**
 * Le résumé du groupe (doc 05 §5.3 5.c).
 *
 * Trois états, tous normaux — aucun n'est une erreur :
 * - je n'ai pas répondu : on m'invite à le faire, sans rien montrer ;
 * - moins de 3 réponses : RM-10, on dit quand ça s'ouvrira ;
 * - prêt : le budget confortable pour tous, la médiane, le maximum, le curseur.
 *
 * Le chiffre mis en avant est le **minimum**, présenté comme « confortable
 * pour tout le monde » (doc 02 §2.5) : c'est le seul qui n'exclut personne.
 */
export function BudgetSummary({ summary }: { summary: Summary }) {
  return (
    <section
      aria-labelledby="budget-summary-title"
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4"
    >
      <h2 id="budget-summary-title" className="text-lg font-semibold">
        {labels.budget.summaryTitle}
      </h2>

      {summary.status === 'ready' ? (
        <>
          <p>{labels.budget.comfortable(formatEuros(summary.min))}</p>

          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                [labels.budget.min, summary.min],
                [labels.budget.median, summary.median],
                [labels.budget.max, summary.max],
              ] as const
            ).map(([term, value]) => (
              <div key={term} className="rounded-[var(--radius-control)] bg-surface p-2">
                <dt className="text-sm text-text-muted">{term}</dt>
                <dd className="font-semibold">{formatEuros(value)}</dd>
              </div>
            ))}
          </dl>

          <AffordabilitySlider
            // La courbe change quand quelqu'un répond : on repart alors du
            // palier confortable plutôt que de garder un montant hors course.
            key={`${summary.curve[0]?.amount}-${summary.curve.length}-${summary.step}`}
            curve={summary.curve}
            step={summary.step}
            respondents={summary.respondents}
          />
        </>
      ) : (
        <p className="text-text-muted">
          {summary.status === 'answer_first'
            ? labels.budget.answerFirst
            : labels.budget.insufficient}
        </p>
      )}

      <p className="text-sm text-text-muted">{labels.budget.respondents(summary.respondents)}</p>
    </section>
  )
}
