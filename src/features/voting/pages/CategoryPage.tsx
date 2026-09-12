import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTripContext } from '@/app/layouts/tripContext'
import { NotFoundPage } from '@/app/pages/NotFoundPage'
import { PageShell } from '@/components/common/PageShell'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StateBlock,
} from '@/components/common/StateBlock'
import { Button } from '@/components/ui/button'
import { listParticipants } from '@/features/participant/api/listParticipants'
import { listAvailabilities } from '@/features/voting/api/availabilities'
import { fetchCategoryResults } from '@/features/voting/api/categoryResults'
import { addOption, listOptions } from '@/features/voting/api/options'
import { fetchMyVotes } from '@/features/voting/api/votes'
import { AddOptionInline } from '@/features/voting/components/AddOptionInline'
import { approvalLabel } from '@/features/voting/components/approval-choices'
import { AvailabilityGrid } from '@/features/voting/components/AvailabilityGrid'
import { AvailabilityList } from '@/features/voting/components/AvailabilityList'
import { CategoryNav } from '@/features/voting/components/CategoryNav'
import { isChoiceMode, remainingChoices } from '@/features/voting/components/choice-modes'
import { OptionCard } from '@/features/voting/components/OptionCard'
import { WindowRanking } from '@/features/voting/components/WindowRanking'
import { useAvailability } from '@/features/voting/hooks/useAvailability'
import { useVote } from '@/features/voting/hooks/useVote'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import { routes } from '@/lib/routes'
import { respondents } from '@/lib/scoring'
import type { ApprovalValue, Option, OptionResult, Participant } from '@/types/domain'

/**
 * É5a — vote d'une catégorie en mode approbation (doc 05 §5.3).
 *
 * Trois règles tiennent cet écran :
 * 1. un tap enregistre, sans bouton Valider ;
 * 2. l'ordre des cartes est figé pendant qu'on vote — rien ne bouge sous le
 *    doigt, un bouton « Reclasser » rend la main ;
 * 3. les résultats viennent du serveur, ou pas du tout (mode aveugle).
 */
export function CategoryPage() {
  const { categoryId = '' } = useParams<{ categoryId: string }>()
  const { slug, preview, participant, categories } = useTripContext()
  const queryClient = useQueryClient()

  const category = categories.find((item) => item.id === categoryId)

  /*
    Une catégorie dates ne manipule ni proposition ni vote : elle lit et écrit
    `availabilities`. Les trois requêtes du vote sont donc éteintes ici, et
    l'écran des dates sort avant leur garde de chargement — une requête
    désactivée reste `pending` pour toujours.
  */
  const isDates = category?.vote_mode === 'availability'

  const options = useQuery({
    queryKey: qk.options(categoryId),
    queryFn: () => listOptions(categoryId),
    enabled: Boolean(category) && !isDates,
  })

  const myVotes = useQuery({
    queryKey: qk.myVotes(categoryId),
    queryFn: () => fetchMyVotes(categoryId, participant.id),
    enabled: Boolean(category) && !isDates,
  })

  const results = useQuery({
    queryKey: qk.results(categoryId),
    queryFn: () => fetchCategoryResults(categoryId),
    enabled: Boolean(category) && !isDates,
  })

  const availabilities = useQuery({
    queryKey: qk.availabilities(categoryId),
    queryFn: () => listAvailabilities(categoryId),
    enabled: Boolean(category) && isDates,
  })

  const participants = useQuery({
    queryKey: qk.participants(preview.trip_id),
    queryFn: () => listParticipants(preview.trip_id),
  })

  const vote = useVote(categoryId, preview.trip_id, category?.vote_mode ?? 'approval')
  const paint = useAvailability(categoryId, preview.trip_id, participant.id)
  const [announcement, setAnnouncement] = useState('')
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null)
  /*
    Grille ou liste. Le choix reste local à la visite : c'est une préférence
    de saisie du moment, pas un réglage du sondage, et surtout pas quelque
    chose à retenir pour les autres.
  */
  const [listView, setListView] = useState(false)

  const create = useMutation({
    mutationFn: (values: { title: string; url: string | null }) =>
      addOption({
        tripId: preview.trip_id,
        categoryId,
        participantId: participant.id,
        title: values.title,
        url: values.url,
        position: options.data?.length ?? 0,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.options(categoryId) })
      await queryClient.invalidateQueries({ queryKey: qk.results(categoryId) })
      // Le hub compte les propositions par catégorie : une de plus le change.
      await queryClient.invalidateQueries({ queryKey: qk.progress(preview.trip_id) })
      setFrozenOrder(null)
    },
  })

  const resultsByOption = useMemo(() => {
    const map = new Map<string, OptionResult>()
    for (const row of results.data ?? []) map.set(row.option_id, row)
    return map
  }, [results.data])

  const ordered = useMemo(() => {
    const list = options.data ?? []
    if (frozenOrder) return sortByIds(list, frozenOrder)

    // Hors mode aveugle, on classe par score décroissant ; sinon on garde
    // l'ordre d'ajout, qui ne révèle rien (doc 05 §5.3).
    if (!results.data) return list
    return [...list].sort(
      (a, b) =>
        (resultsByOption.get(b.id)?.score ?? 0) - (resultsByOption.get(a.id)?.score ?? 0),
    )
  }, [options.data, frozenOrder, results.data, resultsByOption])

  if (!category) return <NotFoundPage />

  const closedCategory = category.status === 'closed'

  /*
    É5b — la grille de disponibilités (doc 05 §5.3 5.b).

    Elle sort avant la garde de chargement du vote, qui ne la concerne pas :
    ici, ce qu'on attend, ce sont les disponibilités, pas les propositions.
  */
  if (isDates) {
    const { window_start: from, window_end: to, nights } = category

    return (
      <PageShell className="flex flex-col gap-6 pb-28">
        <header className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-text-muted">
              {preview.cover_emoji} {preview.title}
            </p>
            {participant.is_organizer ? (
              <Button asChild variant="link" className="shrink-0">
                <Link to={routes.settings(slug)}>{labels.hub.settings}</Link>
              </Button>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold">{category.label}</h1>
          {from !== null && to !== null && nights !== null ? (
            <p className="text-sm text-text-muted">
              {labels.availability.window(from, to, nights)}
            </p>
          ) : null}
        </header>

        {closedCategory ? (
          <p className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
            {labels.voting.closed}
          </p>
        ) : null}

        {from === null || to === null || nights === null ? (
          /*
            Impossible en pratique : la contrainte `dates_window_required`
            l'interdit en base depuis la migration 7. On le traite quand même
            plutôt que de planter — une catégorie créée avant cette migration
            passerait ici.
          */
          <StateBlock icon="📅" title={labels.empty.noDateWindow} />
        ) : availabilities.isPending ? (
          <LoadingState />
        ) : availabilities.isError ? (
          <ErrorState
            body={toUserMessage(availabilities.error)}
            action={
              <Button onClick={() => void availabilities.refetch()}>
                {labels.error.tryAgain}
              </Button>
            }
          />
        ) : (
          <>
            {listView ? (
              <AvailabilityList
                windowStart={from}
                windowEnd={to}
                entries={availabilities.data}
                participantId={participant.id}
                disabled={closedCategory}
                onPaint={(drafts) => paint.mutate(drafts)}
              />
            ) : (
              <AvailabilityGrid
                windowStart={from}
                windowEnd={to}
                entries={availabilities.data}
                participantId={participant.id}
                disabled={closedCategory}
                onPaint={(drafts) => paint.mutate(drafts)}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                {labels.availability.respondents(respondents(availabilities.data).length)}
              </p>
              <Button variant="ghost" onClick={() => setListView((current) => !current)}>
                {listView ? labels.availability.gridView : labels.availability.listView}
              </Button>
            </div>

            {/*
              Le classement vit sous la grille, jamais au-dessus : il se
              réordonne à chaque coup de pinceau, et rien qui bouge ne doit se
              trouver là où on pose le doigt.
            */}
            <WindowRanking
              windowStart={from}
              windowEnd={to}
              nights={nights}
              entries={availabilities.data}
              participants={participants.data ?? []}
            />
          </>
        )}

        <CategoryNav slug={slug} categories={categories} currentId={categoryId} />
      </PageShell>
    )
  }

  if (options.isPending || myVotes.isPending) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (options.isError || myVotes.isError) {
    return (
      <PageShell>
        <ErrorState
          body={toUserMessage(options.error ?? myVotes.error)}
          action={
            <Button onClick={() => void options.refetch()}>{labels.error.tryAgain}</Button>
          }
        />
      </PageShell>
    )
  }

  const votes = myVotes.data ?? {}
  const closed = closedCategory

  const canPropose = !closed && (category.allow_participant_options || participant.is_organizer)
  const votedCount = ordered.filter((option) => votes[option.id] !== undefined).length

  const mode = category.vote_mode
  const choiceMode = isChoiceMode(mode)
  const selectedCount = Object.values(votes).filter((value) => value === 1).length
  const remaining = remainingChoices(mode, category.max_choices, selectedCount)
  // Le plafond est annoncé **avant** d'être atteint, et les propositions non
  // retenues deviennent inertes : un refus qu'on pouvait éviter est un bug
  // d'interface, pas un message d'erreur à afficher.
  const capReached = remaining === 0
  const topCount = Math.max(
    0,
    ...ordered.map((option) => resultsByOption.get(option.id)?.yes_count ?? 0),
  )

  function onVote(option: Option, value: ApprovalValue | null) {
    // L'ordre se fige au premier vote : une carte ne doit jamais glisser sous
    // le doigt parce que son score vient de changer.
    if (!frozenOrder) setFrozenOrder(ordered.map((item) => item.id))

    vote.mutate({ optionId: option.id, value })
    setAnnouncement(
      value === null
        ? labels.voting.retracted(option.title)
        : labels.voting.recorded(
            option.title,
            // En mode de choix, la valeur est toujours 1 : « Oui » ne veut
            // rien dire de plus que « retenu ».
            choiceMode ? labels.voting.kept : approvalLabel(value),
          ),
    )

    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      navigator.vibrate?.(10)
    }
  }

  return (
    <PageShell className="flex flex-col gap-6 pb-28">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-text-muted">
            {preview.cover_emoji} {preview.title}
          </p>
          {/*
            Seule entrée vers les réglages quand le sondage n'a qu'une
            catégorie : le hub redirige alors, et sans ce lien l'organisateur
            n'aurait aucun chemin vers la zone sensible.
          */}
          {participant.is_organizer ? (
            <Button asChild variant="link" className="shrink-0">
              <Link to={routes.settings(slug)}>{labels.hub.settings}</Link>
            </Button>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold">{category.label}</h1>
        {category.description ? <p className="text-text-muted">{category.description}</p> : null}
      </header>

      {closed ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          {labels.voting.closed}
        </p>
      ) : null}

      {choiceMode && !closed ? (
        <p className="text-sm text-text-muted">
          {mode === 'single'
            ? labels.voting.singleHint
            : `${labels.voting.multipleHint(category.max_choices)} ${
                category.max_choices === null
                  ? ''
                  : labels.voting.multipleRemaining(remaining ?? 0)
              }`.trim()}
        </p>
      ) : null}

      {results.data === null ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          {labels.voting.blindNotice}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <EmptyState title={labels.empty.noOptions} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {votedCount === ordered.length && votedCount > 0
                ? labels.voting.allVoted
                : labels.voting.progress(votedCount, ordered.length)}
            </p>
            {frozenOrder && results.data ? (
              <Button variant="ghost" onClick={() => setFrozenOrder(null)}>
                {labels.voting.resort}
              </Button>
            ) : null}
          </div>

          {/*
            En choix unique, c'est la liste entière qui forme le groupe de
            radios : cocher ici décoche ailleurs, et un lecteur d'écran doit
            l'apprendre du conteneur, pas du bouton.
          */}
          <ul
            className="flex flex-col gap-4"
            role={mode === 'single' ? 'radiogroup' : undefined}
            aria-label={mode === 'single' ? category.label : undefined}
          >
            {ordered.map((option) => {
              const selected = votes[option.id] === 1
              return (
                <li key={option.id} role={mode === 'single' ? 'presentation' : undefined}>
                  <OptionCard
                    option={option}
                    result={resultsByOption.get(option.id) ?? null}
                    value={votes[option.id] ?? null}
                    mode={mode}
                    topCount={topCount}
                    proposedBy={nameOf(option.created_by, participants.data ?? [])}
                    disabled={closed || (capReached && !selected)}
                    onVote={(value) => onVote(option, value)}
                  />
                </li>
              )
            })}
          </ul>
        </>
      )}

      {canPropose ? (
        <AddOptionInline
          pending={create.isPending}
          onAdd={async (values) => {
            await create.mutateAsync(values)
          }}
        />
      ) : null}

      {create.isError ? (
        <p role="alert" className="text-sm text-no">
          {toUserMessage(create.error)}
        </p>
      ) : null}

      {/* Le vote enregistré est annoncé aux lecteurs d'écran (doc 05 §5.5). */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <CategoryNav slug={slug} categories={categories} currentId={categoryId} />
    </PageShell>
  )
}

/**
 * Une proposition ajoutée après le gel passe en fin de liste plutôt que de
 * disparaître.
 */
function sortByIds(options: Option[], ids: string[]): Option[] {
  const rank = new Map(ids.map((id, index) => [id, index]))
  const last = Number.MAX_SAFE_INTEGER
  return [...options].sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last))
}

function nameOf(participantId: string | null, participants: Participant[]): string | null {
  if (!participantId) return null
  return participants.find((item) => item.id === participantId)?.display_name ?? null
}
