import { getMovementLabel, getStockAction, getStockCondition } from '../lib/rules'
import type { MovementLabel } from '../lib/types'
import { products, type Product } from './products'
import { allocateUnits, seededRandom } from './random'

export const DEMO_HISTORY_MONTHS = 37
export const FEATURED_SKU_ID = 'KMJDENIM-HITAM-L'

interface SkuStats {
  stock: number
  averageStock: number
  estimatedTotalOut: number
}

export interface SkuProfile extends Omit<SkuStats, 'averageStock'> {
  id: string
  productId: string
  variant: string
  size: string
  recognizedByModel: boolean
  label: MovementLabel | null
  /** Target untuk generator riwayat demo. Rata-rata inventaris dihitung dari transaksi. */
  averageStockTarget: number
  /** Nilai fixture untuk menjaga rata-rata keluar 12 bulan SKU contoh. */
  sampleMonthlyOut?: number
  /** Peluang Fast-Moving dari Model A (RandomForestClassifier). */
  fastProbability?: number | null
  /** Prediksi penjualan bulan depan dari Model B (RandomForestRegressor). */
  predictedNextMonth?: number | null
  rmseSku?: number | null
  safetyStock?: number | null
  suggestedOrder?: number | null
  predictionMonth?: string | null
}

interface Example extends SkuStats {
  label: MovementLabel
  sampleMonthlyOut: number
}

const examples: Readonly<Record<string, Example>> = {
  [FEATURED_SKU_ID]: { label: 'fast', stock: 20, averageStock: 38, sampleMonthlyOut: 41, estimatedTotalOut: 1480 },
  'KMJDENIM-HITAM-XL': { label: 'fast', stock: 0, averageStock: 22, sampleMonthlyOut: 28, estimatedTotalOut: 1010 },
  'TJB-HITAM-32': { label: 'fast', stock: 14, averageStock: 30, sampleMonthlyOut: 35, estimatedTotalOut: 1260 },
  'IHU-NAVY-31': { label: 'fast', stock: 26, averageStock: 24, sampleMonthlyOut: 18, estimatedTotalOut: 650 },
  'TJB-KREM-36': { label: 'slow', stock: 9, averageStock: 12, sampleMonthlyOut: 3, estimatedTotalOut: 110 },
  'KMJDENIM-BIRU-MUDA-XXXXL': { label: 'slow', stock: 34, averageStock: 18, sampleMonthlyOut: 2, estimatedTotalOut: 75 },
  'IHU-ABU-38': { label: 'slow', stock: 15, averageStock: 14, sampleMonthlyOut: 1, estimatedTotalOut: 40 },
}

type VariantSize = Pick<SkuProfile, 'id' | 'variant' | 'size'>

function getCombinations(product: Product): VariantSize[] {
  return product.variants.flatMap((variant) =>
    product.sizes
      .filter((size) => !product.unavailable.some(([color, unavailableSize]) =>
        color === variant && unavailableSize === size,
      ))
      .map((size) => ({ id: `${product.id}-${variant.toUpperCase().replace(/ /g, '-')}-${size}`, variant, size })),
  )
}

function generateProductSkus(product: Product, random: () => number): SkuProfile[] {
  const combinations = getCombinations(product)
  const fixed = combinations.flatMap(({ id }) => examples[id] ? [examples[id]] : [])
  const generated = combinations.filter(({ id }) => !examples[id])
  const fixedActions = fixed.map((sku) => getStockAction(sku.label, getStockCondition(sku.stock, sku.averageStock)))
  const fastCount = product.fastTarget - fixed.filter((sku) => sku.label === 'fast').length
  const restockCount = product.restockTarget - fixedActions.filter((action) => action === 'restock').length
  const stackedCount = product.stackedSlowTarget - fixedActions.filter((action) => action === 'evaluasi').length
  const stocks = allocateUnits(
    product.stockTarget - fixed.reduce((total, sku) => total + sku.stock, 0),
    generated.map(() => 0.6 + random()),
  )
  const evenSplit = combinations.length === product.fastTarget * 2
  const generatedStats = new Map(generated.map(({ id }, index) => {
    const fast = index < fastCount
    const stock = stocks[index]
    let averageStock = stock + Math.floor(random() * 8) - 4
    if (fast) {
      averageStock = index < restockCount ? stock + 1 + Math.floor(random() * 8) : stock
    } else if (index - fastCount < stackedCount) {
      // Sisakan jarak dari batas 2/3 karena stok naik bertahap di bulan terakhir.
      averageStock = Math.floor(stock * (0.45 + 0.12 * random()))
    } else {
      averageStock = Math.max(Math.floor(stock * 2 / 3) + 1, averageStock)
    }

    let estimatedTotalOut = fast
      ? product.median + 2 + Math.floor(random() * product.median)
      : product.median - 2 - Math.floor(random() * (product.median - 2))
    // Jaga dua nilai tengah agar median estimasi tepat sesuai skenario.
    if (evenSplit && index === 0) estimatedTotalOut = product.median + 1
    if (index === fastCount) estimatedTotalOut = product.median - (evenSplit ? 1 : 0)
    if (!evenSplit && index === fastCount + 1) estimatedTotalOut = product.median

    return [id, { stock, averageStock, estimatedTotalOut }] as const
  }))

  return combinations.map((combo) => {
    const sample = examples[combo.id]
    const stats = sample ?? generatedStats.get(combo.id)!
    return {
      ...combo,
      productId: product.id,
      stock: stats.stock,
      averageStockTarget: stats.averageStock,
      estimatedTotalOut: stats.estimatedTotalOut,
      label: getMovementLabel(stats.estimatedTotalOut, product.median, DEMO_HISTORY_MONTHS, true),
      recognizedByModel: true,
      ...(sample && { sampleMonthlyOut: sample.sampleMonthlyOut }),
    }
  })
}

export function generateSkuProfiles(seed = 20260603): SkuProfile[] {
  const random = seededRandom(seed)
  return products.flatMap((product) => generateProductSkus(product, random))
}
