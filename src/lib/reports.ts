import type { Inventory } from '../data/demo'
import type { MonthlyMovement, MonthKey } from '../data/movements'
import { summarizeMovements } from '../data/movements'
import type { InventorySku } from './inventoryViews'

export type ReportGrouping = 'produk' | 'bulan' | 'sku'
export interface ReportTotals {
  openingStock: number
  incoming: number
  outgoing: number
  closingStock: number
}
export interface ReportRow extends ReportTotals {
  key: string
  name: string
  fast: number
  slow: number
  skuCount: number
}

export function isMonthKey(value: string): value is MonthKey {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  return year >= 1900 && year <= 2100
}

export function reportData(inventory: Inventory, from: MonthKey, to: MonthKey, productId = '', skuId = '', grouping: ReportGrouping = 'produk') {
  const skus = inventory.skus.filter((sku) => (!productId || sku.productId === productId) && (!skuId || sku.id === skuId))
  const groups = new Map<string, Array<{ sku: InventorySku; history: MonthlyMovement[] }>>()
  for (const sku of skus) {
    const history = (inventory.movementsBySku[sku.id] ?? []).filter((row) => row.month >= from && row.month <= to)
    if (!history.length) continue
    if (grouping === 'bulan') {
      for (const row of history) {
        const group = groups.get(row.month) ?? []
        group.push({ sku, history: [row] })
        groups.set(row.month, group)
      }
    } else {
      const key = grouping === 'sku' ? sku.id : sku.productId
      const group = groups.get(key) ?? []
      group.push({ sku, history })
      groups.set(key, group)
    }
  }
  const rows: ReportRow[] = [...groups].map(([key, entries]) => {
    const summaries: ReportTotals[] = entries.map(({ history }) => summarizeMovements(history))
    const sum = (field: keyof ReportTotals) => summaries.reduce((total, row) => total + row[field], 0)
    return {
      key,
      name: grouping === 'bulan' ? key : grouping === 'sku' ? `${entries[0].sku.productName} · ${entries[0].sku.variant} · ${entries[0].sku.size}` : entries[0].sku.productName,
      openingStock: sum('openingStock'), incoming: sum('incoming'), outgoing: sum('outgoing'), closingStock: sum('closingStock'),
      fast: entries.filter(({ sku }) => sku.label === 'fast').length,
      slow: entries.filter(({ sku }) => sku.label === 'slow').length,
      skuCount: entries.length,
    }
  }).sort((a, b) => a.key.localeCompare(b.key, 'id'))
  const totals: ReportTotals = {
    openingStock: rows.reduce((n, row) => n + row.openingStock, 0),
    incoming: rows.reduce((n, row) => n + row.incoming, 0),
    outgoing: rows.reduce((n, row) => n + row.outgoing, 0),
    closingStock: rows.reduce((n, row) => n + row.closingStock, 0),
  }
  return { rows, totals, skuCount: skus.length }
}
