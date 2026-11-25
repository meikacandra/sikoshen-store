import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { usePrefersReducedMotion } from '../hooks/useMediaQuery'

export type ToastTone = 'success' | 'info' | 'warning' | 'danger'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  /** ms; default 4500. Toast dengan aksi bertahan 7000 ms. */
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastItem extends Required<Pick<ToastOptions, 'title' | 'tone'>> {
  id: number
  description?: string
  action?: ToastOptions['action']
}

interface ToastApi {
  toast: (o: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

const toneStyle: Record<ToastTone, { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success-fg' },
  info: { icon: Info, color: 'text-denim' },
  warning: { icon: AlertTriangle, color: 'text-warning-fg' },
  danger: { icon: XCircle, color: 'text-danger-fg' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, number>())
  const reduce = usePrefersReducedMotion()

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((t) => t.id !== id))
    const t = timers.current.get(id)
    if (t) window.clearTimeout(t)
    timers.current.delete(id)
  }, [])

  const toast = useCallback(
    ({ title, description, tone = 'success', duration, action }: ToastOptions) => {
      const id = ++seq.current
      setItems((xs) => [...xs.slice(-2), { id, title, description, tone, action }])
      const ms = duration ?? (action ? 7000 : 4500)
      timers.current.set(id, window.setTimeout(() => dismiss(id), ms))
      return id
    },
    [dismiss],
  )

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="no-print pointer-events-none fixed inset-x-0 bottom-[84px] z-[90] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const s = toneStyle[t.tone]
            const Icon = s.icon
            return (
              <motion.div
                key={t.id}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18 }}
                role={t.tone === 'danger' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-card border border-border bg-white p-4 shadow-pop"
              >
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', s.color)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-caption-lg text-muted">{t.description}</p>}
                </div>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action!.onClick()
                      dismiss(t.id)
                    }}
                    className="-my-1 inline-flex h-9 items-center rounded-lg px-2.5 text-caption-lg font-bold text-denim hover:bg-denim-50 focus-ring"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Tutup notifikasi"
                  className="-m-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-charcoal focus-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  return ctx
}
