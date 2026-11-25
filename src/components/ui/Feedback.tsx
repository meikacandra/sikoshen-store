import type { ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

/* ---------- ProgressBar ---------- */

export function ProgressBar({
  value,
  label,
  showValue = true,
  tone = 'denim',
  className,
}: {
  value: number
  label: string
  showValue?: boolean
  tone?: 'denim' | 'danger' | 'success'
  className?: string
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const fill = tone === 'danger' ? 'bg-danger-fg' : tone === 'success' ? 'bg-success-fg' : 'bg-denim'
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-caption-lg">
        <span className="font-medium text-charcoal">{label}</span>
        {showValue && <span className="tabular text-muted" aria-hidden="true">{v}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-valuetext={`${v}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-300 ease-out', fill)} style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

/* ---------- Stepper ---------- */

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <nav aria-label="Tahapan" className={className}>
      <ol className="flex items-start gap-1 sm:gap-2">
        {steps.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:items-center" aria-current={active ? 'step' : undefined}>
              <span
                className={cn(
                  'tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-caption-lg font-bold transition-colors',
                  done && 'border-denim bg-denim text-white',
                  active && 'border-denim bg-denim-50 text-denim',
                  !done && !active && 'border-border-strong bg-white text-muted',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-center text-[11px] leading-4 sm:text-left sm:text-caption-lg',
                  active ? 'font-semibold text-charcoal' : 'text-muted',
                  !active && 'hidden sm:inline',
                )}
              >
                {s}
                <span className="sr-only">{done ? ' (selesai)' : active ? ' (sedang berjalan)' : ''}</span>
              </span>
              {i < steps.length - 1 && <span aria-hidden="true" className={cn('hidden h-px flex-1 sm:block', done ? 'bg-denim' : 'bg-border')} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative overflow-hidden rounded-lg bg-border/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

/** Kerangka halaman generik saat "memuat data". */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
      <span className="sr-only">Memuat…</span>
    </div>
  )
}

/* ---------- EmptyState ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  steps,
  className,
}: {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  steps?: string[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-border">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-section-title text-charcoal">{title}</h3>
      {description && <p className="mt-1 max-w-md text-body text-muted">{description}</p>}
      {steps && (
        <ol className="mt-5 grid w-full max-w-xl gap-3 text-left sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 rounded-control border border-border bg-surface p-3">
              <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-caption font-bold text-denim ring-1 ring-denim-200">
                {i + 1}
              </span>
              <span className="text-caption-lg text-charcoal">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
