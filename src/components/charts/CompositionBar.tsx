import { formatNumber } from '../../lib/format'

export function CompositionBar({ fast, slow }: { fast: number; slow: number }) {
  const total = fast + slow
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
      {!!total && <>
        <div style={{ width: `${(fast / total) * 100}%` }} className="bg-denim" />
        <div style={{ width: `${(slow / total) * 100}%` }} className="bg-slow-border" />
      </>}
    </div>
  )
}

export function CompositionLegend({ fast, slow }: { fast: number; slow: number }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption-lg font-semibold">
      <span className="inline-flex items-center gap-1.5 text-fast-fg"><span className="h-2 w-2 rounded-sm bg-denim" aria-hidden="true" /> {formatNumber(fast)} Fast-Moving</span>
      <span className="inline-flex items-center gap-1.5 text-slow-fg"><span className="h-2 w-2 rounded-sm bg-slow-border" aria-hidden="true" /> {formatNumber(slow)} Slow-Moving</span>
    </div>
  )
}
