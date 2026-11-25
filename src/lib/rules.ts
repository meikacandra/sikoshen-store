import { formatDecimal1 } from './format'
import type { MovementLabel, StockAction, StockCondition } from './types'

export function getStockCondition(stock: number, averageStock: number): StockCondition {
  if (stock === 0) return 'habis'
  if (stock < averageStock) return 'bawah'
  if (stock >= 1.5 * averageStock) return 'menumpuk'
  return 'normal'
}

export function getStockAction(label: MovementLabel | null, condition: StockCondition): StockAction | null {
  if (label === null) return null
  if (label === 'fast') return condition === 'habis' || condition === 'bawah' ? 'restock' : 'pantau'
  return condition === 'menumpuk' ? 'evaluasi' : 'tahan'
}

export function getMovementLabel(
  estimatedTotalOut: number,
  median: number,
  historyMonths: number,
  recognizedByModel: boolean,
): MovementLabel | null {
  if (!canClassifySku(historyMonths, recognizedByModel)) return null
  return estimatedTotalOut > median ? 'fast' : 'slow'
}

export function canClassifySku(historyMonths: number, recognizedByModel: boolean): boolean {
  return historyMonths >= 3 && recognizedByModel
}

export const STOCK_COVERAGE_NOTE = 'Data historis, bukan prediksi'

export function formatStockCoverage(stock: number, averageMonthlyOut: number): string {
  return averageMonthlyOut > 0 ? `${formatDecimal1(stock / averageMonthlyOut)} bulan` : '—'
}
