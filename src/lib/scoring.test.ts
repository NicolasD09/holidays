import { describe, expect, it } from 'vitest'
import { rankWindows, respondents, type AvailabilityEntry } from '@/lib/scoring'

/**
 * Le classement des créneaux est la seule pièce du produit qu'aucun écran ne
 * permet de vérifier d'un coup d'œil : on ne « voit » pas qu'un score est
 * faux. D'où une couverture visée à 100 % (doc 06 §6.5), et des cas écrits
 * pour être relus plutôt que pour faire du nombre.
 *
 * Convention : un séjour de N nuits occupe **N + 1 jours**, du jour d'arrivée
 * au jour de départ inclus — « sam. 11 → sam. 18 » est un séjour de 7 nuits
 * (doc 05 §5.3 5.b).
 */

const dispo = (
  participantId: string,
  days: string[],
  status: AvailabilityEntry['status'] = 'yes',
): AvailabilityEntry[] => days.map((day) => ({ participantId, day, status }))

/** Tous les jours de `from` à `to` inclus. */
function range(from: string, to: string): string[] {
  const days: string[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

describe('respondents', () => {
  it('déduit les répondants des saisies, sans doublon et triés', () => {
    const entries = [...dispo('b', ['2027-07-01']), ...dispo('a', ['2027-07-01', '2027-07-02'])]

    expect(respondents(entries)).toEqual(['a', 'b'])
  })

  it('ne voit personne quand rien n’a été peint', () => {
    expect(respondents([])).toEqual([])
  })
})

describe('rankWindows — bornes et cas dégénérés', () => {
  const base = { windowStart: '2027-07-01', windowEnd: '2027-07-10', availabilities: [] }

  it('refuse une durée nulle ou négative', () => {
    expect(rankWindows({ ...base, nights: 0 })).toEqual([])
    expect(rankWindows({ ...base, nights: -3 })).toEqual([])
  })

  it('renvoie vide si la fenêtre est trop courte pour un séjour entier', () => {
    expect(rankWindows({ ...base, windowEnd: '2027-07-05', nights: 7 })).toEqual([])
  })

  it('renvoie vide sur une date illisible', () => {
    expect(rankWindows({ ...base, windowStart: 'pas-une-date', nights: 2 })).toEqual([])
    expect(rankWindows({ ...base, windowEnd: 'pas-une-date', nights: 2 })).toEqual([])
  })

  it('produit exactement un créneau quand la fenêtre l’épouse', () => {
    const windows = rankWindows({ ...base, windowEnd: '2027-07-08', nights: 7 })

    expect(windows).toHaveLength(1)
    expect(windows[0]).toMatchObject({ start: '2027-07-01', end: '2027-07-08' })
  })

  it('énumère toutes les fenêtres glissantes', () => {
    // 9 jours d'écart, séjours de 2 nuits → 8 départs possibles.
    const windows = rankWindows({ ...base, nights: 2 })

    expect(windows).toHaveLength(8)
    expect(windows.map((w) => w.start)).toContain('2027-07-01')
    expect(windows.map((w) => w.start)).toContain('2027-07-08')
  })

  it('classe tout à zéro quand personne n’a répondu', () => {
    const windows = rankWindows({ ...base, nights: 2 })

    expect(windows.every((w) => w.score === 0)).toBe(true)
    expect(windows[0]?.blocked).toEqual([])
  })

  it('traverse un changement de mois sans décalage', () => {
    const windows = rankWindows({
      windowStart: '2027-07-30',
      windowEnd: '2027-08-03',
      nights: 2,
      availabilities: [],
    })

    expect(windows.map((w) => `${w.start}→${w.end}`)).toEqual([
      '2027-07-30→2027-08-01',
      '2027-07-31→2027-08-02',
      '2027-08-01→2027-08-03',
    ])
  })
})

describe('rankWindows — barème du doc 02 §2.5', () => {
  const fenetre = { windowStart: '2027-07-01', windowEnd: '2027-07-09', nights: 2 }

  it('compte 2 pour un participant disponible sur toute la durée', () => {
    const windows = rankWindows({
      ...fenetre,
      availabilities: dispo('marie', ['2027-07-01', '2027-07-02', '2027-07-03']),
    })
    const premier = windows.find((w) => w.start === '2027-07-01')

    expect(premier).toMatchObject({ score: 2, fullyAvailable: ['marie'], blocked: [] })
  })

  it('compte 1 dès qu’un jour est « peut-être », sans aucun refus', () => {
    const windows = rankWindows({
      ...fenetre,
      availabilities: [
        ...dispo('marie', ['2027-07-01', '2027-07-03']),
        ...dispo('marie', ['2027-07-02'], 'maybe'),
      ],
    })

    expect(windows.find((w) => w.start === '2027-07-01')).toMatchObject({
      score: 1,
      tentative: ['marie'],
    })
  })

  it('compte 0 dès un seul refus dans la durée, et nomme l’absent', () => {
    const windows = rankWindows({
      ...fenetre,
      availabilities: [
        ...dispo('marie', ['2027-07-01', '2027-07-02']),
        ...dispo('marie', ['2027-07-03'], 'no'),
      ],
    })

    expect(windows.find((w) => w.start === '2027-07-01')).toMatchObject({
      score: 0,
      blocked: ['marie'],
    })
  })

  it('le refus l’emporte sur le reste, où qu’il tombe dans la durée', () => {
    const windows = rankWindows({
      ...fenetre,
      availabilities: [
        ...dispo('marie', ['2027-07-01'], 'no'),
        ...dispo('marie', ['2027-07-02', '2027-07-03']),
      ],
    })

    expect(windows.find((w) => w.start === '2027-07-01')?.blocked).toEqual(['marie'])
  })

  it('additionne les participants', () => {
    const windows = rankWindows({
      ...fenetre,
      availabilities: [
        ...dispo('marie', range('2027-07-01', '2027-07-03')),
        ...dispo('thomas', range('2027-07-01', '2027-07-03')),
        ...dispo('sarah', ['2027-07-02'], 'maybe'),
      ],
    })

    // 2 + 2 + 1 : Sarah n'a rien refusé, ses autres jours sont inconnus.
    expect(windows.find((w) => w.start === '2027-07-01')?.score).toBe(5)
  })

  it('exclut du décompte celui qui n’a rien peint du tout', () => {
    const windows = rankWindows({
      ...fenetre,
      availabilities: dispo('marie', range('2027-07-01', '2027-07-03')),
    })
    const premier = windows.find((w) => w.start === '2027-07-01')

    // Julien n'apparaît nulle part : il n'a pas dit non, il n'a rien dit.
    expect([...(premier?.fullyAvailable ?? []), ...(premier?.tentative ?? []), ...(premier?.blocked ?? [])])
      .toEqual(['marie'])
  })
})

describe('rankWindows — le jour non renseigné', () => {
  it('ne bloque pas, mais ne confirme pas : il vaut « peut-être »', () => {
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-09',
      nights: 2,
      // Marie n'a peint que le 1er : les 2 et 3 sont inconnus.
      availabilities: dispo('marie', ['2027-07-01']),
    })

    expect(windows.find((w) => w.start === '2027-07-01')).toMatchObject({
      score: 1,
      tentative: ['marie'],
      fullyAvailable: [],
    })
  })

  it('un calendrier entièrement inconnu ne met personne en tête', () => {
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-09',
      nights: 2,
      availabilities: [
        ...dispo('marie', range('2027-07-05', '2027-07-07')),
        ...dispo('thomas', ['2027-07-01']),
      ],
    })

    // Le créneau que Marie a réellement peint passe devant celui que Thomas
    // a seulement effleuré.
    expect(windows[0]?.start).toBe('2027-07-05')
  })
})

describe('rankWindows — ordre et départages', () => {
  it('classe par score décroissant', () => {
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-09',
      nights: 2,
      availabilities: dispo('marie', range('2027-07-06', '2027-07-08')),
    })

    expect(windows[0]?.start).toBe('2027-07-06')
    expect(windows[0]?.score).toBeGreaterThan(windows[windows.length - 1]?.score ?? 0)
  })

  it('à score égal, préfère le créneau qui n’exclut personne', () => {
    // Créneau A (01→03) : deux personnes à fond, deux bloquées → 4, 2 absents.
    // Créneau B (06→08) : quatre personnes « peut-être »       → 4, 0 absent.
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-08',
      nights: 2,
      availabilities: [
        ...dispo('a', range('2027-07-01', '2027-07-03')),
        ...dispo('b', range('2027-07-01', '2027-07-03')),
        ...dispo('c', ['2027-07-02'], 'no'),
        ...dispo('d', ['2027-07-02'], 'no'),
        ...dispo('a', ['2027-07-06'], 'maybe'),
        ...dispo('b', ['2027-07-06'], 'maybe'),
        ...dispo('c', ['2027-07-06'], 'maybe'),
        ...dispo('d', ['2027-07-06'], 'maybe'),
      ],
    })

    const a = windows.findIndex((w) => w.start === '2027-07-01')
    const b = windows.findIndex((w) => w.start === '2027-07-06')

    expect(windows[a]?.score).toBe(windows[b]?.score)
    expect(b).toBeLessThan(a)
  })

  it('à score et absents égaux, garde le plus tôt — l’ordre est reproductible', () => {
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-09',
      nights: 2,
      availabilities: [],
    })

    expect(windows.map((w) => w.start)).toEqual([...windows.map((w) => w.start)].sort())
  })

  it('range chaque participant dans une seule catégorie', () => {
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-04',
      nights: 2,
      availabilities: [
        ...dispo('a', range('2027-07-01', '2027-07-03')),
        ...dispo('b', ['2027-07-02'], 'maybe'),
        ...dispo('c', ['2027-07-02'], 'no'),
      ],
    })
    const premier = windows.find((w) => w.start === '2027-07-01')

    expect(premier?.fullyAvailable).toEqual(['a'])
    expect(premier?.tentative).toEqual(['b'])
    expect(premier?.blocked).toEqual(['c'])
  })
})

describe('rankWindows — le cas que le doc 08 exige', () => {
  it('sort le créneau attendu en tête pour trois dispos croisées', () => {
    // Marie est libre du 10 au 20, Thomas du 8 au 15, Sarah du 12 au 25.
    // Le seul créneau de 3 nuits commun aux trois commence le 12.
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-31',
      nights: 3,
      availabilities: [
        ...dispo('marie', range('2027-07-10', '2027-07-20')),
        ...dispo('thomas', range('2027-07-08', '2027-07-15')),
        ...dispo('sarah', range('2027-07-12', '2027-07-25')),
      ],
    })

    expect(windows[0]).toMatchObject({
      start: '2027-07-12',
      end: '2027-07-15',
      score: 6,
      blocked: [],
    })
    expect(windows[0]?.fullyAvailable).toEqual(['marie', 'sarah', 'thomas'])
  })

  it('ne plante pas quand personne n’est dispo en même temps', () => {
    const windows = rankWindows({
      windowStart: '2027-07-01',
      windowEnd: '2027-07-20',
      nights: 2,
      availabilities: [
        ...dispo('marie', range('2027-07-01', '2027-07-10'), 'no'),
        ...dispo('thomas', range('2027-07-11', '2027-07-20'), 'no'),
      ],
    })

    expect(windows).not.toHaveLength(0)
    // Chaque créneau bloque au moins une personne : aucun n'est praticable,
    // et le classement le dit au lieu de renvoyer une liste vide.
    expect(windows.every((w) => w.blocked.length > 0)).toBe(true)
  })
})
