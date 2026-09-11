import { labels } from '@/lib/labels'
import type { ApprovalValue } from '@/types/domain'

/**
 * Habillage des trois choix d'approbation, isolé du composant pour que
 * `ApprovalButtons.tsx` n'exporte que des composants (contrainte du
 * rafraîchissement à chaud) — même raison que `button-variants.ts`.
 *
 * Chaque choix porte une icône **et** un libellé : le sens n'est jamais porté
 * par la seule couleur (doc 05 §5.2).
 */
export const approvalChoices: Record<
  ApprovalValue,
  { label: string; icon: string; className: string }
> = {
  1: { label: labels.voting.yes, icon: '✓', className: 'bg-yes text-vote-fg border-yes' },
  0: {
    label: labels.voting.maybe,
    icon: '~',
    className: 'bg-maybe text-vote-fg border-maybe',
  },
  [-1]: { label: labels.voting.no, icon: '✕', className: 'bg-no text-vote-fg border-no' },
}

export function approvalLabel(value: ApprovalValue): string {
  return approvalChoices[value].label
}
