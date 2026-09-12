import { describe, expect, it } from 'vitest'
import {
  applyDrafts,
  applyStroke,
  densityByDay,
  paintedDaysOf,
  strokeToDrafts,
  type PaintedDays,
} from '@/features/voting/components/availability-brush'
import type { AvailabilityEntry } from '@/lib/scoring'

/**
 * La peinture est la pièce du sprint 5 qui peut se tromper **en silence** : un
 * coup de pinceau mal appliqué ne lève aucune erreur, il enregistre simplement
 * autre chose que ce que le doigt a dessiné. Même raison d'être que les tests
 * de `patchVote` pour le vote.
 */

const entries: AvailabilityEntry[] = [
  { participantId: 'me', day: '2027-07-10', status: 'yes' },
  { participantId: 'me', day: '2027-07-11', status: 'no' },
  { participantId: 'p2', day: '2027-07-10', status: 'yes' },
  { participantId: 'p3', day: '2027-07-10', status: 'maybe' },
]

describe('paintedDaysOf', () => {
  it('ne retient que mes jours', () => {
    expect(paintedDaysOf(entries, 'me')).toEqual({
      '2027-07-10': 'yes',
      '2027-07-11': 'no',
    })
  })

  it('renvoie un objet vide pour qui n’a rien peint', () => {
    expect(paintedDaysOf(entries, 'inconnu')).toEqual({})
  })
})

describe('densityByDay', () => {
  it('compte le groupe entier, moi compris', () => {
    expect(densityByDay(entries).get('2027-07-10')).toEqual({ yes: 2, maybe: 1, no: 0 })
  })

  it('ne connaît pas les jours que personne n’a peints', () => {
    expect(densityByDay(entries).get('2027-07-12')).toBeUndefined()
  })
})

describe('applyStroke', () => {
  const days: PaintedDays = { '2027-07-10': 'yes' }

  it('remplace, ne cumule pas — c’est ce qu’un pinceau fait', () => {
    expect(applyStroke(days, ['2027-07-10'], 'no')).toEqual({ '2027-07-10': 'no' })
  })

  it('efface avec la gomme', () => {
    expect(applyStroke(days, ['2027-07-10'], 'erase')).toEqual({})
  })

  it('peint plusieurs jours d’un geste', () => {
    expect(applyStroke({}, ['2027-07-10', '2027-07-11'], 'maybe')).toEqual({
      '2027-07-10': 'maybe',
      '2027-07-11': 'maybe',
    })
  })

  it('ne modifie pas l’objet d’origine', () => {
    applyStroke(days, ['2027-07-10'], 'no')
    expect(days).toEqual({ '2027-07-10': 'yes' })
  })
})

describe('strokeToDrafts', () => {
  const days: PaintedDays = { '2027-07-10': 'yes' }

  it('n’envoie que ce qui change vraiment', () => {
    // Repasser le doigt sur un jour déjà « dispo » ne doit produire aucune
    // écriture : sur un glissement qui revient sur ses pas, ça divise le lot.
    expect(strokeToDrafts(days, ['2027-07-10'], 'yes')).toEqual([])
  })

  it('traduit la gomme en statut nul', () => {
    expect(strokeToDrafts(days, ['2027-07-10'], 'erase')).toEqual([
      { day: '2027-07-10', status: null },
    ])
  })

  it('n’efface pas un jour déjà vide', () => {
    expect(strokeToDrafts(days, ['2027-07-99'], 'erase')).toEqual([])
  })

  it('ne compte qu’une fois un jour repassé plusieurs fois', () => {
    const stroke = ['2027-07-11', '2027-07-12', '2027-07-11']

    expect(strokeToDrafts(days, stroke, 'no')).toEqual([
      { day: '2027-07-11', status: 'no' },
      { day: '2027-07-12', status: 'no' },
    ])
  })
})

describe('applyDrafts', () => {
  it('remplace mes jours sans toucher à ceux des autres', () => {
    const next = applyDrafts(entries, [{ day: '2027-07-10', status: 'no' }], 'me')

    expect(next).toContainEqual({ participantId: 'me', day: '2027-07-10', status: 'no' })
    // La même date chez p2 et p3 doit survivre intacte : c'est exactement ce
    // qu'un filtre trop large casserait.
    expect(next).toContainEqual({ participantId: 'p2', day: '2027-07-10', status: 'yes' })
    expect(next).toContainEqual({ participantId: 'p3', day: '2027-07-10', status: 'maybe' })
  })

  it('retire la ligne quand le statut est nul', () => {
    const next = applyDrafts(entries, [{ day: '2027-07-10', status: null }], 'me')

    expect(next.filter((row) => row.participantId === 'me')).toEqual([
      { participantId: 'me', day: '2027-07-11', status: 'no' },
    ])
  })

  it('ajoute un jour que je n’avais pas encore peint', () => {
    const next = applyDrafts(entries, [{ day: '2027-07-20', status: 'yes' }], 'me')

    expect(next).toContainEqual({ participantId: 'me', day: '2027-07-20', status: 'yes' })
    expect(next).toHaveLength(entries.length + 1)
  })

  it('tient debout sur un lot vide', () => {
    expect(applyDrafts(entries, [], 'me')).toHaveLength(entries.length)
  })
})
