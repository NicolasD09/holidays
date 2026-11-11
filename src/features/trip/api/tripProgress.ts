import { fetchParticipation } from '@/features/trip/api/participation'
import { fetchBudgetSummary } from '@/features/voting/api/budget'
import { formatEuros } from '@/lib/budget'
import { formatRange } from '@/lib/dates'
import { rankWindows } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import type {
  AvailabilityStatus,
  BudgetSummary,
  Category,
  TripParticipation,
} from '@/types/domain'

/**
 * De quoi remplir le hub : par catégorie, combien de propositions, qui s'est
 * prononcé, et qui mène.
 *
 * **Deux sources, deux droits.** Le *meneur* se calcule à partir des votes
 * que cet appareil peut lire — en mode aveugle, il n'apparaît donc qu'après
 * avoir voté, exactement comme les scores de l'écran de vote. La
 * *participation*, elle, vient de `app_trip_participation` (migration 9) :
 * comptée en base, elle reste juste même quand les votes d'autrui sont
 * masqués. Jusqu'au sprint 7 elle se déduisait des votes visibles, et aurait
 * affiché « 1/8 » chez tout le monde dès la première bascule en aveugle
 * (dette n° 6 du doc 15).
 *
 * Quatre lectures au plus pour tout le hub, quel que soit le nombre de
 * catégories — pas de N+1.
 */

export type CategoryProgress = {
  optionCount: number
  /** Cet appareil s'est-il prononcé au moins une fois dans la catégorie ? */
  votedByMe: boolean
  /**
   * Participants distincts ayant voté au moins une fois. On garde les
   * identifiants et pas seulement leur nombre : le bandeau du hub nomme ceux
   * qui manquent encore (doc 05 §5.3 É4).
   */
  voterIds: string[]
  /**
   * Nombre de répondants quand on ne peut pas — et ne doit pas — les nommer.
   * Renseigné pour le budget seulement : `voterIds` y reste vide, parce que
   * savoir **qui** a donné un montant est déjà trop (ADR-006). Quand il est
   * là, c'est lui qui fait foi pour le décompte affiché.
   */
  respondentCount?: number
  /** Proposition en tête, si des votes sont visibles. */
  leader: { title: string; score: number } | null
}

export type TripProgress = Record<string, CategoryProgress>

type OptionRow = { id: string; category_id: string; title: string }
type VoteRow = { category_id: string; participant_id: string; option_id: string; value: number }
type AvailabilityRow = {
  category_id: string
  participant_id: string
  day: string
  status: AvailabilityStatus
}

/**
 * Pure, donc testable sans réseau : c'est elle qui porte toute la logique du
 * hub, et la seule qui puisse se tromper en silence.
 */
export function computeProgress(
  options: OptionRow[],
  votes: VoteRow[],
  participantId: string,
): TripProgress {
  const progress: TripProgress = {}

  const ensure = (categoryId: string): CategoryProgress =>
    (progress[categoryId] ??= {
      optionCount: 0,
      votedByMe: false,
      voterIds: [],
      leader: null,
    })

  const titleOf = new Map(options.map((option) => [option.id, option.title]))
  for (const option of options) ensure(option.category_id).optionCount += 1

  const votersByCategory = new Map<string, Set<string>>()
  const scoresByCategory = new Map<string, Map<string, number>>()

  for (const vote of votes) {
    const entry = ensure(vote.category_id)
    if (vote.participant_id === participantId) entry.votedByMe = true

    const voters = votersByCategory.get(vote.category_id) ?? new Set<string>()
    voters.add(vote.participant_id)
    votersByCategory.set(vote.category_id, voters)

    // Même pondération que la vue `option_scores` (doc 03 §3.8) :
    // oui = 2, peut-être = 1, non = 0.
    const weight = vote.value === 1 ? 2 : vote.value === 0 ? 1 : 0
    const scores = scoresByCategory.get(vote.category_id) ?? new Map<string, number>()
    scores.set(vote.option_id, (scores.get(vote.option_id) ?? 0) + weight)
    scoresByCategory.set(vote.category_id, scores)
  }

  for (const [categoryId, voters] of votersByCategory) {
    ensure(categoryId).voterIds = [...voters]
  }

  for (const [categoryId, scores] of scoresByCategory) {
    let best: { title: string; score: number } | null = null
    for (const [optionId, score] of scores) {
      // Un score nul ne « mène » rien : trois « non » ne désignent pas un
      // gagnant, et l'annoncer serait trompeur.
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = { title: titleOf.get(optionId) ?? '', score }
      }
    }
    ensure(categoryId).leader = best
  }

  return progress
}

/**
 * Ce qu'une catégorie **dates** apporte au hub (doc 14 §14.2).
 *
 * Elle n'a ni proposition ni vote : sans ce calcul, `optionCount` valait 0, la
 * catégorie n'était jamais « à voter », jamais comptée dans la progression, et
 * ses absents n'étaient jamais nommés. Le hub affichait « Tu es à jour » à
 * quelqu'un qui n'avait pas ouvert le calendrier.
 *
 * `optionCount` reste à 0 — c'est la vérité, il n'y a pas de proposition. C'est
 * `hub-navigation` qui sait que, pour ce mode, ça ne rend pas la catégorie
 * inerte.
 *
 * Pure, donc testable sans réseau : même règle que `computeProgress`.
 */
export function computeAvailabilityProgress(
  categories: Category[],
  rows: AvailabilityRow[],
  participantId: string,
): TripProgress {
  const progress: TripProgress = {}

  const byCategory = new Map<string, AvailabilityRow[]>()
  for (const row of rows) {
    const list = byCategory.get(row.category_id) ?? []
    list.push(row)
    byCategory.set(row.category_id, list)
  }

  for (const category of categories) {
    if (category.vote_mode !== 'availability') continue

    const entries = byCategory.get(category.id) ?? []
    progress[category.id] = {
      optionCount: 0,
      votedByMe: entries.some((entry) => entry.participant_id === participantId),
      voterIds: [...new Set(entries.map((entry) => entry.participant_id))],
      leader: leadingSlot(category, entries),
    }
  }

  return progress
}

/**
 * Le créneau en tête, tel que la carte du hub l'annonce.
 *
 * Même algorithme que l'écran — `rankWindows`, prouvé au sprint 4. Un score nul
 * ne « mène » rien, exactement comme trois « non » ne désignent pas un gagnant.
 */
function leadingSlot(
  category: Category,
  entries: AvailabilityRow[],
): { title: string; score: number } | null {
  const { window_start: from, window_end: to, nights } = category
  if (from === null || to === null || nights === null || entries.length === 0) return null

  const [best] = rankWindows({
    windowStart: from,
    windowEnd: to,
    nights,
    availabilities: entries.map((entry) => ({
      participantId: entry.participant_id,
      day: entry.day,
      status: entry.status,
    })),
  })

  if (!best || best.score <= 0) return null
  return { title: formatRange(best.start, best.end), score: best.score }
}

/**
 * Ce qu'une catégorie **budget** apporte au hub.
 *
 * Même trou que les dates au sprint 5 (doc 14 §14.2), bouché d'emblée : ni
 * proposition ni vote, donc invisible si on la mesurait en propositions.
 *
 * Trois différences avec tout le reste du hub, et elles viennent toutes
 * d'ADR-006 :
 * - `voterIds` reste **vide** — on ne sait pas qui a répondu, et le hub ne
 *   nommera donc jamais personne pour le budget ;
 * - le décompte vient de `respondentCount`, un nombre nu ;
 * - le « meneur » est le montant que tout le monde suit, et seulement quand
 *   le résumé est ouvert (3 réponses, et la mienne).
 */
export function computeBudgetProgress(
  categories: Category[],
  summaries: Record<string, BudgetSummary>,
): TripProgress {
  const progress: TripProgress = {}

  for (const category of categories) {
    if (category.vote_mode !== 'amount') continue
    const summary = summaries[category.id]
    if (!summary) continue

    progress[category.id] = {
      optionCount: 0,
      votedByMe: summary.answered,
      voterIds: [],
      respondentCount: summary.respondents,
      leader:
        summary.status === 'ready'
          ? { title: formatEuros(summary.min), score: summary.respondents }
          : null,
    }
  }

  return progress
}

/**
 * Remplace les votants déduits des votes visibles par ceux que compte la base.
 *
 * Pure, et la seule à savoir que le budget fait exception : il n'y reçoit
 * qu'un nombre, jamais d'identifiants (ADR-006).
 */
export function applyParticipation(
  progress: TripProgress,
  participation: TripParticipation,
  categories: Category[],
  participantId: string,
): TripProgress {
  const next: TripProgress = { ...progress }

  for (const category of categories) {
    const entry = participation[category.id]
    if (!entry) continue

    const current: CategoryProgress = next[category.id] ?? {
      optionCount: 0,
      votedByMe: false,
      voterIds: [],
      leader: null,
    }

    next[category.id] =
      category.vote_mode === 'amount'
        ? { ...current, voterIds: [], respondentCount: entry.count }
        : {
            ...current,
            voterIds: entry.respondents,
            votedByMe: entry.respondents.includes(participantId),
          }
  }

  return next
}

export async function fetchTripProgress(
  tripId: string,
  participantId: string,
  categories: Category[],
): Promise<TripProgress> {
  const [options, votes, availabilities, budgets, participation] = await Promise.all([
    supabase.from('options').select('id, category_id, title').eq('trip_id', tripId),
    supabase
      .from('votes')
      .select('category_id, participant_id, option_id, value')
      .eq('trip_id', tripId),
    // Troisième lecture seulement si le sondage a une catégorie dates : la
    // majorité n'en a pas, et un aller-retour inutile se paie à chaque
    // ouverture du hub.
    fetchAvailabilityRows(
      tripId,
      categories.some((category) => category.vote_mode === 'availability'),
    ),
    // Un appel par catégorie budget — une au plus, en pratique. Rien du tout
    // pour un sondage qui n'en a pas.
    fetchBudgetSummaries(categories),
    fetchParticipation(tripId),
  ])

  if (options.error) throw options.error
  if (votes.error) throw votes.error

  return applyParticipation(
    {
      ...computeProgress(options.data, votes.data, participantId),
      ...computeAvailabilityProgress(categories, availabilities, participantId),
      ...computeBudgetProgress(categories, budgets),
    },
    participation,
    categories,
    participantId,
  )
}

async function fetchBudgetSummaries(
  categories: Category[],
): Promise<Record<string, BudgetSummary>> {
  const budgetCategories = categories.filter((category) => category.vote_mode === 'amount')
  const summaries = await Promise.all(
    budgetCategories.map((category) => fetchBudgetSummary(category.id)),
  )
  return Object.fromEntries(
    budgetCategories.map((category, index) => [category.id, summaries[index]] as const),
  ) as Record<string, BudgetSummary>
}

async function fetchAvailabilityRows(
  tripId: string,
  needed: boolean,
): Promise<AvailabilityRow[]> {
  if (!needed) return []

  const { data, error } = await supabase
    .from('availabilities')
    .select('category_id, participant_id, day, status')
    .eq('trip_id', tripId)

  if (error) throw error
  return data
}
