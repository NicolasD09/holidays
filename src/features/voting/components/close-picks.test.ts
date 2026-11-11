import { describe, expect, it } from 'vitest'
import {
  optionPicks,
  suggestedPick,
  tallyFor,
  windowPicks,
  WINDOW_PICKS,
} from '@/features/voting/components/close-picks'
import type { WindowScore } from '@/lib/scoring'
import type { Option, OptionResult } from '@/types/domain'

function option(id: string, title: string): Option {
  return {
    id,
    trip_id: 'trip',
    category_id: 'c1',
    title,
    description: null,
    url: null,
    image_url: null,
    meta: {},
    created_by: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function result(optionId: string, score: number, yes = 0): OptionResult {
  return {
    option_id: optionId,
    title: optionId,
    yes_count: yes,
    maybe_count: 0,
    no_count: 0,
    score,
    voter_count: yes,
  }
}

const options = [option('o1', 'Lisbonne'), option('o2', 'Porto'), option('o3', 'Séville')]

describe('optionPicks', () => {
  it('classe par score quand les scores sont visibles', () => {
    const picks = optionPicks(options, [result('o2', 6, 3), result('o1', 2, 1)], 'approval')
    expect(picks.map((pick) => pick.label)).toEqual(['Porto', 'Lisbonne', 'Séville'])
    expect(picks.map((pick) => pick.score)).toEqual([6, 2, 0])
  })

  it('garde l’ordre d’ajout en mode aveugle, sans score', () => {
    const picks = optionPicks(options, null, 'approval')
    expect(picks.map((pick) => pick.label)).toEqual(['Lisbonne', 'Porto', 'Séville'])
    expect(picks.every((pick) => pick.score === null && pick.detail === null)).toBe(true)
  })

  it('porte un choix de proposition prêt à envoyer', () => {
    const [first] = optionPicks(options, null, 'approval')
    expect(first?.choice).toEqual({ kind: 'option', optionId: 'o1' })
  })
})

describe('suggestedPick — la tête de liste pré-sélectionnée', () => {
  it('suggère la première quand elle mène vraiment', () => {
    const picks = optionPicks(options, [result('o2', 6, 3)], 'approval')
    expect(suggestedPick(picks)?.label).toBe('Porto')
  })

  it('ne suggère rien quand personne n’a rien approuvé', () => {
    const picks = optionPicks(options, [result('o1', 0)], 'approval')
    expect(suggestedPick(picks)).toBeNull()
  })

  it('ne suggère rien sans scores visibles — ce serait suggérer au hasard', () => {
    expect(suggestedPick(optionPicks(options, null, 'approval'))).toBeNull()
  })

  it('ne suggère rien dans une liste vide', () => {
    expect(suggestedPick([])).toBeNull()
  })
})

describe('windowPicks', () => {
  const slot = (start: string, end: string, score: number): WindowScore => ({
    start,
    end,
    score,
    fullyAvailable: score > 0 ? ['a'] : [],
    tentative: [],
    blocked: [],
  })

  it('propose au plus les cinq meilleurs créneaux, dans l’ordre du classement', () => {
    const slots = Array.from({ length: 8 }, (_, index) =>
      slot(`2027-07-${String(index + 1).padStart(2, '0')}`, `2027-07-${index + 8}`, 8 - index),
    )
    const picks = windowPicks(slots)
    expect(picks).toHaveLength(WINDOW_PICKS)
    expect(picks[0]?.choice).toEqual({ kind: 'range', start: '2027-07-01', end: '2027-07-8' })
  })
})

describe('tallyFor', () => {
  it('parle en oui / peut-être / non en approbation', () => {
    expect(tallyFor('approval', { ...result('o1', 5, 2), maybe_count: 1 })).toBe('2 oui · 1 ~ · 0 non')
  })

  it('parle en voix en choix unique ou multiple', () => {
    expect(tallyFor('single', result('o1', 6, 3))).toBe('3 voix')
    expect(tallyFor('multiple', result('o1', 2, 1))).toBe('1 voix')
  })
})
