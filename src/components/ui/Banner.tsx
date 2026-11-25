import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Layers, PauseCircle, X, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Tone } from '../../lib/types'

const styles: Record<Tone, { box: string; icon: LucideIcon; iconColor: string }> = {
  danger: { box: 'bg-danger-bg border-danger-border', icon: XCircle, iconColor: 'text-danger-fg' },
  warning: { box: 'bg-warning-bg border-warning-border', icon: AlertTriangle, iconColor: 'text-warning-fg' },
  success: { box: 'bg-success-bg border-success-border', icon: CheckCircle2, iconColor: 'text-success-fg' },
  stack: { box: 'bg-stack-bg border-stack-border', icon: Layers, iconColor: 'text-stack-fg' },
  neutral: { box: 'bg-neutral-bg border-neutral-border', icon: PauseCircle, iconColor: 'text-neutral-fg' },
  info: { box: 'bg-denim-50 border-denim-200', icon: Info, iconColor: 'text-denim' },
}

interface BannerProps {
  tone: Tone
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  icon?: LucideIcon
  onDismiss?: () => void
  className?: string
  /** role="alert" untuk error yang harus segera diumumkan. */
  assertive?: boolean
}

export function Banner({ tone, title, children, actions, icon, onDismiss, className, assertive }: BannerProps) {
  const s = styles[tone]
  const Icon = icon ?? s.icon
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-card border p-4 text-charcoal', s.box, className)}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', s.iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-caption-lg text-charcoal/85">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-white/60 hover:text-charcoal focus-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
