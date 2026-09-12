import { describe, expect, it } from 'vitest'
import {
  buildCalendar,
  daysInWindow,
  formatDay,
  formatRange,
  weekdayHeaders,
} from '@/lib/dates'

/**
 * Un calendrier construit à la main mérite des tests : il n'y a pas de
 * librairie pour absorber les cas tordus — fin de mois, année bissextile,
 * semaine à cheval.
 *
 * Le simple fait d'importer ce module est déjà une vérification : `weekdayHeaders`
 * s'évalue au chargement, et un formateur déclaré trop bas le ferait échouer
 * avant même le premier `it`.
 */

describe('daysInWindow', () => {
  it('inclut les deux bornes', () => {
    expect(daysInWindow('2027-07-01', '2027-07-03')).toEqual([
      '2027-07-01',
      '2027-07-02',
      '2027-07-03',
    ])
  })

  it('renvoie un seul jour quand les bornes se confondent', () => {
    expect(daysInWindow('2027-07-01', '2027-07-01')).toEqual(['2027-07-01'])
  })

  it('renvoie vide sur une fenêtre à l’envers', () => {
    expect(daysInWindow('2027-07-10', '2027-07-01')).toEqual([])
  })

  it('traverse un changement d’heure sans perdre ni doubler un jour', () => {
    // Dernier dimanche de mars 2027 : le passage à l'heure d'été. En heure
    // locale, cette semaine ferait 6 ou 8 jours.
    expect(daysInWindow('2027-03-26', '2027-04-01')).toHaveLength(7)
  })
})

describe('weekdayHeaders', () => {
  it('part du lundi et couvre la semaine', () => {
    expect(weekdayHeaders).toHaveLength(7)
    expect(weekdayHeaders[0]?.long).toBe('lundi')
    expect(weekdayHeaders[6]?.long).toBe('dimanche')
  })
})

describe('buildCalendar', () => {
  it('aligne le premier jour sur sa colonne', () => {
    // Le 1er juillet 2027 est un jeudi : 4ᵉ colonne, donc trois cases vides
    // avant lui.
    const [month] = buildCalendar('2027-07-01', '2027-07-31')
    const firstWeek = month?.weeks[0]

    expect(firstWeek?.slice(0, 3)).toEqual([null, null, null])
    expect(firstWeek?.[3]).toBe('2027-07-01')
  })

  it('laisse vides les jours du mois hors fenêtre', () => {
    const [month] = buildCalendar('2027-07-15', '2027-07-20')

    // Le mois entier est découpé, mais seuls six jours sont peints.
    const days = month?.weeks.flat().filter((day) => day !== null)
    expect(days).toEqual([
      '2027-07-15',
      '2027-07-16',
      '2027-07-17',
      '2027-07-18',
      '2027-07-19',
      '2027-07-20',
    ])
  })

  it('découpe une fenêtre qui traverse plusieurs mois', () => {
    const months = buildCalendar('2027-06-20', '2027-08-05')

    expect(months.map((month) => month.key)).toEqual(['2027-06', '2027-07', '2027-08'])
    expect(months[0]?.label).toBe('juin 2027')
  })

  it('garde 7 colonnes à chaque semaine', () => {
    for (const month of buildCalendar('2027-01-01', '2027-12-31')) {
      for (const week of month.weeks) expect(week).toHaveLength(7)
    }
  })

  it('n’oublie pas le 29 février d’une année bissextile', () => {
    const [month] = buildCalendar('2028-02-01', '2028-02-29')
    const days = month?.weeks.flat().filter((day) => day !== null)

    expect(days).toHaveLength(29)
    expect(days?.at(-1)).toBe('2028-02-29')
  })

  it('renvoie vide sur une fenêtre à l’envers', () => {
    expect(buildCalendar('2027-07-10', '2027-07-01')).toEqual([])
  })
})

describe('formatDay', () => {
  it('nomme le jour en toutes lettres, en UTC', () => {
    expect(formatDay('2027-07-14')).toBe('mercredi 14 juillet')
  })
})

describe('formatRange', () => {
  it('n’écrit le mois qu’une fois quand les deux bornes le partagent', () => {
    expect(formatRange('2027-07-10', '2027-07-17')).toBe('sam. 10 → sam. 17 juillet')
  })

  it('nomme les deux mois à cheval', () => {
    expect(formatRange('2027-06-26', '2027-07-03')).toBe('sam. 26 juin → sam. 3 juillet')
  })

  it('ne plante pas sur une date illisible', () => {
    expect(formatRange('pas-une-date', '2027-07-17')).toBe('')
  })
})
