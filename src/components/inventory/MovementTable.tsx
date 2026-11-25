import { ResponsiveTable, type Column } from '../ui'
import type { MonthlyMovement } from '../../data/movements'
import { cn } from '../../lib/cn'
import { formatNumber, formatUnit } from '../../lib/format'
import { monthName } from '../../lib/inventoryViews'

export function MovementTable({ rows, selected, balances = false }: {
  rows: MonthlyMovement[]
  selected?: string
  balances?: boolean
}) {
  const metrics: Array<{ key: 'openingStock' | 'incoming' | 'outgoing' | 'closingStock'; label: string }> = [
    { key: 'openingStock', label: 'Stok awal' },
    { key: 'incoming', label: 'Masuk' },
    { key: 'outgoing', label: 'Keluar' },
    { key: 'closingStock', label: 'Stok akhir' },
  ]
  const visible = balances ? metrics : metrics.slice(1, 3)
  const columns: Column<MonthlyMovement>[] = [
    { key: 'month', header: 'Bulan', rowHeader: true, cell: (row) => <span className="whitespace-nowrap font-semibold">{monthName(row.month)}{row.month === selected && <span className="sr-only">, bulan terpilih</span>}</span> },
    ...visible.map(({ key, label }): Column<MonthlyMovement> => ({ key, header: label, align: 'right', cell: (row) => formatNumber(row[key]) })),
  ]

  return (
    <ResponsiveTable columns={columns} rows={rows} getRowKey={(row) => row.month} caption="Pergerakan stok per bulan"
      rowClassName={(row) => cn(row.month === selected && '!bg-denim-50')}
      renderCard={(row) => (
        <>
          <p className="mb-3 font-semibold">{monthName(row.month, true)}{row.month === selected && <span className="sr-only">, bulan terpilih</span>}</p>
          <dl className="grid grid-cols-2 gap-3">
            {visible.map(({ key, label }) => (
              <div key={key}><dt className="text-caption text-muted">{label}</dt><dd className="tabular font-semibold">{formatUnit(row[key])}</dd></div>
            ))}
          </dl>
        </>
      )}
    />
  )
}
