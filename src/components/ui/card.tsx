import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-border bg-surface-2 p-4',
        className,
      )}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-lg font-semibold text-text', className)} {...props} />
  )
}

export function CardBody({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-text-muted', className)} {...props} />
}
