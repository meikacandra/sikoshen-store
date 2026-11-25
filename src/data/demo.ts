import { canClassifySku, getStockAction, getStockCondition } from '../lib/rules'
import { initialClassification } from './classification'
import { aggregateMonthlyMovements, averageDailyStock, generateMovements, type MonthKey, type MonthlyMovement } from './movements'
import { model } from './model'
import { products } from './products'
import { generateSkuProfiles, type SkuProfile } from './skus'
import { initialUploads } from './uploads'

function monthIndex(key: MonthKey): number {
  const [year, month] = key.split('-').map(Number)
  return year * 12 + month - 1
}

function summarizeSku(profile: SkuProfile, history: readonly MonthlyMovement[], recentStart: number) {
  const chronological = [...history].sort((a, b) => a.month.localeCompare(b.month))
  const stock = chronological[chronological.length - 1]?.closingStock ?? profile.stock
  const averageStock = averageDailyStock(profile.id, chronological)
  const condition = getStockCondition(stock, averageStock)
  const historyMonths = new Set(history.map(({ month }) => month)).size
  const label = canClassifySku(historyMonths, profile.recognizedByModel) ? profile.label : null
  // Bulan tanpa catatan tidak dianggap nol atau digantikan dengan bulan lama.
  const recent = history.filter(({ month }) => monthIndex(month) >= recentStart)
  return {
    ...profile,
    productName: products.find(({ id }) => id === profile.productId)?.name ?? profile.productId,
    stock,
    averageStock,
    label,
    condition,
    action: getStockAction(label, condition),
    totalIncoming: history.reduce((total, row) => total + row.incoming, 0),
    totalOutgoing: history.reduce((total, row) => total + row.outgoing, 0),
    averageMonthlyOut: recent.reduce((total, row) => total + row.outgoing, 0) / (recent.length || 1),
    historyMonths,
  }
}

export function createInventory(
  profiles: readonly SkuProfile[],
  movementsBySku: Readonly<Record<string, readonly MonthlyMovement[]>>,
) {
  const monthlyMovements = aggregateMonthlyMovements(movementsBySku, profiles.map(({ id }) => id))
  const lastMonth = monthlyMovements[monthlyMovements.length - 1]
  const recentStart = lastMonth ? monthIndex(lastMonth.month) - 11 : Infinity
  const skus = profiles.map((profile) => summarizeSku(profile, movementsBySku[profile.id] ?? [], recentStart))
  return {
    profiles,
    skus,
    movementsBySku,
    monthlyMovements,
  }
}

export type Inventory = ReturnType<typeof createInventory>

const profiles = generateSkuProfiles()
const inventory = createInventory(profiles, generateMovements(profiles))

export const demo = {
  inventory,
  products,
  model,
  uploads: initialUploads,
  classifications: initialClassification(inventory.skus),
}
