import { Card, CardTitle } from '@/components/ui/card'
import { PageShell } from '@/components/common/PageShell'
import { labels } from '@/lib/labels'
import type { TripPreview } from '@/types/domain'

/**
 * Le sondage vu de l'extérieur, derrière le `JoinGate`.
 *
 * Construit uniquement à partir de `app_trip_preview` : ni propositions, ni
 * votes, ni prénoms. C'est volontaire — on montre assez pour donner envie
 * d'entrer, jamais assez pour se passer d'entrer.
 */
export function TripPreviewBackdrop({ preview }: { preview: TripPreview }) {
  return (
    <PageShell className="pb-64 opacity-60">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-5xl" role="img" aria-hidden="true">
          {preview.cover_emoji ?? '🏖️'}
        </span>
        <h1 className="text-2xl font-semibold sm:text-3xl">{preview.title}</h1>
        {preview.description ? (
          <p className="max-w-prose text-text-muted">{preview.description}</p>
        ) : null}
      </header>

      {preview.categories.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
            {labels.join.categories}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {preview.categories.map((category) => (
              <li key={category.id}>
                <Card>
                  <CardTitle className="text-base">{category.label}</CardTitle>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  )
}
