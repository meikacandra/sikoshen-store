import { formatDecimal1 } from '../../lib/format'

export function FeatureImportance({ items }: { items: ReadonlyArray<{ feature: string; value: number }> }) {
  const maximum = Math.max(...items.map(({ value }) => value))
  return (
    <figure aria-label="Pengaruh fitur dalam model">
      <figcaption className="sr-only">Batang terpanjang menunjukkan pengaruh relatif terbesar.</figcaption>
      <ol className="space-y-3">
        {items.map(({ feature, value }) => (
          <li key={feature}>
            <div className="mb-1 flex items-start justify-between gap-3 text-caption-lg">
              <span>{feature}</span>
              <span className="tabular shrink-0 font-semibold text-denim">{formatDecimal1(value * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              <div className="h-full rounded-full bg-denim" style={{ width: `${maximum ? value / maximum * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </figure>
  )
}
