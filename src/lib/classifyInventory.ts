import type { ClassificationRecord, LabelChange } from '../data/classification'
import { createInventory, type Inventory } from '../data/demo'
import type { Product } from '../data/products'
import { getMovementLabel } from './rules'

export const classificationSteps = [
  'Meringkas kartu stok & fitur SKU',
  'Mengklasifikasi pola dengan Random Forest Classifier',
  'Memprediksi penjualan bulan depan dengan Random Forest Regressor',
  'Memperbarui rekomendasi & saran pesan',
] as const

export interface SkuFeatureSummary {
  skuId: string
  productId: string
  variant: string
  sizeType: 'huruf' | 'angka'
  totalIncoming: number
  stockFluctuation: number
  maxStock: number
  avgStock: number
  minStock: number
  historyMonths: number
  recognizedByModel: boolean
}

/** Meringkas 8 fitur per SKU dari riwayat kartu stok untuk dikirim ke model Random Forest di backend. */
export function summarizeSkuFeatures(
  inventory: Inventory,
  products: readonly Product[],
): SkuFeatureSummary[] {
  const sizeTypes = new Map(products.map((p) => [p.id, p.sizeType]))
  return inventory.skus.map((sku) => {
    const history = inventory.movementsBySku[sku.id] ?? []
    const stocks = history.length
      ? [history[0].openingStock, ...history.map((m) => m.closingStock)]
      : [sku.stock]
    const stockFluctuation = history.reduce(
      (sum, m) => sum + Math.abs(m.closingStock - m.openingStock),
      0,
    )
    return {
      skuId: sku.id,
      productId: sku.productId,
      variant: sku.variant,
      sizeType: sizeTypes.get(sku.productId) ?? 'angka',
      totalIncoming: sku.totalIncoming,
      stockFluctuation,
      maxStock: Math.max(...stocks),
      avgStock: Math.round(sku.averageStock),
      minStock: Math.min(...stocks),
      historyMonths: sku.historyMonths,
      recognizedByModel: sku.recognizedByModel,
    }
  })
}

export function classifyInventory(inventory: Inventory, products: readonly Product[], {
  at, periodStart, periodEnd, id,
}: Pick<ClassificationRecord, 'at' | 'periodStart' | 'periodEnd' | 'id'>) {
  const medians = new Map(products.map(({ id, median }) => [id, median]))
  const current = new Map(inventory.skus.map((sku) => [sku.id, sku]))
  // Ubah estimasi beberapa SKU di sekitar batas sebagai bagian simulasi model.
  // SKU contoh tetap memakai nilai dari spesifikasi.
  const candidates = inventory.skus.flatMap((sku) => {
    const median = medians.get(sku.productId)
    return median !== undefined && sku.label && sku.sampleMonthlyOut === undefined && sku.recognizedByModel && sku.historyMonths >= 3
      ? [{ sku, median }] : []
  }).sort((a, b) => Math.abs(a.sku.estimatedTotalOut - a.median) - Math.abs(b.sku.estimatedTotalOut - b.median)
    || a.sku.id.localeCompare(b.sku.id))
  const fastCount = inventory.skus.filter(({ label }) => label === 'fast').length
  const fastToSlow = fastCount >= 61 ? 2 : 1
  const selected = [
    ...candidates.filter(({ sku }) => sku.label === 'fast').slice(0, fastToSlow),
    ...candidates.filter(({ sku }) => sku.label === 'slow').slice(0, 3 - fastToSlow),
  ]
  const adjusted = new Map(selected.map(({ sku, median }) => [sku.id, sku.label === 'fast' ? median : median + 1]))
  const profiles = inventory.profiles.map((profile) => {
    const median = medians.get(profile.productId)
    const estimatedTotalOut = adjusted.get(profile.id) ?? profile.estimatedTotalOut
    const label = median === undefined ? null : getMovementLabel(
      estimatedTotalOut, median, current.get(profile.id)?.historyMonths ?? 0, profile.recognizedByModel,
    )
    return { ...profile, estimatedTotalOut, label }
  })
  const updated = createInventory(profiles, inventory.movementsBySku)
  const changes: LabelChange[] = updated.skus.flatMap((sku) => {
    const previous = current.get(sku.id)?.label ?? null
    return previous !== sku.label ? [{ skuId: sku.id, previous, current: sku.label }] : []
  })
  const record: ClassificationRecord = {
    id, at, periodStart, periodEnd, changes,
    fast: updated.skus.filter(({ label }) => label === 'fast').length,
    slow: updated.skus.filter(({ label }) => label === 'slow').length,
  }
  return { inventory: updated, record }
}
