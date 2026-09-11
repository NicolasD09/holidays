import { useOutletContext } from 'react-router'
import type { Category, Participant, TripPreview } from '@/types/domain'

/**
 * Contexte du sondage courant, fourni par `TripLayout` (doc 04 §4.4).
 *
 * Il n'existe que sous la garde : y accéder, c'est déjà être participant. Les
 * écrans enfants n'ont donc ni à revérifier l'adhésion, ni à gérer le cas
 * « pas encore rejoint » — un seul endroit le fait, et c'est le layout.
 *
 * Séparé du composant pour que `TripLayout.tsx` n'exporte que des composants
 * (contrainte du rafraîchissement à chaud).
 */
export type TripContext = {
  slug: string
  preview: TripPreview
  participant: Participant
  categories: Category[]
}

export function useTripContext(): TripContext {
  return useOutletContext<TripContext>()
}
