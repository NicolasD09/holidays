import { describe, expect, it } from 'vitest'
import {
  defaultCategorySelection,
  toCategoryDrafts,
  type CategorySelection,
} from '@/features/trip/components/category-catalogue'

/**
 * `toCategoryDrafts` décide de ce qui est réellement créé en base. Une erreur
 * ici se voit sur tous les écrans du sondage, et se répare par une migration
 * manuelle — d'où ces tests.
 */
describe('toCategoryDrafts', () => {
  it('crée la destination seule par défaut', () => {
    const drafts = toCategoryDrafts(defaultCategorySelection)

    expect(drafts).toEqual([
      {
        kind: 'destination',
        label: 'Destination',
        vote_mode: 'approval',
        allow_participant_options: true,
      },
    ])
  })

  it('suit l’ordre du catalogue, pas l’ordre où l’on a coché', () => {
    const selection: CategorySelection = {
      ...defaultCategorySelection,
      kinds: ['activity', 'destination', 'lodging'],
    }

    expect(toCategoryDrafts(selection).map((d) => d.kind)).toEqual([
      'destination',
      'lodging',
      'activity',
    ])
  })

  it('ignore les catégories dont l’écran n’existe pas encore', () => {
    // `app_create_trip` refuse `availability` et `amount` (doc 09) : ces deux
    // cartes sont grisées à l'écran, et rien ne doit les faire passer.
    const selection: CategorySelection = {
      ...defaultCategorySelection,
      kinds: ['destination', 'dates', 'budget'],
    }

    expect(toCategoryDrafts(selection).map((d) => d.kind)).toEqual(['destination'])
  })

  it('ajoute la catégorie libre en dernier, avec son mode de vote', () => {
    const selection: CategorySelection = {
      kinds: ['destination'],
      custom: { enabled: true, label: 'Restaurant', voteMode: 'single' },
    }

    expect(toCategoryDrafts(selection)).toEqual([
      {
        kind: 'destination',
        label: 'Destination',
        vote_mode: 'approval',
        allow_participant_options: true,
      },
      {
        kind: 'custom',
        label: 'Restaurant',
        vote_mode: 'single',
        allow_participant_options: true,
      },
    ])
  })

  it('ne crée pas de catégorie libre sans nom', () => {
    const selection: CategorySelection = {
      kinds: ['destination'],
      custom: { enabled: true, label: '   ', voteMode: 'approval' },
    }

    expect(toCategoryDrafts(selection)).toHaveLength(1)
  })

  it('rogne les espaces autour du nom libre', () => {
    const selection: CategorySelection = {
      kinds: ['destination'],
      custom: { enabled: true, label: '  Soirée  ', voteMode: 'multiple' },
    }

    expect(toCategoryDrafts(selection).at(-1)?.label).toBe('Soirée')
  })

  it('ne renvoie jamais un tableau vide — app_create_trip le refuserait', () => {
    const selection: CategorySelection = {
      kinds: ['destination'],
      custom: { enabled: false, label: '', voteMode: 'approval' },
    }

    expect(toCategoryDrafts(selection).length).toBeGreaterThan(0)
  })
})
