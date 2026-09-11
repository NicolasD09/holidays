import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/routes'
import { qk } from '@/lib/queryKeys'

describe('cn', () => {
  it('concatène les classes', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('laisse la dernière classe Tailwind gagner', () => {
    expect(cn('px-2', 'px-5')).toBe('px-5')
  })

  it('ignore les valeurs falsy', () => {
    const absente = false
    expect(cn('a', absente && 'b', undefined, 'c')).toBe('a c')
  })
})

describe('routes', () => {
  it('construit les chemins d’un sondage', () => {
    expect(routes.trip('abc')).toBe('/t/abc')
    expect(routes.category('abc', 'cat1')).toBe('/t/abc/c/cat1')
    expect(routes.results('abc')).toBe('/t/abc/results')
  })
})

describe('queryKeys', () => {
  it('préfixe les clés d’une catégorie de façon stable', () => {
    expect(qk.results('cat1')).toEqual(['category', 'cat1', 'results'])
    expect(qk.myVotes('cat1')).toEqual(['category', 'cat1', 'my-votes'])
  })
})
