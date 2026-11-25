import type { Inventory } from '../data/demo'
import type { MonthlyMovement } from '../data/movements'
import { formatDate, formatMonth, formatMonthLong } from './format'

export type InventorySku = Inventory['skus'][number]
export type MovementRange = '6' | '12' | 'all'

export const movementRanges: Array<{ value: MovementRange; label: string }> = [
  { value: '6', label: '6 bulan' },
  { value: '12', label: '12 bulan' },
  { value: 'all', label: 'Semua' },
]

export function monthName(month: string, long = false): string {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(year, number - 1, 1)
  return long ? formatMonthLong(date) : formatMonth(date)
}

export function dayName(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return formatDate(new Date(year, month - 1, day))
}

/** Jendela terbaru, digeser ke belakang jika pilihan berada di luar jendela. */
export function movementWindow(rows: readonly MonthlyMovement[], range: MovementRange, selected?: string) {
  if (range === 'all') return [...rows]
  const length = Number(range)
  const index = rows.findIndex((row) => row.month === selected)
  const start = Math.max(0, rows.length - length)
  const end = index >= 0 && index < start ? Math.min(rows.length, Math.max(length, index + 1)) : rows.length
  return rows.slice(Math.max(0, end - length), end)
}

export function skuPath(id: string) {
  return `/produk/${encodeURIComponent(id)}`
}

export function filteredPath(path: string, filters: Record<string, string>) {
  return `${path}?${new URLSearchParams(filters)}`
}
