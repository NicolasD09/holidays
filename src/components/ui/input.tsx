import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-11 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-base text-text',
        'placeholder:text-text-muted',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
