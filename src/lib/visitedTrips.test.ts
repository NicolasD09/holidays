import { afterEach, describe, expect, it, vi } from 'vitest'
import { forgetTrip, readVisitedTrips, rememberTrip } from '@/lib/visitedTrips'

/**
 * `localStorage` est la seule dépendance de `/mine`, et c'est celle qui casse
 * en navigation privée iOS. Ces tests couvrent surtout les cas tordus : une
 * liste vide est un résultat acceptable, une exception ne l'est pas.
 */

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('visitedTrips', () => {
  it('retient un sondage et le relit', () => {
    rememberTrip({ slug: 'abc', title: 'Été 2027', emoji: '🏖️' })

    expect(readVisitedTrips()).toEqual([
      expect.objectContaining({ slug: 'abc', title: 'Été 2027', emoji: '🏖️' }),
    ])
  })

  it('ne crée pas de doublon et remonte le sondage revu', () => {
    rememberTrip({ slug: 'a', title: 'A', emoji: null })
    rememberTrip({ slug: 'b', title: 'B', emoji: null })
    rememberTrip({ slug: 'a', title: 'A renommé', emoji: null })

    const trips = readVisitedTrips()
    expect(trips).toHaveLength(2)
    expect(trips[0]?.slug).toBe('a')
    expect(trips[0]?.title).toBe('A renommé')
  })

  it('oublie un sondage à la demande', () => {
    rememberTrip({ slug: 'a', title: 'A', emoji: null })
    forgetTrip('a')

    expect(readVisitedTrips()).toEqual([])
  })

  it('renvoie une liste vide quand rien n’a été enregistré', () => {
    expect(readVisitedTrips()).toEqual([])
  })

  it('ignore un contenu illisible plutôt que de lever', () => {
    window.localStorage.setItem('holidays.visited-trips', 'pas du json')

    expect(readVisitedTrips()).toEqual([])
  })

  it('écarte les entrées mal formées sans jeter les bonnes', () => {
    window.localStorage.setItem(
      'holidays.visited-trips',
      JSON.stringify([
        { slug: 'ok', title: 'Bon', emoji: null, lastSeenAt: '2026-01-01T00:00:00Z' },
        { slug: 42 },
        null,
        'nimportequoi',
      ]),
    )

    expect(readVisitedTrips().map((trip) => trip.slug)).toEqual(['ok'])
  })

  it('ne lève pas quand le stockage est indisponible', () => {
    // Navigation privée iOS : l'accès lui-même peut jeter.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => rememberTrip({ slug: 'a', title: 'A', emoji: null })).not.toThrow()
    expect(readVisitedTrips()).toEqual([])
  })

  it('trie du plus récent au plus ancien', () => {
    window.localStorage.setItem(
      'holidays.visited-trips',
      JSON.stringify([
        { slug: 'vieux', title: 'V', emoji: null, lastSeenAt: '2026-01-01T00:00:00Z' },
        { slug: 'recent', title: 'R', emoji: null, lastSeenAt: '2026-06-01T00:00:00Z' },
      ]),
    )

    expect(readVisitedTrips().map((trip) => trip.slug)).toEqual(['recent', 'vieux'])
  })
})
