import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Menjebak fokus di dalam container selama `active`, menutup dengan Esc,
 * dan mengembalikan fokus ke elemen pemicu saat ditutup.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  active: boolean,
  onEscape?: () => void,
  initialFocus?: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!active) return
    const trigger = document.activeElement as HTMLElement | null
    const node = ref.current

    const focusables = () =>
      node
        ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement,
          )
        : []

    // Fokus awal setelah elemen ter-mount
    const t = window.setTimeout(() => {
      if (initialFocus?.current) initialFocus.current.focus()
      else (focusables()[0] ?? node)?.focus()
    }, 20)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape?.()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const list = focusables()
      if (list.length === 0) {
        e.preventDefault()
        node.focus()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (trigger && document.contains(trigger)) trigger.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
