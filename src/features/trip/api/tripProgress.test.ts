import { describe, expect, it } from 'vitest'
import {
  computeAvailabilityProgress,
  computeProgress,
  type CategoryProgress,
  type TripProgress,
} from '@/features/trip/api/tripProgress'
import type { Category } from '@/types/domain'

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

/**
 * La progression d'une catégorie dates (doc 14 §14.2). Elle ne se mesure ni en
 * propositions ni en votes : on y peint un calendrier.
 */
function datesCategory(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    trip_id: 'trip',
    kind: 'dates',
    label: 'Dates',
    description: null,
    vote_mode: 'availability',
    status: 'open',
    position: 0,
    allow_participant_options: false,
    max_choices: null,
    window_start: '2027-07-01',
    window_end: '2027-07-20',
    nights: 2,
    currency: 'EUR',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Marie et Thomas sont libres du 10 au 12 ; personne d'autre n'a rien peint. */
const painted = [
  { category_id: 'd1', participant_id: 'p1', day: '2027-07-10', status: 'yes' as const },
  { category_id: 'd1', participant_id: 'p1', day: '2027-07-11', status: 'yes' as const },
  { category_id: 'd1', participant_id: 'p1', day: '2027-07-12', status: 'yes' as const },
  { category_id: 'd1', participant_id: 'p2', day: '2027-07-10', status: 'yes' as const },
  { category_id: 'd1', participant_id: 'p2', day: '2027-07-11', status: 'yes' as const },
  { category_id: 'd1', participant_id: 'p2', day: '2027-07-12', status: 'yes' as const },
]

describe('computeAvailabilityProgress', () => {
  const dates = datesCategory('d1')

  it('inscrit la catégorie même quand personne n’a rien peint', () => {
    const progress = computeAvailabilityProgress([dates], [], 'me')

    expect(at(progress, 'd1')).toEqual({
      optionCount: 0,
      votedByMe: false,
      voterIds: [],
      leader: null,
    })
  })

  it('repère mes propres jours', () => {
    const mine = [{ ...painted[0]!, participant_id: 'me' }]

    expect(at(computeAvailabilityProgress([dates], mine, 'me'), 'd1').votedByMe).toBe(true)
    expect(at(computeAvailabilityProgress([dates], painted, 'me'), 'd1').votedByMe).toBe(false)
  })

  it('ne compte chaque personne qu’une fois, quel que soit son nombre de jours', () => {
    expect(at(computeAvailabilityProgress([dates], painted, 'me'), 'd1').voterIds).toEqual([
      'p1',
      'p2',
    ])
  })

  it('annonce le créneau en tête, dans les mots de l’écran', () => {
    expect(at(computeAvailabilityProgress([dates], painted, 'me'), 'd1').leader).toEqual({
      title: 'sam. 10 → lun. 12 juillet',
      score: 4,
    })
  })

  it('ne désigne aucun meneur sans fenêtre de recherche', () => {
    const sansFenetre = datesCategory('d1', { window_start: null, nights: null })

    expect(at(computeAvailabilityProgress([sansFenetre], painted, 'me'), 'd1').leader).toBeNull()
  })

  it('ignore les catégories qui ne sont pas en mode dates', () => {
    const autre = datesCategory('c1', { vote_mode: 'approval', kind: 'destination' })

    expect(computeAvailabilityProgress([autre], painted, 'me')).toEqual({})
  })
})
