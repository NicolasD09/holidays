import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Conteneur de page : colonne unique sur mobile, centré et borné au-delà. */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6', className)}>
      {children}
    </div>
  )
}
