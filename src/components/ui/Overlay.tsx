import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'

type Variant = 'modal' | 'drawer' | 'sheet'

interface OverlayProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  variant: Variant
  size?: 'sm' | 'md' | 'lg'
  initialFocus?: RefObject<HTMLElement>
  /** Jika true, klik latar/Esc tidak menutup (mis. saat proses berjalan). */
  dismissible?: boolean
  className?: string
}

const panelClass: Record<Variant, string> = {
  modal: 'relative m-4 flex max-h-[calc(100dvh-32px)] w-full flex-col rounded-modal bg-white shadow-pop',
  drawer: 'relative ml-auto flex h-full w-full max-w-[480px] flex-col bg-white shadow-pop sm:rounded-l-modal',
  sheet: 'relative mt-auto flex max-h-[88dvh] w-full flex-col rounded-t-modal bg-white shadow-pop',
}

const sizeClass = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' }

function OverlayBase({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant,
  size = 'md',
  initialFocus,
  dismissible = true,
  className,
}: OverlayProps) {
  const reduce = usePrefersReducedMotion()
  const titleId = useId()
  const descId = useId()

  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : variant === 'modal'
      ? { initial: { opacity: 0, scale: 0.97, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98 } }
      : variant === 'drawer'
        ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
        : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'no-print fixed inset-0 z-[70] flex',
            variant === 'modal' && 'items-center justify-center',
          )}
        >
          <motion.div
            className="absolute inset-0 bg-charcoal/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => dismissible && onClose()}
            aria-hidden="true"
          />
          <Panel
            variant={variant}
            className={cn(panelClass[variant], variant === 'modal' && sizeClass[size], className)}
            motionProps={motionProps}
            titleId={titleId}
            descId={description ? descId : undefined}
            onClose={onClose}
            dismissible={dismissible}
            initialFocus={initialFocus}
          >
            {variant === 'sheet' && (
              <div className="flex justify-center pt-2" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-border-strong" />
              </div>
            )}
            <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-section-title text-charcoal">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-caption-lg text-muted">
                    {description}
                  </p>
                )}
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-charcoal focus-ring"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
            {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>}
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                {footer}
              </div>
            )}
          </Panel>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Panel terpisah agar focus trap aktif tepat saat panel ter-mount. */
function Panel({
  children,
  className,
  motionProps,
  titleId,
  descId,
  onClose,
  dismissible,
  initialFocus,
  variant,
}: {
  children: ReactNode
  className: string
  motionProps: Record<string, unknown>
  titleId: string
  descId?: string
  onClose: () => void
  dismissible: boolean
  initialFocus?: RefObject<HTMLElement>
  variant: Variant
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, () => dismissible && onClose(), initialFocus)
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      className={cn(className, 'focus:outline-none')}
      transition={{ type: 'tween', duration: variant === 'modal' ? 0.16 : 0.22, ease: 'easeOut' }}
      {...motionProps}
    >
      {children}
    </motion.div>
  )
}

type PublicProps = Omit<OverlayProps, 'variant'>

export const Modal = (p: PublicProps) => <OverlayBase {...p} variant="modal" />
export const Drawer = (p: PublicProps) => <OverlayBase {...p} variant="drawer" />
export const BottomSheet = (p: PublicProps) => <OverlayBase {...p} variant="sheet" />
