import { labels } from '@/lib/labels'
import type { CategoryKind, VoteMode } from '@/types/domain'

/**
 * Le catalogue des catégories proposées à la création, et la conversion de la
 * sélection en charge utile pour `app_create_trip`.
 *
 * Séparé des composants pour deux raisons : la règle
 * `react/only-export-components` interdit d'exporter autre chose qu'un
 * composant depuis un `.tsx`, et `toCategoryDrafts` est une fonction pure —
 * donc testable sans React ni réseau. C'est elle qui décide de ce qui part en
 * base ; autant qu'elle soit sous test.
 */

export type CategoryDraft = {
  kind: CategoryKind
  label: string
  vote_mode: VoteMode
  allow_participant_options: boolean
}

export type CatalogueEntry = {
  kind: CategoryKind
  emoji: string
  label: string
  /**
   * `false` tant que l'écran de vote correspondant n'existe pas. La carte
   * reste affichée, grisée : le plan du produit se voit, et rien ne part au
   * serveur — `app_create_trip` refuse `availability` et `amount` (doc 09).
   */
  available: boolean
  /** La destination ne se décoche pas : un sondage sans rien à décider n'existe pas. */
  locked?: boolean
}

/**
 * L'ordre de ce tableau est l'ordre des cartes à l'écran **et** la `position`
 * des catégories en base : le hub les affichera dans cet ordre.
 */
export const categoryCatalogue: CatalogueEntry[] = [
  {
    kind: 'destination',
    emoji: '🌍',
    label: labels.categories.destination,
    available: true,
    locked: true,
  },
  { kind: 'dates', emoji: '📅', label: labels.categories.dates, available: false },
  { kind: 'budget', emoji: '💶', label: labels.categories.budget, available: false },
  { kind: 'lodging', emoji: '🏠', label: labels.categories.lodging, available: true },
  { kind: 'activity', emoji: '🎿', label: labels.categories.activity, available: true },
]

/**
 * L'emoji d'une catégorie, d'après son type. Une catégorie libre n'est dans
 * aucun catalogue : elle prend un emoji neutre.
 */
export function categoryEmoji(kind: CategoryKind): string {
  return categoryCatalogue.find((entry) => entry.kind === kind)?.emoji ?? '🗳️'
}

/** Les modes de vote dont l'écran existe. `availability` et `amount` viendront. */
export const selectableVoteModes = ['approval', 'single', 'multiple'] as const

export type SelectableVoteMode = (typeof selectableVoteModes)[number]

export type CategorySelection = {
  /** Types standards cochés. La destination y est toujours. */
  kinds: CategoryKind[]
  custom: {
    enabled: boolean
    label: string
    voteMode: SelectableVoteMode
  }
}

export const defaultCategorySelection: CategorySelection = {
  kinds: ['destination'],
  custom: { enabled: false, label: '', voteMode: 'approval' },
}

/**
 * Sélection → charge utile de `app_create_trip`.
 *
 * Le mode par défaut est **l'approbation** partout : c'est le seul écran
 * éprouvé au sprint 2, et le seul qui laisse dire « peut-être ». Les modes
 * `single` et `multiple` se règlent ensuite par catégorie (tâche 2.5), ou
 * tout de suite pour une catégorie libre.
 */
export function toCategoryDrafts(selection: CategorySelection): CategoryDraft[] {
  const drafts: CategoryDraft[] = categoryCatalogue
    .filter((entry) => entry.available && selection.kinds.includes(entry.kind))
    .map((entry) => ({
      kind: entry.kind,
      label: entry.label,
      vote_mode: 'approval' as VoteMode,
      allow_participant_options: true,
    }))

  const customLabel = selection.custom.label.trim()
  if (selection.custom.enabled && customLabel) {
    drafts.push({
      kind: 'custom',
      label: customLabel,
      vote_mode: selection.custom.voteMode,
      allow_participant_options: true,
    })
  }

  return drafts
}
