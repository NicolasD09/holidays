import { describe, expect, it } from 'vitest'
import { patchVote } from '@/features/voting/hooks/useVote'

/**
 * Le vote optimiste est la seule pièce de l'écran qui peut mentir : elle
 * affiche un résultat avant que le serveur l'ait confirmé. Sa fonction pure
 * est donc testée à part, sans React ni réseau.
 */
describe('patchVote', () => {
  it('pose un vote sur une proposition vierge', () => {
    expect(patchVote({}, { optionId: 'a', value: 1 })).toEqual({ a: 1 })
  })

  it('remplace un vote existant', () => {
    expect(patchVote({ a: 1 }, { optionId: 'a', value: -1 })).toEqual({ a: -1 })
  })

  it('retire le vote quand la valeur est nulle', () => {
    expect(patchVote({ a: 1, b: 0 }, { optionId: 'a', value: null })).toEqual({ b: 0 })
  })

  it('ne touche pas aux autres propositions', () => {
    const before = { a: 1, b: -1 } as const
    const after = patchVote(before, { optionId: 'c', value: 0 })

    expect(after).toEqual({ a: 1, b: -1, c: 0 })
    // L'état précédent doit rester intact : c'est lui qu'on restaure en cas
    // d'échec réseau.
    expect(before).toEqual({ a: 1, b: -1 })
  })
})
