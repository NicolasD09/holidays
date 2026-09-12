import { describe, expect, it } from 'vitest'
import {
  computeProgress,
  type CategoryProgress,
  type TripProgress,
} from '@/features/trip/api/tripProgress'

/**
 * `computeProgress` remplace une RPC d'agrégat (doc 11 §11.2). C'est donc du
 * calcul métier qui vit côté client : il doit être tenu par des tests, pas
 * par la relecture.
 */

/**
 * `noUncheckedIndexedAccess` rend tout accès par clé optionnel. Plutôt que de
 * semer des `?.` qui feraient passer un test sur une catégorie absente, on
 * échoue franchement ici.
 */
function at(progress: TripProgress, id: string): CategoryProgress {
  const entry = progress[id]
  if (!entry) throw new Error(`catégorie ${id} absente de la progression`)
  return entry
}

const options = [
  { id: 'o1', category_id: 'c1', title: 'Lisbonne' },
  { id: 'o2', category_id: 'c1', title: 'Palerme' },
  { id: 'o3', category_id: 'c2', title: 'Airbnb' },
]

describe('computeProgress', () => {
  it('compte les propositions par catégorie', () => {
    const progress = computeProgress(options, [], 'me')

    expect(at(progress, 'c1').optionCount).toBe(2)
    expect(at(progress, 'c2').optionCount).toBe(1)
  })

  it('repère mes propres votes', () => {
    const progress = computeProgress(options, [
      { category_id: 'c1', participant_id: 'me', option_id: 'o1', value: 1 },
    ], 'me')

    expect(at(progress, 'c1').votedByMe).toBe(true)
    expect(at(progress, 'c2').votedByMe).toBe(false)
  })

  it('ne compte chaque votant qu’une fois, quel que soit son nombre de votes', () => {
    const progress = computeProgress(options, [
      { category_id: 'c1', participant_id: 'p2', option_id: 'o1', value: 1 },
      { category_id: 'c1', participant_id: 'p2', option_id: 'o2', value: -1 },
    ], 'me')

    expect(at(progress, 'c1').voterIds).toEqual(['p2'])
  })

  it('pondère comme la vue option_scores : oui = 2, peut-être = 1, non = 0', () => {
    const progress = computeProgress(options, [
      { category_id: 'c1', participant_id: 'p2', option_id: 'o1', value: 0 },
      { category_id: 'c1', participant_id: 'p3', option_id: 'o2', value: 1 },
    ], 'me')

    expect(at(progress, 'c1').leader).toEqual({ title: 'Palerme', score: 2 })
  })

  it('ne désigne pas de meneur quand tout le monde a dit non', () => {
    const progress = computeProgress(options, [
      { category_id: 'c1', participant_id: 'p2', option_id: 'o1', value: -1 },
      { category_id: 'c1', participant_id: 'p3', option_id: 'o2', value: -1 },
    ], 'me')

    expect(at(progress, 'c1').leader).toBeNull()
  })

  it('tient debout sans aucun vote', () => {
    const progress = computeProgress(options, [], 'me')

    expect(at(progress, 'c1')).toEqual({
      optionCount: 2,
      votedByMe: false,
      voterIds: [],
      leader: null,
    })
  })

  it('n’invente pas de catégorie absente', () => {
    expect(computeProgress([], [], 'me')).toEqual({})
  })
})
