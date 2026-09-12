import { formatRange } from '@/lib/dates'
import { rankWindows } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import type { AvailabilityStatus, Category } from '@/types/domain'

/**
 * De quoi remplir le hub : par catégorie, combien de propositions, qui s'est
 * prononcé, et qui mène.
 *
 * **Pourquoi côté client.** Il n'existe pas de RPC d'agrégat de participation
 * (doc 11 §11.2), et en écrire une imposerait une migration pour un besoin
 * que deux `select` couvrent. Deux lectures suffisent pour tout le hub,
 * quelle que soit le nombre de catégories — pas de N+1.
 *
 * **Sa limite, assumée et datée.** Le décompte des votants suppose qu'on voit
 * les votes des autres. C'est vrai tant que `blind_mode` est faux, ce qui est
 * le cas partout aujourd'hui : `app_create_trip` n'a pas de paramètre pour
 * l'activer. Le jour où la bascule arrive (sprint 7), `votes_select` masquera
 * les votes d'autrui et ce compteur affichera 1/8 pour tout le monde — il
 * faudra alors une RPC `app_category_participation`. Ce n'est pas une fuite,
 * c'est un compteur qui mentirait : à solder avec la bascule, pas avant.
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

export async function fetchTripProgress(
  tripId: string,
  participantId: string,
  categories: Category[],
): Promise<TripProgress> {
  const [options, votes, availabilities] = await Promise.all([
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
  ])

  if (options.error) throw options.error
  if (votes.error) throw votes.error

  return {
    ...computeProgress(options.data, votes.data, participantId),
    ...computeAvailabilityProgress(categories, availabilities, participantId),
  }
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
