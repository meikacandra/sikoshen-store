import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
  Layers,
  PauseCircle,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import type { MovementLabel, StockAction, StockCondition, Tone } from '../../lib/types'

const toneClass: Record<Tone | 'fast' | 'slow', string> = {
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
  warning: 'bg-warning-bg text-warning-fg border-warning-border',
  success: 'bg-success-bg text-success-fg border-success-border',
  stack: 'bg-stack-bg text-stack-fg border-stack-border',
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-border',
  info: 'bg-denim-50 text-denim border-denim-200',
  fast: 'bg-fast-bg text-fast-fg border-fast-border',
  slow: 'bg-slow-bg text-slow-fg border-slow-border',
}

interface BadgeProps {
  tone: keyof typeof toneClass
  icon?: LucideIcon
  children: ReactNode
  className?: string
  size?: 'sm' | 'md'
}

/** Badge status: selalu warna + ikon + teks. */
export function Badge({ tone, icon: Icon, children, className, size = 'md' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold',
        size === 'md' ? 'px-2.5 py-0.5 text-caption' : 'px-2 py-px text-[11px] leading-4',
        toneClass[tone],
        className,
      )}
    >
      {Icon && <Icon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden="true" />}
      {children}
    </span>
  )
}

/* ---------- Kondisi stok & tindakan ---------- */

export const conditionMeta: Record<StockCondition, { label: string; tone: Tone; icon: LucideIcon }> = {
  habis: { label: 'Habis', tone: 'danger', icon: XCircle },
  bawah: { label: 'Di bawah rata-rata', tone: 'warning', icon: AlertTriangle },
  normal: { label: 'Normal', tone: 'success', icon: CheckCircle2 },
  menumpuk: { label: 'Menumpuk', tone: 'stack', icon: Layers },
}

export const actionMeta: Record<StockAction, { label: string; tone: Tone; icon: LucideIcon }> = {
  restock: { label: 'Prioritaskan restock', tone: 'danger', icon: AlertTriangle },
  pantau: { label: 'Pantau stok', tone: 'success', icon: CheckCircle2 },
  tahan: { label: 'Tahan pembelian', tone: 'neutral', icon: PauseCircle },
  evaluasi: { label: 'Evaluasi stok menumpuk', tone: 'stack', icon: Layers },
}

type StatusChipProps =
  | { kind: 'condition'; value: StockCondition; size?: 'sm' | 'md'; className?: string }
  | { kind: 'action'; value: StockAction; size?: 'sm' | 'md'; className?: string }
  | { kind: 'tone'; tone: Tone; label: string; size?: 'sm' | 'md'; className?: string }

const toneIcon: Record<Tone, LucideIcon> = {
  danger: XCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  stack: Layers,
  neutral: PauseCircle,
  info: Info,
}

export function StatusChip(props: StatusChipProps) {
  if (props.kind === 'tone') {
    return (
      <Badge tone={props.tone} icon={toneIcon[props.tone]} size={props.size} className={props.className}>
        {props.label}
      </Badge>
    )
  }
  const meta = props.kind === 'condition' ? conditionMeta[props.value] : actionMeta[props.value]
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={props.size} className={props.className}>
      {meta.label}
    </Badge>
  )
}

/* ---------- Label pergerakan ---------- */

export const labelMeta: Record<MovementLabel, { label: string; short: string; icon: LucideIcon }> = {
  fast: { label: 'Fast-Moving', short: 'Fast', icon: TrendingUp },
  slow: { label: 'Slow-Moving', short: 'Slow', icon: TrendingDown },
}

export function LabelChip({
  value,
  short,
  size,
  className,
}: {
  value: MovementLabel | null
  short?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  if (value === null) {
    return (
      <Badge tone="neutral" icon={CircleDashed} size={size} className={className}>
        Belum ada label
      </Badge>
    )
  }
  const m = labelMeta[value]
  return (
    <Badge tone={value} icon={m.icon} size={size} className={className}>
      {short ? m.short : m.label}
    </Badge>
  )
}

/* ---------- Chip filter (bisa dihapus) ---------- */

interface ChipProps {
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Chip netral. Dengan `onClick` menjadi tombol toggle (aria-pressed);
 * dengan `onRemove` menampilkan tombol hapus.
 */
export function Chip({ children, onRemove, removeLabel, selected, onClick, className }: ChipProps) {
  const cls = cn(
    'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-caption-lg font-medium transition-colors',
    selected
      ? 'border-denim bg-denim-50 text-denim'
      : 'border-border-strong bg-white text-charcoal',
    onClick && 'hover:border-denim hover:text-denim focus-ring',
    className,
  )
  if (onClick) {
    return (
      <button type="button" aria-pressed={selected} onClick={onClick} className={cls}>
        {children}
      </button>
    )
  }
  return (
    <span className={cn(cls, onRemove && 'pr-1')}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Hapus'}
          className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted before:absolute before:-inset-2 before:content-[''] hover:bg-surface hover:text-charcoal focus-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
