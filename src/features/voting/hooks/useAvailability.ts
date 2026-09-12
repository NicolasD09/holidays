import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { setAvailability, type AvailabilityDraft } from '@/features/voting/api/availabilities'
import { applyDrafts } from '@/features/voting/components/availability-brush'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import type { AvailabilityEntry } from '@/lib/scoring'

/**
 * Peinture optimiste des disponibilités (patron imposé, doc 04 §4.5).
 *
 * Le pendant de `useVote` pour la catégorie dates, avec trois différences qui
 * tiennent toutes à la nature du geste :
 *
 * 1. **Un lot, pas une valeur.** Un glissement produit une liste de jours ; on
 *    l'applique et on l'annule en bloc. C'est cohérent avec le serveur, qui
 *    refuse le lot entier si un seul jour sort de la fenêtre (doc 13).
 * 2. **`onSettled` n'invalide pas les disponibilités.** Même raison que pour
 *    `myVotes` : ce cache porte l'état optimiste, le réinvalider ferait
 *    clignoter les cases qu'on vient de peindre. Les dispos des autres
 *    arrivent au rafraîchissement, jusqu'au temps réel du sprint 8.
 * 3. **La progression du sondage est invalidée.** Depuis le sprint 5, une
 *    catégorie dates compte comme traitée dès un jour peint : sans ça, le hub
 *    afficherait encore « À voter » pendant le `staleTime` (doc 14 §14.2).
 */
export function useAvailability(categoryId: string, tripId: string, participantId: string) {
  const queryClient = useQueryClient()
  const retry = useRef<(drafts: AvailabilityDraft[]) => void>(() => {})

  const mutation = useMutation({
    mutationFn: (drafts: AvailabilityDraft[]) => setAvailability(categoryId, drafts),

    onMutate: async (drafts: AvailabilityDraft[]) => {
      await queryClient.cancelQueries({ queryKey: qk.availabilities(categoryId) })
      const previous = queryClient.getQueryData<AvailabilityEntry[]>(
        qk.availabilities(categoryId),
      )
      queryClient.setQueryData<AvailabilityEntry[]>(
        qk.availabilities(categoryId),
        (current) => applyDrafts(current ?? [], drafts, participantId),
      )
      return { previous }
    },

    onError: (_error, drafts, context) => {
      // Le lot revient entier : on ne laisse pas un glissement à moitié peint,
      // qui laisserait croire que la moitié a été enregistrée.
      queryClient.setQueryData<AvailabilityEntry[]>(
        qk.availabilities(categoryId),
        context?.previous ?? [],
      )
      toast.error(labels.availability.failed, {
        action: { label: labels.error.tryAgain, onClick: () => retry.current(drafts) },
      })
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.progress(tripId) })
    },
  })

  useEffect(() => {
    retry.current = mutation.mutate
  }, [mutation.mutate])

  return mutation
}
