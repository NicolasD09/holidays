import { cva } from 'class-variance-authority'

/**
 * Variantes du bouton, isolées du composant pour que `button.tsx` n'exporte
 * que des composants (contrainte du rafraîchissement à chaud).
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-base font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-fg hover:bg-brand-hover',
        secondary: 'bg-surface-2 text-text hover:bg-border',
        outline: 'border border-border-strong bg-transparent text-text hover:bg-surface-2',
        ghost: 'bg-transparent text-text hover:bg-surface-2',
        link: 'bg-transparent text-brand underline-offset-4 hover:underline',
      },
      size: {
        // 44px minimum : cible tactile (doc 05 §5.2)
        default: 'h-11 px-5 py-2',
        lg: 'h-13 px-6 text-lg',
        icon: 'size-11',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)
