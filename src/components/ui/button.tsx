import { Slot } from '@radix-ui/react-slot'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}
