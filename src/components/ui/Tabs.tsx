import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  /** id prefix untuk menghubungkan tab ↔ panel. */
  idPrefix?: string
}

/** Tab dengan navigasi panah kiri/kanan (pola WAI-ARIA). Bisa digulir di ponsel. */
export function Tabs<T extends string>({ items, value, onChange, label, className, idPrefix = 'tab' }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % items.length
    if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = items.length - 1
    if (next >= 0) {
      e.preventDefault()
      refs.current[next]?.focus()
      onChange(items[next].value)
    }
  }

  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b border-border">
        {items.map((t, i) => {
          const active = t.value === value
          return (
            <button
              key={t.value}
              ref={(n) => {
                refs.current[i] = n
              }}
              role="tab"
              id={`${idPrefix}-${t.value}`}
              aria-selected={active}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'relative -mb-px inline-flex h-11 items-center gap-2 rounded-t-lg px-3 text-body font-semibold transition-colors focus-ring',
                active ? 'text-denim' : 'text-muted hover:text-charcoal',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    'tabular rounded-full px-2 py-px text-caption font-semibold',
                    active ? 'bg-denim-50 text-denim' : 'bg-surface text-muted',
                  )}
                >
                  {t.count}
                </span>
              )}
              <span
                aria-hidden="true"
                className={cn('absolute inset-x-2 bottom-0 h-0.5 rounded-full', active ? 'bg-denim' : 'bg-transparent')}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: ReactNode }>
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  size?: 'sm' | 'md'
}

/** Kontrol tersegmentasi (pilih satu). */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-control border border-border bg-surface p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 font-semibold transition-colors focus-ring',
              size === 'md' ? 'h-11 text-caption-lg sm:h-9' : 'h-11 text-caption sm:h-8',
              active ? 'bg-white text-charcoal shadow-card ring-1 ring-border' : 'text-muted hover:text-charcoal',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
