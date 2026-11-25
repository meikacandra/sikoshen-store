import { Fragment, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useMediaQuery'

export type SortDir = 'asc' | 'desc'
export interface SortState {
  key: string
  dir: SortDir
}

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Nilai untuk pengurutan. Tanpa ini kolom tidak bisa diurutkan. */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Sel ini menjadi <th scope="row">. */
  rowHeader?: boolean
}

/** Mengurutkan baris berdasarkan kolom & arah. Stabil (tidak mengubah array asli). */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState | null): T[] {
  if (!sort) return rows
  const col = columns.find((c) => c.key === sort.key)
  if (!col?.sortValue) return rows
  const get = col.sortValue
  const mul = sort.dir === 'asc' ? 1 : -1
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = get(a.r)
      const vb = get(b.r)
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'id')
      return c !== 0 ? c * mul : a.i - b.i
    })
    .map((x) => x.r)
}

/** Klik header berikutnya: asc → desc → asc. */
export function nextSort(current: SortState | null, key: string): SortState {
  if (current?.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: 'asc' }
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }

export interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  caption: string
  /** Caption hanya untuk pembaca layar. */
  hideCaption?: boolean
  sort?: SortState | null
  onSortChange?: (s: SortState) => void
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  rowClassName?: (row: T) => string | undefined
  /** Konten tambahan di bawah baris (baris yang dibentangkan). */
  renderExpanded?: (row: T) => ReactNode | null
  /** Baris pemisah grup: dikembalikan string judul bila baris ini awal grup baru. */
  groupBy?: (row: T) => string
  footer?: ReactNode
  empty?: ReactNode
  dense?: boolean
  className?: string
}

export function Table<T>({
  columns,
  rows,
  getRowKey,
  caption,
  hideCaption = true,
  sort = null,
  onSortChange,
  onRowClick,
  rowLabel,
  rowClassName,
  renderExpanded,
  groupBy,
  footer,
  empty,
  dense,
  className,
}: TableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>

  let lastGroup: string | null = null
  return (
    <div className={cn('overflow-x-auto rounded-control border border-border', className)}>
      <table className="w-full border-collapse text-body">
        <caption className={cn('px-4 py-2 text-left text-caption-lg text-muted', hideCaption && 'sr-only')}>{caption}</caption>
        <thead className="bg-surface">
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              const ariaSort = c.sortValue ? (active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined
              const Icon = active ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    'whitespace-nowrap border-b border-border px-4 text-caption font-semibold uppercase tracking-wide text-muted',
                    dense ? 'py-2' : 'py-3',
                    alignClass[c.align ?? 'left'],
                    c.className,
                  )}
                >
                  {c.sortValue && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(nextSort(sort, c.key))}
                      className={cn(
                        'inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-charcoal focus-ring',
                        active && 'text-charcoal',
                        c.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {c.header}
                      <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-50')} aria-hidden="true" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = getRowKey(row)
            const group = groupBy?.(row)
            const showGroup = group !== undefined && group !== lastGroup
            lastGroup = group ?? null
            const expanded = renderExpanded?.(row)
            const clickable = Boolean(onRowClick)
            return (
              <Fragment key={key}>
                {showGroup && (
                  <tr className="bg-white">
                    <th
                      scope="colgroup"
                      colSpan={columns.length}
                      className="border-b border-border bg-denim-50/60 px-4 py-2 text-left text-caption-lg font-bold text-denim"
                    >
                      {group}
                    </th>
                  </tr>
                )}
                <tr
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable && rowLabel ? rowLabel(row) : undefined}
                  onClick={clickable ? () => onRowClick!(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick!(row)
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-border bg-white transition-colors last:border-b-0 even:bg-surface/50',
                    clickable && 'cursor-pointer hover:bg-denim-50/50 focus-visible:bg-denim-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-denim',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => {
                    const Cell = c.rowHeader ? 'th' : 'td'
                    return (
                      <Cell
                        key={c.key}
                        scope={c.rowHeader ? 'row' : undefined}
                        className={cn(
                          'px-4 align-middle font-normal text-charcoal',
                          dense ? 'py-2' : 'py-3',
                          alignClass[c.align ?? 'left'],
                          c.align === 'right' && 'tabular',
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </Cell>
                    )
                  })}
                </tr>
                {expanded && (
                  <tr className="border-b border-border bg-surface">
                    <td colSpan={columns.length} className="px-4 py-3">
                      {expanded}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {footer && <tfoot className="border-t border-border-strong bg-surface font-semibold">{footer}</tfoot>}
      </table>
    </div>
  )
}

/* ---------- ResponsiveTable: tabel di ≥640 px, kartu di ponsel ---------- */

export interface ResponsiveTableProps<T> extends TableProps<T> {
  renderCard: (row: T) => ReactNode
}

export function ResponsiveTable<T>({ renderCard, ...tableProps }: ResponsiveTableProps<T>) {
  const mobile = useIsMobile()
  if (!mobile) return <Table {...tableProps} />

  const { rows, getRowKey, onRowClick, rowLabel, caption, empty, groupBy, rowClassName, renderExpanded } = tableProps
  if (rows.length === 0 && empty) return <>{empty}</>
  let lastGroup: string | null = null
  return (
    <ul aria-label={caption} className="space-y-2">
      {rows.map((row) => {
        const group = groupBy?.(row)
        const showGroup = group !== undefined && group !== lastGroup
        lastGroup = group ?? null
        const content = renderCard(row)
        const expanded = renderExpanded?.(row)
        return (
          <Fragment key={getRowKey(row)}>
            {showGroup && (
              <li aria-hidden="false" className="px-1 pt-2 text-caption-lg font-bold text-denim">
                {group}
              </li>
            )}
            <li className={cn('rounded-card border border-border bg-white shadow-card', rowClassName?.(row))}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-label={rowLabel?.(row)}
                  className="block w-full rounded-card p-4 text-left hover:bg-surface/60 focus-ring"
                >
                  {content}
                </button>
              ) : (
                <div className="p-4">{content}</div>
              )}
              {expanded && <div className="border-t border-border px-4 py-3">{expanded}</div>}
            </li>
          </Fragment>
        )
      })}
    </ul>
  )
}

/* ---------- Pagination ---------- */

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
  className?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const fmt = new Intl.NumberFormat('id-ID')

  // Tampilkan maksimal 5 nomor halaman di sekitar halaman aktif
  const start = Math.max(1, Math.min(page - 2, pageCount - 4))
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i)

  const btn =
    'inline-flex h-11 min-w-[44px] items-center justify-center rounded-control px-2 text-caption-lg font-semibold transition-colors focus-ring sm:h-9 sm:min-w-[36px]'

  return (
    <nav aria-label="Navigasi halaman tabel" className={cn('flex flex-wrap items-center justify-between gap-3 pt-4', className)}>
      <p className="tabular text-caption-lg text-muted" aria-live="polite">
        Menampilkan {fmt.format(from)}–{fmt.format(to)} dari {fmt.format(total)}
      </p>
      {pageCount > 1 && (
        <div className="flex max-w-full flex-wrap items-center gap-1">
          <button
            type="button"
            className={cn(btn, 'text-charcoal hover:bg-surface aria-disabled:text-muted aria-disabled:hover:bg-transparent')}
            onClick={() => page > 1 && onChange(page - 1)}
            aria-disabled={page === 1 || undefined}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Halaman ${p}`}
              className={cn(btn, 'tabular', p === page ? 'bg-denim text-white' : 'text-charcoal hover:bg-surface')}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className={cn(btn, 'text-charcoal hover:bg-surface aria-disabled:text-muted aria-disabled:hover:bg-transparent')}
            onClick={() => page < pageCount && onChange(page + 1)}
            aria-disabled={page === pageCount || undefined}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  )
}
