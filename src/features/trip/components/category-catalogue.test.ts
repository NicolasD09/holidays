import { describe, expect, it } from 'vitest'
import {
  createDefaultSelection,
  toCategoryDrafts,
  validateDatesConfig,
  type CategorySelection,
} from '@/features/trip/components/category-catalogue'

/**
 * `toCategoryDrafts` décide de ce qui est réellement créé en base. Une erreur
 * ici se voit sur tous les écrans du sondage, et se répare par une migration
 * manuelle — d'où ces tests.
 */
describe('toCategoryDrafts', () => {
  it('crée la destination seule par défaut', () => {
    const drafts = toCategoryDrafts(createDefaultSelection())

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
      ...createDefaultSelection(),
      kinds: ['activity', 'destination', 'lodging'],
    }

    expect(toCategoryDrafts(selection).map((d) => d.kind)).toEqual([
      'destination',
      'lodging',
      'activity',
    ])
  })

  it('ignore les catégories dont l’écran n’existe pas encore', () => {
    // `amount` reste refusé par `app_create_trip` jusqu'au sprint 6 : la carte
    // budget est grisée, et rien ne doit la faire passer.
    const selection: CategorySelection = {
      ...createDefaultSelection(),
      kinds: ['destination', 'budget'],
    }

    expect(toCategoryDrafts(selection).map((d) => d.kind)).toEqual(['destination'])
  })

  it('envoie la fenêtre et les nuits avec la catégorie dates', () => {
    const selection: CategorySelection = {
      ...createDefaultSelection(),
      kinds: ['destination', 'dates'],
      dates: { windowStart: '2027-07-01', windowEnd: '2027-07-31', nights: '7' },
    }

    expect(toCategoryDrafts(selection).at(-1)).toEqual({
      kind: 'dates',
      label: 'Dates',
      vote_mode: 'availability',
      // On peint un calendrier, on ne propose pas de créneaux.
      allow_participant_options: false,
      window_start: '2027-07-01',
      window_end: '2027-07-31',
      nights: 7,
    })
  })

  it('ajoute la catégorie libre en dernier, avec son mode de vote', () => {
    const selection: CategorySelection = {
      ...createDefaultSelection(),
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
      ...createDefaultSelection(),
      kinds: ['destination'],
      custom: { enabled: true, label: '   ', voteMode: 'approval' },
    }

    expect(toCategoryDrafts(selection)).toHaveLength(1)
  })

  it('rogne les espaces autour du nom libre', () => {
    const selection: CategorySelection = {
      ...createDefaultSelection(),
      kinds: ['destination'],
      custom: { enabled: true, label: '  Soirée  ', voteMode: 'multiple' },
    }

    expect(toCategoryDrafts(selection).at(-1)?.label).toBe('Soirée')
  })

  it('ne renvoie jamais un tableau vide — app_create_trip le refuserait', () => {
    const selection: CategorySelection = {
      ...createDefaultSelection(),
      kinds: ['destination'],
      custom: { enabled: false, label: '', voteMode: 'approval' },
    }

    expect(toCategoryDrafts(selection).length).toBeGreaterThan(0)
  })
})

describe('validateDatesConfig', () => {
  const ok = { windowStart: '2027-07-01', windowEnd: '2027-07-31', nights: '7' }

  it('accepte une configuration cohérente', () => {
    expect(validateDatesConfig(ok)).toBeNull()
  })

  it('refuse une date illisible', () => {
    expect(validateDatesConfig({ ...ok, windowStart: '' })).toBe('invalid_date_window')
  })

  it('refuse une fenêtre inversée ou vide', () => {
    expect(validateDatesConfig({ ...ok, windowEnd: '2027-06-01' })).toBe('invalid_date_window')
    expect(validateDatesConfig({ ...ok, windowEnd: ok.windowStart })).toBe('invalid_date_window')
  })

  it('refuse au-delà de 400 jours — la contrainte de la table', () => {
    expect(validateDatesConfig({ ...ok, windowEnd: '2029-07-01' })).toBe('invalid_date_window')
  })

  it('refuse une durée hors bornes', () => {
    expect(validateDatesConfig({ ...ok, nights: '0' })).toBe('invalid_nights')
    expect(validateDatesConfig({ ...ok, nights: '61' })).toBe('invalid_nights')
    expect(validateDatesConfig({ ...ok, nights: '3,5' })).toBe('invalid_nights')
  })

  it('refuse un séjour plus long que la fenêtre', () => {
    expect(
      validateDatesConfig({ windowStart: '2027-07-01', windowEnd: '2027-07-05', nights: '7' }),
    ).toBe('window_too_short')
  })
})
