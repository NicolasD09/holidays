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

/**
 * Mode `single` : le déclencheur `votes_single_choice` retire le vote
 * précédent en base. L'état optimiste doit dire la même chose immédiatement,
 * sinon deux cartes restent allumées le temps d'un aller-retour.
 */
describe('patchVote en choix unique', () => {
  it('remplace le choix précédent au lieu de s’y ajouter', () => {
    expect(patchVote({ a: 1 }, { optionId: 'b', value: 1 }, true)).toEqual({ b: 1 })
  })

  it('n’en laisse aucun quand on retire son choix', () => {
    expect(patchVote({ a: 1 }, { optionId: 'a', value: null }, true)).toEqual({})
  })

  it('ne vide rien quand le mode n’est pas exclusif', () => {
    expect(patchVote({ a: 1 }, { optionId: 'b', value: 1 }, false)).toEqual({ a: 1, b: 1 })
  })

  it('laisse l’état précédent intact — c’est lui qu’on restaure en cas d’échec', () => {
    const before = { a: 1 } as const
    patchVote(before, { optionId: 'b', value: 1 }, true)

    expect(before).toEqual({ a: 1 })
  })
})
