import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

interface AccordionItemProps {
  title: ReactNode
  meta?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/** Panel buka-tutup tunggal dengan aria-expanded. */
export function AccordionItem({ title, meta, children, defaultOpen = false, className }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={cn('rounded-control border border-border bg-white', className)}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-control px-4 py-3 text-left hover:bg-surface/60 focus-ring"
        >
          <span className="min-w-0 flex-1 font-semibold text-charcoal">{title}</span>
          {meta}
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={id} hidden={!open} className="border-t border-border px-4 py-3 text-body text-charcoal">
        {children}
      </div>
    </div>
  )
}
