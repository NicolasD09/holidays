import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { castVote, retractVote, type MyVotes } from '@/features/voting/api/votes'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import type { ApprovalValue } from '@/types/domain'

export type VoteInput = {
  optionId: string
  /** `null` = retirer son vote (retap sur le bouton déjà sélectionné). */
  value: ApprovalValue | null
}

/**
 * Applique un vote à l'état local. Pure, donc testable sans réseau ni React :
 * c'est la seule pièce du vote optimiste qui peut se tromper en silence.
 */
export function patchVote(votes: MyVotes, { optionId, value }: VoteInput): MyVotes {
  const next = { ...votes }
  if (value === null) {
    delete next[optionId]
  } else {
    next[optionId] = value
  }
  return next
}

/**
 * Vote optimiste (patron imposé, doc 04 §4.5).
 *
 * L'écran ne doit jamais attendre le serveur : un tap se voit immédiatement,
 * et en cas d'échec l'état précédent revient avec un bouton Réessayer. C'est
 * la promesse « un tap = un vote enregistré » (doc 05 §5.1) — et son envers
 * honnête quand le réseau lâche.
 *
 * `onSettled` n'invalide que les résultats, jamais `myVotes` : ce cache porte
 * l'état optimiste, le réinvalider ferait clignoter le bouton qu'on vient de
 * taper.
 */
export function useVote(categoryId: string) {
  const queryClient = useQueryClient()
  const retry = useRef<(input: VoteInput) => void>(() => {})

  const mutation = useMutation({
    mutationFn: ({ optionId, value }: VoteInput) =>
      value === null ? retractVote(optionId) : castVote(optionId, value),

    onMutate: async (input: VoteInput) => {
      await queryClient.cancelQueries({ queryKey: qk.myVotes(categoryId) })
      const previous = queryClient.getQueryData<MyVotes>(qk.myVotes(categoryId))
      queryClient.setQueryData<MyVotes>(qk.myVotes(categoryId), (current) =>
        patchVote(current ?? {}, input),
      )
      return { previous }
    },

    onError: (_error, input, context) => {
      queryClient.setQueryData<MyVotes>(qk.myVotes(categoryId), context?.previous ?? {})
      toast.error(labels.error.voteFailed, {
        action: { label: labels.error.tryAgain, onClick: () => retry.current(input) },
      })
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.results(categoryId) })
    },
  })

  useEffect(() => {
    retry.current = mutation.mutate
  }, [mutation.mutate])

  return mutation
}
