import { describe, expect, it } from 'vitest'
import {
  describeDecision,
  isCompleteChoice,
  summaryLine,
  SUMMARY_ITEM_MAX,
  toCloseArgs,
  truncate,
} from '@/lib/decisions'
import type { Category, Decision } from '@/types/domain'

function decision(overrides: Partial<Decision>): Decision {
  return {
    categoryId: 'c1',
    optionId: null,
    title: null,
    range: null,
    amount: null,
    freeText: null,
    decidedAt: '2026-11-11T12:00:00Z',
    ...overrides,
  }
}

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    trip_id: 'trip',
    kind: 'destination',
    label: id,
    description: null,
    vote_mode: 'approval',
    status: 'closed',
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

const emoji = (item: Category) =>
  ({ destination: '🌍', dates: '📅', budget: '💶' })[item.kind as string] ?? '🗳️'

describe('describeDecision', () => {
  it('dit le titre recopié d’une proposition', () => {
    expect(describeDecision(decision({ optionId: 'o1', title: 'Lisbonne' }))).toBe('Lisbonne')
  })

  it('formate un créneau comme le classement', () => {
    expect(describeDecision(decision({ range: { start: '2027-07-10', end: '2027-07-17' } }))).toBe(
      'sam. 10 → sam. 17 juillet',
    )
  })

  it('donne un budget en ordre de grandeur, avec un « ~ »', () => {
    expect(describeDecision(decision({ amount: 750 }))).toMatch(/^~750\s€$/)
  })

  it('préfère le texte libre à tout le reste', () => {
    expect(describeDecision(decision({ title: 'Lisbonne', freeText: 'On verra' }))).toBe(
      'On verra',
    )
  })
})

describe('summaryLine — le bandeau du récap', () => {
  const categories = [
    category('dest', { kind: 'destination' }),
    category('dates', { kind: 'dates', vote_mode: 'availability' }),
    category('budget', { kind: 'budget', vote_mode: 'amount' }),
  ]
  const decisions = [
    // Dans le désordre : c'est l'ordre du sondage qui compte.
    decision({ categoryId: 'budget', amount: 750 }),
    decision({ categoryId: 'dest', title: 'Lisbonne' }),
    decision({ categoryId: 'dates', range: { start: '2027-07-10', end: '2027-07-17' } }),
  ]

  it('suit l’ordre du sondage, une décision par catégorie, emoji en tête', () => {
    expect(summaryLine(categories, decisions, emoji)).toMatch(
      /^🌍 Lisbonne · 📅 10–17 juil\. · 💶 ~750\s€$/,
    )
  })

  it('tient en une ligne : aucun retour à la ligne, même dans un texte libre', () => {
    const line = summaryLine(
      [category('dest')],
      [decision({ categoryId: 'dest', freeText: 'On part\nen voiture' })],
      emoji,
    )
    expect(line).not.toContain('\n')
    expect(line).toBe('🌍 On part en voiture')
  })

  it('coupe un texte libre trop long', () => {
    const line = summaryLine(
      [category('dest')],
      [decision({ categoryId: 'dest', freeText: 'x'.repeat(200) })],
      emoji,
    )
    expect(line.length).toBeLessThanOrEqual(SUMMARY_ITEM_MAX + 3)
    expect(line.endsWith('…')).toBe(true)
  })

  it('ignore une catégorie rouverte, même si une décision traîne encore en cache', () => {
    const reopened = [category('dest', { status: 'open' }), ...categories.slice(1)]
    expect(summaryLine(reopened, decisions, emoji)).not.toContain('Lisbonne')
  })

  it('est vide quand rien n’est tranché', () => {
    expect(summaryLine(categories, [], emoji)).toBe('')
  })
})

describe('truncate', () => {
  it('laisse passer un texte court, espaces normalisés', () => {
    expect(truncate('  Lisbonne   centre ', 32)).toBe('Lisbonne centre')
  })

  it('coupe pile à la longueur demandée, points de suspension compris', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…')
  })
})

describe('toCloseArgs — un seul argument de décision à la fois', () => {
  it('envoie une proposition sans texte ni payload', () => {
    expect(toCloseArgs('c1', { kind: 'option', optionId: 'o1' })).toEqual({
      p_category: 'c1',
      p_option: 'o1',
    })
  })

  it('envoie un créneau dans le payload', () => {
    expect(toCloseArgs('c1', { kind: 'range', start: '2027-07-10', end: '2027-07-17' })).toEqual({
      p_category: 'c1',
      p_payload: { start: '2027-07-10', end: '2027-07-17' },
    })
  })

  it('envoie un montant dans le payload', () => {
    expect(toCloseArgs('c1', { kind: 'amount', amount: 750 })).toEqual({
      p_category: 'c1',
      p_payload: { amount: 750 },
    })
  })

  it('envoie un texte rogné', () => {
    expect(toCloseArgs('c1', { kind: 'text', text: '  Ailleurs  ' })).toEqual({
      p_category: 'c1',
      p_free_text: 'Ailleurs',
    })
  })
})

describe('isCompleteChoice', () => {
  it('refuse l’absence de choix et un texte vide', () => {
    expect(isCompleteChoice(null)).toBe(false)
    expect(isCompleteChoice({ kind: 'text', text: '   ' })).toBe(false)
  })

  it('refuse un texte au-delà de ce que la base accepte', () => {
    expect(isCompleteChoice({ kind: 'text', text: 'x'.repeat(201) })).toBe(false)
    expect(isCompleteChoice({ kind: 'text', text: 'x'.repeat(200) })).toBe(true)
  })

  it('refuse un montant hors bornes ou décimal', () => {
    expect(isCompleteChoice({ kind: 'amount', amount: -1 })).toBe(false)
    expect(isCompleteChoice({ kind: 'amount', amount: 12.5 })).toBe(false)
    expect(isCompleteChoice({ kind: 'amount', amount: 0 })).toBe(true)
  })

  it('accepte une proposition ou un créneau tels quels', () => {
    expect(isCompleteChoice({ kind: 'option', optionId: 'o1' })).toBe(true)
    expect(isCompleteChoice({ kind: 'range', start: '2027-07-10', end: '2027-07-17' })).toBe(true)
  })
})
