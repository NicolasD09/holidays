import type { Enums, Tables } from '@/types/database'

/**
 * Types métier dérivés du schéma (doc 04 §4.3).
 *
 * `database.ts` est généré et parle le langage des tables ; ce fichier parle
 * celui du produit. C'est ici qu'on nomme les formes que les RPC renvoient en
 * `json` — côté généré, elles ne sont typées que `Json`, ce qui ne protège
 * personne. Les fonctions des dossiers `api/` de chaque feature sont chargées
 * de valider ce qu'elles reçoivent avant de le présenter sous ces types.
 */

export type TripStatus = Enums<'trip_status'>
export type CategoryKind = Enums<'category_kind'>
export type CategoryStatus = Enums<'category_status'>
export type VoteMode = Enums<'vote_mode'>

export type Trip = Tables<'trips'>
export type Participant = Tables<'participants'>
export type Category = Tables<'categories'>
export type Option = Tables<'options'>
export type Vote = Tables<'votes'>

/**
 * Valeur d'un vote en mode approbation.
 * -1 « non » · 0 « peut-être » · 1 « oui » (doc 03 §3.4).
 */
export type ApprovalValue = -1 | 0 | 1

export const approvalValues = [1, 0, -1] as const satisfies readonly ApprovalValue[]

export function isApprovalValue(value: number): value is ApprovalValue {
  return value === -1 || value === 0 || value === 1
}

/** Retour de `app_create_trip`. */
export type CreatedTrip = {
  trip_id: string
  slug: string
  participant_id: string
  display_name: string
}

/** Retour de `app_join_trip`. */
export type JoinedTrip = {
  trip_id: string
  participant_id: string
  display_name: string
  is_organizer: boolean
  /** `false` quand l'appareil était déjà participant : l'adhésion est idempotente. */
  created: boolean
}

/** Une catégorie telle qu'exposée par l'aperçu, sans ses propositions. */
export type TripPreviewCategory = {
  id: string
  label: string
  kind: CategoryKind
}

/**
 * Retour de `app_trip_preview` : ce qu'on montre AVANT d'entrer son prénom.
 * Volontairement sans propositions ni votes (doc 03 §3.7).
 */
export type TripPreview = {
  trip_id: string
  slug: string
  title: string
  description: string | null
  cover_emoji: string | null
  status: TripStatus
  participant_count: number
  is_participant: boolean
  categories: TripPreviewCategory[]
}

/** Une ligne de `app_category_results`, déjà classée par score décroissant. */
export type OptionResult = {
  option_id: string
  title: string
  yes_count: number
  maybe_count: number
  no_count: number
  score: number
  voter_count: number
}

/** Catégorie enrichie de ses propositions, forme attendue par l'écran de vote. */
export type CategoryWithOptions = Category & {
  options: Option[]
}
