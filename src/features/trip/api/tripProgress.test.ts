import { describe, expect, it } from 'vitest'
import {
  applyParticipation,
  computeAvailabilityProgress,
  computeBudgetProgress,
  computeProgress,
  type CategoryProgress,
  type TripProgress,
} from '@/features/trip/api/tripProgress'
import type { BudgetSummary, Category } from '@/types/domain'

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

describe('computeBudgetProgress', () => {
  const budget = datesCategory('b', {
    kind: 'budget',
    vote_mode: 'amount',
    window_start: null,
    window_end: null,
    nights: null,
  })

  const ready: BudgetSummary = {
    status: 'ready',
    respondents: 4,
    answered: true,
    min: 700,
    median: 900,
    max: 1200,
    step: 25,
    curve: [
      { amount: 700, followers: 4 },
      { amount: 725, followers: 3 },
    ],
  }

  it('compte les réponses sans jamais lister leurs auteurs', () => {
    const progress = computeBudgetProgress([budget], { b: ready })

    expect(at(progress, 'b').respondentCount).toBe(4)
    // ADR-006 : savoir qui a répondu est déjà trop.
    expect(at(progress, 'b').voterIds).toEqual([])
  })

  it('sait si j’ai répondu', () => {
    const waiting: BudgetSummary = { status: 'answer_first', respondents: 2, answered: false }

    expect(at(computeBudgetProgress([budget], { b: waiting }), 'b').votedByMe).toBe(false)
    expect(at(computeBudgetProgress([budget], { b: ready }), 'b').votedByMe).toBe(true)
  })

  it('annonce le montant que tout le monde suit, une fois le résumé ouvert', () => {
    const leader = at(computeBudgetProgress([budget], { b: ready }), 'b').leader

    expect(leader?.title.replace(/\s/g, ' ')).toBe('700 €')
  })

  it('n’annonce rien sous 3 réponses', () => {
    const few: BudgetSummary = { status: 'insufficient', respondents: 2, answered: true }

    expect(at(computeBudgetProgress([budget], { b: few }), 'b').leader).toBeNull()
  })

  it('ignore les catégories qui ne sont pas un budget, et celles sans résumé', () => {
    expect(computeBudgetProgress([datesCategory('d')], { d: ready })).toEqual({})
    expect(computeBudgetProgress([budget], {})).toEqual({})
  })
})

/**
 * La participation vient de la base depuis le sprint 7 (migration 9). Le cas
 * qui justifie tout : le mode aveugle, où les votes d'autrui sont masqués à
 * qui n'a pas encore voté.
 */
describe('applyParticipation', () => {
  const approval = datesCategory('c1', {
    kind: 'destination',
    vote_mode: 'approval',
    window_start: null,
    window_end: null,
    nights: null,
  })
  const budget = datesCategory('b1', {
    kind: 'budget',
    vote_mode: 'amount',
    window_start: null,
    window_end: null,
    nights: null,
  })

  it('compte les autres même quand leurs votes sont masqués (mode aveugle)', () => {
    // Je n'ai pas voté : je ne lis aucun vote, donc aucun votant côté client.
    const blind = computeProgress([{ id: 'o1', category_id: 'c1', title: 'Lisbonne' }], [], 'me')
    expect(at(blind, 'c1').voterIds).toEqual([])

    const merged = applyParticipation(
      blind,
      { c1: { respondents: ['p1', 'p2'], count: 2 } },
      [approval],
      'me',
    )
    expect(at(merged, 'c1').voterIds).toEqual(['p1', 'p2'])
    expect(at(merged, 'c1').votedByMe).toBe(false)
    // Le reste — propositions, meneur — reste ce que l'appareil peut voir.
    expect(at(merged, 'c1').optionCount).toBe(1)
    expect(at(merged, 'c1').leader).toBeNull()
  })

  it('me reconnaît parmi les répondants', () => {
    const merged = applyParticipation({}, { c1: { respondents: ['me'], count: 1 } }, [approval], 'me')
    expect(at(merged, 'c1').votedByMe).toBe(true)
  })

  it('ne donne qu’un nombre pour le budget, jamais d’identifiant (ADR-006)', () => {
    const merged = applyParticipation(
      computeBudgetProgress([budget], {
        b1: { status: 'insufficient', respondents: 2, answered: true },
      }),
      // Même si la RPC renvoyait un jour des identifiants, on ne les garde pas.
      { b1: { respondents: ['p1'], count: 2 } },
      [budget],
      'me',
    )
    expect(at(merged, 'b1').voterIds).toEqual([])
    expect(at(merged, 'b1').respondentCount).toBe(2)
    expect(at(merged, 'b1').votedByMe).toBe(true)
  })

  it('laisse intacte une catégorie absente de la participation', () => {
    const progress = computeProgress([{ id: 'o1', category_id: 'c1', title: 'Lisbonne' }], [], 'me')
    expect(applyParticipation(progress, {}, [approval], 'me')).toEqual(progress)
  })
})
