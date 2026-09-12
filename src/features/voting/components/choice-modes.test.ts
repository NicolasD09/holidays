import { describe, expect, it } from 'vitest'
import { isChoiceMode, remainingChoices } from '@/features/voting/components/choice-modes'

describe('isChoiceMode', () => {
  it('reconnaît les deux modes où l’on retient sans nuancer', () => {
    expect(isChoiceMode('single')).toBe(true)
    expect(isChoiceMode('multiple')).toBe(true)
  })

  it('laisse l’approbation de côté', () => {
    expect(isChoiceMode('approval')).toBe(false)
  })
})

describe('remainingChoices', () => {
  it('ne plafonne rien hors du mode multiple', () => {
    expect(remainingChoices('approval', 2, 5)).toBeNull()
    expect(remainingChoices('single', 2, 5)).toBeNull()
  })

  it('ne plafonne rien sans max_choices', () => {
    expect(remainingChoices('multiple', null, 5)).toBeNull()
  })

  it('décompte les choix restants', () => {
    expect(remainingChoices('multiple', 3, 1)).toBe(2)
    expect(remainingChoices('multiple', 3, 3)).toBe(0)
  })

  it('ne descend jamais sous zéro, même si la base en contient plus', () => {
    // Le plafond peut avoir été abaissé après coup par l'organisateur : les
    // votes existants restent, et l'écran ne doit pas afficher « -2 choix ».
    expect(remainingChoices('multiple', 2, 4)).toBe(0)
  })

  it('distingue « plus aucun choix » de « pas de plafond »', () => {
    expect(remainingChoices('multiple', 2, 2)).toBe(0)
    expect(remainingChoices('multiple', null, 2)).toBeNull()
  })
})
