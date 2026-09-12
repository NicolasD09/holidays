import type { TripProgress } from '@/features/trip/api/tripProgress'
import type { Category, Participant } from '@/types/domain'

/**
 * Les deux questions que pose le hub : « où dois-je aller maintenant ? » et
 * « qui manque encore ? ». Pures, donc testables sans React.
 */

/**
 * Une catégorie compte comme traitée dès **un** vote.
 *
 * C'est approximatif — on peut s'être prononcé sur 1 proposition sur 6 et
 * être compté à jour. Toute autre règle (tout voter ? la moitié ?) imposerait
 * une pression que le produit s'interdit (doc 05 §5.1-5), et transformerait
 * un tableau de bord en liste de devoirs.
 *
 * Une catégorie clôturée, ou sans aucune proposition, n'est jamais « à
 * voter » : il n'y a rien à y faire.
 */
export function isActionable(category: Category, progress: TripProgress): boolean {
  if (category.status === 'closed') return false
  const entry = progress[category.id]
  if (!entry || entry.optionCount === 0) return false
  return !entry.votedByMe
}

/** La prochaine catégorie où ce participant a quelque chose à faire. */
export function nextActionable(
  categories: Category[],
  progress: TripProgress,
  afterCategoryId?: string,
): Category | null {
  const start = afterCategoryId
    ? categories.findIndex((category) => category.id === afterCategoryId) + 1
    : 0

  // On repart du début après la dernière : le parcours boucle plutôt que de
  // s'arrêter net sur « suivant » quand il reste à faire plus haut.
  const ordered = [...categories.slice(start), ...categories.slice(0, start)]
  return ordered.find((category) => isActionable(category, progress)) ?? null
}

/** Combien de catégories ce participant a-t-il traitées, sur combien d'utiles ? */
export function countDone(
  categories: Category[],
  progress: TripProgress,
): { done: number; total: number } {
  const relevant = categories.filter(
    (category) => category.status !== 'closed' && (progress[category.id]?.optionCount ?? 0) > 0,
  )
  return {
    done: relevant.filter((category) => progress[category.id]?.votedByMe).length,
    total: relevant.length,
  }
}

/**
 * Les prénoms de ceux qui n'ont pas encore tout traité, hors soi-même.
 *
 * Purement informatif : le hub ne les affiche que lorsque le lecteur est
 * lui-même à jour, et sans jamais suggérer de retard. Aucun bouton de
 * relance ici — c'est le sprint 8, et il obéit à RM-15.
 */
export function missingParticipants(
  categories: Category[],
  progress: TripProgress,
  participants: Participant[],
  meId: string,
): string[] {
  const relevant = categories.filter(
    (category) => category.status !== 'closed' && (progress[category.id]?.optionCount ?? 0) > 0,
  )
  if (relevant.length === 0) return []

  return participants
    .filter((participant) => participant.id !== meId)
    .filter((participant) =>
      relevant.some(
        (category) => !progress[category.id]?.voterIds.includes(participant.id),
      ),
    )
    .map((participant) => participant.display_name)
}
