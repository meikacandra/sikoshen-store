import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonthlyMovement } from '../../data/movements'
import { formatNumber, formatUnit } from '../../lib/format'
import { monthName } from '../../lib/inventoryViews'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface Props {
  rows: MonthlyMovement[]
  label: string
  selected?: string
}

const incomingColor = 'rgb(var(--denim-200))'
const outgoingColor = 'rgb(var(--denim))'
const textColor = 'rgb(var(--muted))'
const borderColor = 'rgb(var(--border))'

export function MovementBarChart({ rows, label, selected }: Props) {
  const mobile = useIsMobile()
  return (
    <figure className="min-w-0">
      <div className="h-60 min-w-0 sm:h-72" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ left: 0, right: 4, top: 14, bottom: 4 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={borderColor} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={(value: string) => monthName(value)} tick={{ fill: textColor, fontSize: 11 }}
              tickLine={false} axisLine={{ stroke: borderColor }} tickMargin={9} interval="preserveStartEnd" minTickGap={mobile ? 24 : 13} />
            <YAxis width={mobile ? 35 : 44} tickFormatter={formatNumber} allowDecimals={false}
              tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgb(var(--surface))' }} labelFormatter={(value: string) => monthName(value, true)}
              formatter={(value: number) => formatUnit(value)}
              contentStyle={{ borderColor, borderRadius: 'var(--radius-control)', fontSize: 13 }} />
            <Bar dataKey="incoming" name="Barang masuk" fill={incomingColor} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {rows.map((row) => <Cell key={row.month} fillOpacity={!selected || selected === row.month ? 1 : 0.58} />)}
            </Bar>
            <Bar dataKey="outgoing" name="Barang keluar" fill={outgoingColor} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {rows.map((row) => <Cell key={row.month} fillOpacity={!selected || selected === row.month ? 1 : 0.58} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-caption-lg text-muted">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-denim-200" aria-hidden="true" /> Barang masuk</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-denim" aria-hidden="true" /> Barang keluar</span>
      </figcaption>
    </figure>
  )
}
