import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

type Side = 'top' | 'bottom' | 'right' | 'left'

interface TooltipProps {
  content: ReactNode
  side?: Side
  children: ReactElement
  /** Bila true, tooltip tidak ditampilkan (mis. sidebar dalam mode lebar). */
  disabled?: boolean
  className?: string
}

const GAP = 8

/**
 * Tooltip ringan berbasis portal: muncul saat hover/fokus, ditutup dengan Esc.
 * Anak harus berupa satu elemen yang bisa menerima ref & event (button/a).
 */
export function Tooltip({ content, side = 'top', children, disabled, className }: TooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLElement | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => !disabled && setOpen(true), [disabled])
  const hide = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const t = tipRef.current.getBoundingClientRect()
    let top = 0
    let left = 0
    if (side === 'top') {
      top = r.top - t.height - GAP
      left = r.left + r.width / 2 - t.width / 2
    } else if (side === 'bottom') {
      top = r.bottom + GAP
      left = r.left + r.width / 2 - t.width / 2
    } else if (side === 'right') {
      top = r.top + r.height / 2 - t.height / 2
      left = r.right + GAP
    } else {
      top = r.top + r.height / 2 - t.height / 2
      left = r.left - t.width - GAP
    }
    // Jika keluar layar atas, balik ke bawah
    if (top < 8 && side === 'top') top = r.bottom + GAP
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8))
    setPos({ top, left })
  }, [open, side, content])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    const onScroll = () => hide()
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, hide])

  if (!isValidElement(children)) return children

  type ChildProps = {
    ref?: unknown
    onMouseEnter?: (e: unknown) => void
    onMouseLeave?: (e: unknown) => void
    onFocus?: (e: unknown) => void
    onBlur?: (e: unknown) => void
    'aria-describedby'?: string
  }
  const child = children as ReactElement<ChildProps>
  const p = child.props

  // Pertahankan ref asli milik anak (mis. forwardRef pada Button).
  const originalRef = (child as unknown as { ref?: unknown }).ref
  const trigger = cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
      if (typeof originalRef === 'function') originalRef(node)
      else if (originalRef && typeof originalRef === 'object') (originalRef as { current: unknown }).current = node
    },
    onMouseEnter: (e: unknown) => {
      p.onMouseEnter?.(e)
      show()
    },
    onMouseLeave: (e: unknown) => {
      p.onMouseLeave?.(e)
      hide()
    },
    onFocus: (e: unknown) => {
      p.onFocus?.(e)
      show()
    },
    onBlur: (e: unknown) => {
      p.onBlur?.(e)
      hide()
    },
    'aria-describedby': open ? id : p['aria-describedby'],
  })

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={cn(
              'pointer-events-none fixed z-[80] max-w-[260px] rounded-lg bg-charcoal px-3 py-2 text-caption font-medium text-white shadow-pop',
              className,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

/**
 * Ikon "?" untuk menjelaskan istilah teknis. Bisa diketuk (ponsel) maupun di-hover.
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false)
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [hover, setHover] = useState(false)
  const open = pinned || hover

  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const width = Math.min(280, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8))
    setPos({ top: r.bottom + 8, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => {
      setPinned(false)
      setHover(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`Apa itu ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onBlur={() => setPinned(false)}
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-muted transition-colors before:absolute before:-inset-3 before:content-[''] hover:text-denim focus-ring"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(280, window.innerWidth - 16) }}
            className="fixed z-[80] rounded-[10px] border border-border bg-white p-3 text-caption-lg text-charcoal shadow-pop"
          >
            <p className="mb-1 font-semibold">{label}</p>
            <div className="text-muted">{children}</div>
          </div>,
          document.body,
        )}
    </>
  )
}
