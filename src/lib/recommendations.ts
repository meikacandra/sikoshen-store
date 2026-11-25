import type { InventorySku } from './inventoryViews'
import type { MovementLabel, StockAction, StockCondition } from './types'

export const actionOrder: readonly StockAction[] = ['restock', 'pantau', 'evaluasi', 'tahan']
export const conditionOrder: readonly StockCondition[] = ['habis', 'bawah', 'normal', 'menumpuk']

export function recommendationReason(sku: InventorySku): string {
  if (!sku.label || !sku.action) return 'SKU ini belum memiliki label pergerakan yang cukup untuk diberi rekomendasi.'
  const movement = sku.label === 'fast' ? 'cepat' : 'lambat'
  const condition = sku.condition === 'habis' ? 'habis' : sku.condition === 'bawah' ? 'di bawah rata-rata stok historis'
    : sku.condition === 'menumpuk' ? 'menumpuk dibanding rata-rata stok historis' : 'normal'
  const action: Record<StockAction, string> = {
    restock: 'Prioritaskan pemeriksaan kebutuhan restock.',
    pantau: 'Pantau perubahan stok dan barang keluar berikutnya.',
    tahan: 'Tahan pembelian tambahan sambil memantau pergerakan.',
    evaluasi: 'Evaluasi penyebab stok menumpuk sebelum membeli lagi.',
  }
  return `Pergerakan ${movement}, stok ${condition} (${sku.stock} unit dibanding rata-rata ${Math.round(sku.averageStock)} unit). Rata-rata keluar ${sku.averageMonthlyOut.toFixed(1)} unit per bulan. ${action[sku.action]}`
}

export function matrixCount(skus: readonly InventorySku[], label: MovementLabel, condition: StockCondition): number {
  return skus.filter((sku) => sku.label === label && sku.condition === condition).length
}

export function sortRecommendations(skus: readonly InventorySku[]): InventorySku[] {
  return [...skus].sort((a, b) => {
    const priority = actionOrder.indexOf(a.action!) - actionOrder.indexOf(b.action!)
    if (priority) return priority
    if (a.action === 'restock' && b.action === 'restock') return a.stock - b.stock || b.averageMonthlyOut - a.averageMonthlyOut
    return a.productName.localeCompare(b.productName, 'id') || a.id.localeCompare(b.id, 'id')
  })
}
