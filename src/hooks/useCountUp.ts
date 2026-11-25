import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './useMediaQuery'

export function useCountUp(target: number): number {
  const reducedMotion = usePrefersReducedMotion()
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (reducedMotion || target === 0) return
    const start = performance.now()
    let frame = 0
    function tick(now: number) {
      const progress = Math.min((now - start) / 420, 1)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target, reducedMotion])
  return reducedMotion || target === 0 ? target : value
}
