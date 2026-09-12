import { supabase } from '@/lib/supabase'

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

export async function fetchTripProgress(
  tripId: string,
  participantId: string,
): Promise<TripProgress> {
  const [options, votes] = await Promise.all([
    supabase.from('options').select('id, category_id, title').eq('trip_id', tripId),
    supabase
      .from('votes')
      .select('category_id, participant_id, option_id, value')
      .eq('trip_id', tripId),
  ])

  if (options.error) throw options.error
  if (votes.error) throw votes.error

  return computeProgress(options.data, votes.data, participantId)
}
