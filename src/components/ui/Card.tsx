import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-border bg-white p-4 shadow-card sm:p-6', className)}
      {...rest}
    />
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Level heading; default h2. */
  as?: 'h2' | 'h3'
  className?: string
  id?: string
}

export function CardHeader({ title, description, action, as: H = 'h2', className, id }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <H id={id} className="text-section-title text-charcoal">
          {title}
        </H>
        {description && <p className="mt-1 text-caption-lg text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
