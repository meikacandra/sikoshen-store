import { allocateUnits, seededRandom } from './random'
import { DEMO_HISTORY_MONTHS, FEATURED_SKU_ID, type SkuProfile } from './skus'
import { getStockCondition } from '../lib/rules'

export type MonthKey = `${number}-${string}`

export interface MonthlyMovement {
  month: MonthKey
  openingStock: number
  incoming: number
  outgoing: number
  closingStock: number
  transactions?: readonly DailyMovement[]
}

export interface DailyMovement {
  date: string
  incoming: number
  outgoing: number
  closingStock: number
}

export const DEMO_PERIOD_START = new Date(2023, 4, 1)
export const DEMO_PERIOD_END = new Date(2026, 4, 31)

export const demoMonths = Array.from({ length: DEMO_HISTORY_MONTHS }, (_, index): MonthKey => {
  const date = new Date(2023, 4 + index, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
})

const fixedStoreTotals = [
  [520, 610], [480, 540], [690, 820], [560, 650], [640, 680], [610, 702],
] as const

const fixedFeatured = [
  [54, 40, 42, 52], [52, 30, 36, 46], [46, 60, 52, 54],
  [54, 40, 58, 36], [36, 40, 44, 32], [32, 30, 42, 20],
] as const

const featuredMayTransactions = [
  [2, 0, 3, 29], [6, 30, 5, 54], [12, 0, 9, 45],
  [18, 0, 11, 34], [24, 0, 8, 26], [31, 0, 6, 20],
] as const

const peakMonths = new Set(['2024-03', '2024-04', '2025-02', '2025-03', '2026-02', '2026-03'])
const recentStart = demoMonths.length - 12
const fixedStart = demoMonths.length - fixedFeatured.length

function buildSampleOutgoing(profile: SkuProfile, random: () => number): number[] {
  const average = profile.sampleMonthlyOut ?? 0
  const weights = demoMonths.map((month) => (peakMonths.has(month) ? 1.3 : 1) * (0.8 + 0.4 * random()))
  if (profile.id !== FEATURED_SKU_ID) {
    return [
      ...allocateUnits(average * recentStart, weights.slice(0, recentStart)),
      ...allocateUnits(average * 12, weights.slice(recentStart)),
    ]
  }

  const fixed = fixedFeatured.map(([, , outgoing]) => outgoing)
  const fixedTotal = fixed.reduce((sum, value) => sum + value, 0)
  return [
    ...allocateUnits(1452 - average * 12, weights.slice(0, recentStart)),
    ...allocateUnits(average * 12 - fixedTotal, weights.slice(recentStart, fixedStart)),
    ...fixed,
  ]
}

function buildSampleHistory(profile: SkuProfile, random: () => number): MonthlyMovement[] {
  const outgoingByMonth = buildSampleOutgoing(profile, random)
  const adjustmentByMonth = demoMonths.map(() => Math.floor(random() * 5) - 2)

  // Cari dasar stok yang menghasilkan rata-rata bulat sesuai SKU contoh.
  // Saat dasar dinaikkan, saldo di luar bulan yang ditetapkan tidak ikut turun.
  let low = 0
  let high = 2 * Math.max(profile.averageStockTarget, profile.stock)
  while (low <= high) {
    const baseline = Math.floor((low + high) / 2)
    let closingStock = profile.stock
    const history: MonthlyMovement[] = []
    for (let index = demoMonths.length - 1; index >= 0; index -= 1) {
      const outgoing = outgoingByMonth[index]
      const fixed = profile.id === FEATURED_SKU_ID ? fixedFeatured[index - fixedStart] : undefined
      const historicalStock = Math.max(0, baseline + adjustmentByMonth[index])
      const openingStock = fixed?.[0] ?? Math.min(closingStock + outgoing, historicalStock)
      const incoming = closingStock - openingStock + outgoing
      history.push({ month: demoMonths[index], openingStock, incoming, outgoing, closingStock })
      closingStock = openingStock
    }
    const average = averageDailyStock(profile.id, history)
    if (average === profile.averageStockTarget) return history.reverse()
    if (average < profile.averageStockTarget) low = baseline + 1
    else high = baseline - 1
  }
  throw new Error(`Rata-rata stok contoh tidak tercapai: ${profile.id}`)
}

/** Satu seri bulanan per SKU. Ringkasan toko dan produk berasal dari seri yang sama. */
export function generateMovements(
  profiles: readonly SkuProfile[],
  seed = 20230501,
): Record<string, MonthlyMovement[]> {
  const random = seededRandom(seed)
  const samples = profiles.filter((sku) => sku.sampleMonthlyOut !== undefined)
  const generated = profiles.filter((sku) => sku.sampleMonthlyOut === undefined)
  const sampleHistories = samples.map((sku) => buildSampleHistory(sku, random))
  const histories: Record<string, MonthlyMovement[]> = Object.fromEntries(
    profiles.map(({ id }) => [id, []]),
  )
  samples.forEach(({ id }, i) => { histories[id] = sampleHistories[i] })

  // SKU Slow yang tidak menumpuk menampung selisih saldo toko. Pertahankan
  // profil stok SKU lainnya supaya kondisi dan jumlah tindakan sesuai skenario.
  const reserves = generated.map((sku) =>
    sku.label === 'slow' && getStockCondition(sku.stock, sku.averageStockTarget) !== 'menumpuk',
  )
  const reserveWeights = generated.map((sku, i) => reserves[i] ? sku.stock : 0)
  const closingStocks = generated.map((sku) => sku.stock)
  for (let index = demoMonths.length - 1; index >= 0; index -= 1) {
    const month = demoMonths[index]
    const fixed = fixedStoreTotals[index - fixedStart]
    const seasonal = peakMonths.has(month) ? 150 : 0
    const storeOutgoing = fixed?.[1] ?? (530 + seasonal + Math.floor(random() * 100))
    const storeIncoming = fixed?.[0] ?? (storeOutgoing + Math.floor(random() * 61) - 30)
    const sampleTotals = sumMovementsForMonth(sampleHistories.map((history) => history[index]))
    const outgoing = storeOutgoing - sampleTotals.outgoing
    const incoming = storeIncoming - sampleTotals.incoming
    const weights = generated.map((sku) => (0.5 + Math.sqrt(sku.estimatedTotalOut) / 12) * (0.6 + random()))

    const transition = Math.min(1, (demoMonths.length - index) / 6)
    const openingStocks = generated.map((sku, i) => reserves[i] ? 0
      : Math.round(sku.stock + transition * (sku.averageStockTarget - sku.stock)))
    const openingTotal = sum(closingStocks) + outgoing - incoming
    const reserveTotal = openingTotal - sum(openingStocks)
    if (reserveTotal < 0) throw new Error(`Saldo stok demo tidak cukup pada ${month}`)
    const reservesBySku = allocateUnits(reserveTotal, reserveWeights)
    const changes = openingStocks.map((stock, i) => closingStocks[i] - stock - reservesBySku[i])
    const commonTotal = incoming - sum(changes.map((change) => Math.max(change, 0)))
    if (commonTotal < 0) throw new Error(`Pergerakan demo tidak cukup pada ${month}`)
    const commonUnits = allocateUnits(commonTotal, weights)

    generated.forEach(({ id }, i) => {
      const closingStock = closingStocks[i]
      const openingStock = openingStocks[i] + reservesBySku[i]
      histories[id].push({
        month, openingStock, closingStock,
        incoming: commonUnits[i] + Math.max(changes[i], 0),
        outgoing: commonUnits[i] + Math.max(-changes[i], 0),
      })
      closingStocks[i] = openingStock
    })
  }
  generated.forEach(({ id }) => { histories[id].reverse() })
  return histories
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function sumMovementsForMonth(rows: readonly MonthlyMovement[]): Omit<MonthlyMovement, 'month'> {
  return rows.reduce((total, row) => ({
    openingStock: total.openingStock + row.openingStock,
    incoming: total.incoming + row.incoming,
    outgoing: total.outgoing + row.outgoing,
    closingStock: total.closingStock + row.closingStock,
  }), { openingStock: 0, incoming: 0, outgoing: 0, closingStock: 0 })
}

/** Ringkas seri toko atau SKU per bulan. Saldo diambil dari batas periode. */
export function summarizeMovements(rows: readonly MonthlyMovement[]): Omit<MonthlyMovement, 'month'> {
  const chronological = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  return {
    openingStock: chronological[0]?.openingStock ?? 0,
    incoming: sum(rows.map((row) => row.incoming)),
    outgoing: sum(rows.map((row) => row.outgoing)),
    closingStock: chronological[chronological.length - 1]?.closingStock ?? 0,
  }
}

export function aggregateMonthlyMovements(
  histories: Readonly<Record<string, readonly MonthlyMovement[]>>,
  skuIds = Object.keys(histories),
): MonthlyMovement[] {
  const rowsByMonth = new Map<MonthKey, MonthlyMovement[]>()
  for (const id of skuIds) {
    for (const row of histories[id] ?? []) {
      const rows = rowsByMonth.get(row.month)
      if (rows) rows.push(row)
      else rowsByMonth.set(row.month, [row])
    }
  }
  return Array.from(rowsByMonth, ([month, rows]) => ({ month, ...sumMovementsForMonth(rows) }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function getDailyMovements(skuId: string, month: MonthlyMovement): DailyMovement[] {
  if (month.transactions) return [...month.transactions]
  const row = (day: number, incoming: number, outgoing: number, closingStock: number): DailyMovement => ({
    date: `${month.month}-${String(day).padStart(2, '0')}`, incoming, outgoing, closingStock,
  })
  const [opening, added, removed, closing] = fixedFeatured[fixedFeatured.length - 1]
  if (skuId === FEATURED_SKU_ID && month.month === '2026-05'
    && month.openingStock === opening && month.incoming === added
    && month.outgoing === removed && month.closingStock === closing) {
    return featuredMayTransactions.map(([day, incoming, outgoing, stock]) => row(day, incoming, outgoing, stock))
  }

  // Bagi pergerakan menjadi beberapa hari. Jaga saldo harian tetap nonnegatif.
  const days = [3, 8, 14, 19, 24, 28]
  const seed = Array.from(skuId + month.month).reduce((hash, char) => Math.imul(31, hash) + char.charCodeAt(0), 5381)
  const random = seededRandom(seed)
  const common = allocateUnits(Math.min(month.incoming, month.outgoing), days.map(() => 0.5 + random()))
  const difference = allocateUnits(Math.abs(month.incoming - month.outgoing), days.map(() => 0.5 + random()))
  const stockIncreases = month.incoming >= month.outgoing
  let stock = month.openingStock
  return days.flatMap((day, i) => {
    const incoming = common[i] + (stockIncreases ? difference[i] : 0)
    const outgoing = common[i] + (stockIncreases ? 0 : difference[i])
    stock += incoming - outgoing
    return incoming || outgoing ? [row(day, incoming, outgoing, stock)] : []
  })
}

/** Rata-rata saldo akhir setiap hari kalender, dibulatkan ke unit terdekat. */
export function averageDailyStock(skuId: string, history: readonly MonthlyMovement[]): number {
  let stockDays = 0
  let days = 0
  for (const month of history) {
    const [year, monthNumber] = month.month.split('-').map(Number)
    const daysInMonth = new Date(year, monthNumber, 0).getDate()
    let since = 1
    let stock = month.openingStock
    for (const transaction of getDailyMovements(skuId, month)) {
      const day = Number(transaction.date.slice(-2))
      stockDays += stock * (day - since)
      since = day
      stock = transaction.closingStock
    }
    stockDays += stock * (daysInMonth - since + 1)
    days += daysInMonth
  }
  return days ? Math.round(stockDays / days) : 0
}
