import { describe, expect, it } from 'vitest'
import type { TripProgress } from '@/features/trip/api/tripProgress'
import {
  countDone,
  isActionable,
  missingParticipants,
  nextActionable,
} from '@/features/trip/hub-navigation'
import type { Category, Participant } from '@/types/domain'

/**
 * Le hub se résume à ces quatre fonctions : ce qu'il affiche et où il envoie.
 * Les tester ici évite d'avoir à monter React pour vérifier une règle métier.
 */

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    trip_id: 'trip',
    kind: 'custom',
    label: id,
    description: null,
    vote_mode: 'approval',
    status: 'open',
    position: 0,
    allow_participant_options: true,
    max_choices: null,
    window_start: null,
    window_end: null,
    nights: null,
    currency: 'EUR',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function participant(id: string, name: string): Participant {
  return {
    id,
    trip_id: 'trip',
    display_name: name,
    avatar_emoji: null,
    avatar_color: null,
    auth_uid: null,
    is_organizer: false,
    created_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
  }
}

const entry = (over: Partial<TripProgress[string]> = {}): TripProgress[string] => ({
  optionCount: 3,
  votedByMe: false,
  voterIds: [],
  leader: null,
  ...over,
})

describe('isActionable', () => {
  it('retient une catégorie ouverte, pourvue, et pas encore votée', () => {
    expect(isActionable(category('a'), { a: entry() })).toBe(true)
  })

  it('écarte une catégorie déjà votée', () => {
    expect(isActionable(category('a'), { a: entry({ votedByMe: true }) })).toBe(false)
  })

  it('écarte une catégorie clôturée', () => {
    expect(isActionable(category('a', { status: 'closed' }), { a: entry() })).toBe(false)
  })

  it('écarte une catégorie sans proposition — il n’y a rien à y faire', () => {
    expect(isActionable(category('a'), { a: entry({ optionCount: 0 }) })).toBe(false)
  })

  it('écarte une catégorie absente de la progression', () => {
    expect(isActionable(category('a'), {})).toBe(false)
  })
})

describe('nextActionable', () => {
  const categories = [category('a'), category('b'), category('c')]

  it('renvoie la première catégorie à traiter', () => {
    const progress = { a: entry({ votedByMe: true }), b: entry(), c: entry() }
    expect(nextActionable(categories, progress)?.id).toBe('b')
  })

  it('repart après la catégorie courante', () => {
    const progress = { a: entry(), b: entry(), c: entry() }
    expect(nextActionable(categories, progress, 'a')?.id).toBe('b')
  })

  it('boucle au début plutôt que de s’arrêter net sur la dernière', () => {
    const progress = { a: entry(), b: entry({ votedByMe: true }), c: entry({ votedByMe: true }) }
    expect(nextActionable(categories, progress, 'c')?.id).toBe('a')
  })

  it('renvoie null quand il n’y a plus rien à faire', () => {
    const progress = {
      a: entry({ votedByMe: true }),
      b: entry({ votedByMe: true }),
      c: entry({ votedByMe: true }),
    }
    expect(nextActionable(categories, progress)).toBeNull()
  })
})

describe('countDone', () => {
  it('ne compte que les catégories où il y a quelque chose à faire', () => {
    const categories = [
      category('a'),
      category('b', { status: 'closed' }),
      category('c'),
      category('d'),
    ]
    const progress = {
      a: entry({ votedByMe: true }),
      b: entry({ votedByMe: true }),
      c: entry(),
      d: entry({ optionCount: 0 }),
    }

    // `b` est clôturée et `d` est vide : ni l'une ni l'autre n'entre au total.
    expect(countDone(categories, progress)).toEqual({ done: 1, total: 2 })
  })

  it('ne divise jamais par zéro quand tout est vide', () => {
    expect(countDone([category('a')], { a: entry({ optionCount: 0 }) })).toEqual({
      done: 0,
      total: 0,
    })
  })
})

describe('missingParticipants', () => {
  const categories = [category('a'), category('b')]
  const people = [participant('me', 'Marie'), participant('p2', 'Thomas'), participant('p3', 'Sarah')]

  it('nomme ceux qui n’ont pas tout traité, jamais soi-même', () => {
    const progress = {
      a: entry({ voterIds: ['me', 'p2', 'p3'] }),
      b: entry({ voterIds: ['p2'] }),
    }

    expect(missingParticipants(categories, progress, people, 'me')).toEqual(['Sarah'])
  })

  it('ne nomme personne quand tout le monde a répondu partout', () => {
    const progress = {
      a: entry({ voterIds: ['me', 'p2', 'p3'] }),
      b: entry({ voterIds: ['me', 'p2', 'p3'] }),
    }

    expect(missingParticipants(categories, progress, people, 'me')).toEqual([])
  })

  it('ne nomme personne quand aucune catégorie n’a de proposition', () => {
    const progress = { a: entry({ optionCount: 0 }), b: entry({ optionCount: 0 }) }

    expect(missingParticipants(categories, progress, people, 'me')).toEqual([])
  })
})

/**
 * Le correctif du doc 14 §14.2. Une catégorie dates n'a aucune proposition :
 * mesurée en propositions, elle était invisible du hub — jamais « à voter »,
 * jamais comptée, ses absents jamais nommés. Le hub annonçait « Tu es à jour »
 * à quelqu'un qui n'avait pas ouvert le calendrier.
 */
describe('catégories dates', () => {
  const dates = category('d', { vote_mode: 'availability' })
  const vide = entry({ optionCount: 0 })

  it('reste à voter sans proposition — on y peint, on n’y propose pas', () => {
    expect(isActionable(dates, { d: vide })).toBe(true)
  })

  it('sort de la liste dès qu’un seul jour est peint', () => {
    expect(isActionable(dates, { d: entry({ optionCount: 0, votedByMe: true }) })).toBe(false)
  })

  it('redevient inerte une fois clôturée', () => {
    const closed = category('d', { vote_mode: 'availability', status: 'closed' })
    expect(isActionable(closed, { d: vide })).toBe(false)
  })

  it('est atteinte par « Continuer à voter »', () => {
    expect(nextActionable([dates], { d: vide })?.id).toBe('d')
  })

  it('compte dans la progression', () => {
    expect(countDone([dates], { d: vide })).toEqual({ done: 0, total: 1 })
    expect(countDone([dates], { d: entry({ optionCount: 0, votedByMe: true }) })).toEqual({
      done: 1,
      total: 1,
    })
  })

  it('nomme ceux qui n’ont pas encore peint', () => {
    const people = [participant('me', 'Marie'), participant('p2', 'Thomas')]

    expect(missingParticipants([dates], { d: vide }, people, 'me')).toEqual(['Thomas'])
  })

  it('n’ouvre pas la porte aux autres modes sans proposition', () => {
    // La règle est propre au mode `availability` : ailleurs, pas de
    // proposition veut toujours dire rien à faire.
    expect(isActionable(category('a'), { a: vide })).toBe(false)
  })
})
