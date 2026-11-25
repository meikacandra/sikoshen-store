import { cn } from '../../lib/cn'
import { formatNumber } from '../../lib/format'

export function ConfusionMatrix({ matrix }: {
  matrix: { actualSlow: { slow: number; fast: number }; actualFast: { slow: number; fast: number } }
}) {
  const rows = [
    { name: 'Sebenarnya Slow', values: [matrix.actualSlow.slow, matrix.actualSlow.fast] },
    { name: 'Sebenarnya Fast', values: [matrix.actualFast.slow, matrix.actualFast.fast] },
  ]

  return (
    <div className="overflow-x-auto rounded-control border border-border">
      <table className="w-full text-caption-lg">
        <caption className="sr-only">Matriks label sebenarnya dan label model</caption>
        <thead className="bg-surface text-muted">
          <tr><th scope="col" className="p-2 text-left">Label uji</th><th scope="col" className="p-2">Model Slow</th><th scope="col" className="p-2">Model Fast</th></tr>
        </thead>
        <tbody>
          {rows.map(({ name, values }, row) => (
            <tr key={name} className="border-t border-border">
              <th scope="row" className="bg-surface p-2 text-left font-semibold">{name}</th>
              {values.map((value, column) => <td key={column} className={cn('tabular border-l border-border p-2 text-center font-semibold',
                row === column ? 'bg-success-bg text-success-fg' : 'bg-white text-charcoal')}>
                {formatNumber(value)}<span className="sr-only">{row === column ? ' benar' : ' salah'}</span>
              </td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
