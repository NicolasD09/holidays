import { describe, expect, it } from 'vitest'
import { comfortableStep, followersAt, formatEuros, parseAmount } from '@/lib/budget'

const curve = [
  { amount: 700, followers: 3 },
  { amount: 750, followers: 2 },
  { amount: 800, followers: 2 },
  { amount: 850, followers: 1 },
  { amount: 900, followers: 0 },
]

describe('formatEuros', () => {
  it('écrit un montant à la française, sans centimes', () => {
    // `Intl` sépare les milliers par une espace fine insécable.
    expect(formatEuros(1200).replace(/\s/g, ' ')).toBe('1 200 €')
    expect(formatEuros(0).replace(/\s/g, ' ')).toBe('0 €')
  })
})

describe('parseAmount', () => {
  it('lit un entier', () => {
    expect(parseAmount('750')).toBe(750)
    expect(parseAmount('0')).toBe(0)
  })

  it('tolère espaces, espaces insécables et symbole euro', () => {
    expect(parseAmount(' 1 200 € ')).toBe(1200)
    expect(parseAmount('1 200')).toBe(1200)
    expect(parseAmount('1 200€')).toBe(1200)
  })

  it('refuse le vide, le texte et les négatifs', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('beaucoup')).toBeNull()
    expect(parseAmount('-50')).toBeNull()
  })

  it('refuse les décimales plutôt que de les arrondir', () => {
    expect(parseAmount('750,50')).toBeNull()
    expect(parseAmount('750.5')).toBeNull()
  })

  it('respecte le plafond de la table', () => {
    expect(parseAmount('1000000')).toBe(1_000_000)
    expect(parseAmount('1000001')).toBeNull()
  })
})

describe('followersAt', () => {
  it('lit la valeur exacte sur un palier', () => {
    expect(followersAt(curve, 700)).toBe(3)
    expect(followersAt(curve, 850)).toBe(1)
  })

  it('sous le premier palier, tout le monde suit', () => {
    expect(followersAt(curve, 100)).toBe(3)
  })

  it('entre deux paliers, prend celui du dessus — jamais de sur-compte', () => {
    expect(followersAt(curve, 701)).toBe(2)
    expect(followersAt(curve, 849)).toBe(1)
  })

  it('au-delà du dernier palier, plus personne', () => {
    expect(followersAt(curve, 5000)).toBe(0)
  })

  it('ne plante pas sur une courbe vide', () => {
    expect(followersAt([], 500)).toBe(0)
  })
})

describe('comfortableStep', () => {
  it('donne le plus haut palier que tout le monde suit', () => {
    expect(comfortableStep(curve, 3)).toBe(700)
  })

  it('remonte tant que personne ne décroche', () => {
    const flat = [
      { amount: 500, followers: 4 },
      { amount: 550, followers: 4 },
      { amount: 600, followers: 3 },
    ]
    expect(comfortableStep(flat, 4)).toBe(550)
  })

  it('renvoie null si aucun palier ne convient à tous', () => {
    expect(comfortableStep(curve, 4)).toBeNull()
    expect(comfortableStep([], 3)).toBeNull()
  })
})
