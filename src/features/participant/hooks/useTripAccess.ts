import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentParticipant } from '@/features/participant/api/currentParticipant'
import { joinTrip } from '@/features/participant/api/joinTrip'
import { fetchTripPreview } from '@/features/participant/api/tripPreview'
import { listCategories } from '@/features/trip/api/listCategories'
import { qk } from '@/lib/queryKeys'

/**
 * Tout ce qu'il faut savoir pour ouvrir `/t/:slug` : le sondage existe-t-il,
 * cet appareil y participe-t-il, et si oui, sous quelle identité.
 *
 * L'ordre compte. L'aperçu part **sans session** : il doit s'afficher pour
 * quelqu'un qui n'a encore rien signé. Les deux lectures suivantes ne partent
 * qu'une fois l'adhésion établie, sinon la RLS les renverrait vides — ce qui
 * ressemblerait à un bug alors que c'est la règle.
 */
export function useTripAccess(slug: string) {
  const preview = useQuery({
    queryKey: qk.tripPreview(slug),
    queryFn: () => fetchTripPreview(slug),
    // Un lien invalide n'est pas une panne réseau : le retenter ne ferait
    // qu'allonger l'attente avant d'afficher la page « lien invalide ».
    retry: false,
  })

  const tripId = preview.data?.trip_id ?? null
  const isParticipant = preview.data?.is_participant ?? false

  const participant = useQuery({
    queryKey: qk.me(tripId ?? 'inconnu'),
    queryFn: () => (tripId ? fetchCurrentParticipant(tripId) : Promise.resolve(null)),
    enabled: Boolean(tripId) && isParticipant,
  })

  const categories = useQuery({
    queryKey: qk.categories(tripId ?? 'inconnu'),
    queryFn: () => (tripId ? listCategories(tripId) : Promise.resolve([])),
    enabled: Boolean(tripId) && isParticipant,
  })

  return { preview, participant, categories, isParticipant }
}

/** Adhésion par prénom. Idempotente côté serveur. */
export function useJoinTrip(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (displayName: string) => joinTrip(slug, displayName),
    onSuccess: async () => {
      // L'aperçu porte `is_participant` : c'est lui qui fait tomber le
      // JoinGate. Tout le reste en découle.
      await queryClient.invalidateQueries({ queryKey: qk.tripPreview(slug) })
    },
  })
}
