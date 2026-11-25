import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from './demoScenarios'

describe('skenario Mode Demo', () => {
  it('normal tetap 126 SKU dengan 61/65', () => {
    const { inventory } = buildDemoDataset('normal')
    expect(inventory.skus).toHaveLength(126)
    expect(inventory.skus.filter((sku) => sku.label === 'fast')).toHaveLength(61)
    expect(inventory.skus.filter((sku) => sku.label === 'slow')).toHaveLength(65)
  })

  it('belum ada data mengosongkan SKU, unggahan, dan klasifikasi', () => {
    const data = buildDemoDataset('kosong')
    expect(data.inventory.skus).toHaveLength(0)
    expect(data.inventory.monthlyMovements).toHaveLength(0)
    expect(data.uploads).toHaveLength(0)
    expect(data.classifications).toHaveLength(0)
  })

  it('SKU baru: 3 SKU tanpa label karena riwayat < 3 bulan', () => {
    const { inventory } = buildDemoDataset('sku-baru')
    const unlabeled = inventory.skus.filter((sku) => !sku.label)
    expect(inventory.skus).toHaveLength(129)
    expect(unlabeled).toHaveLength(3)
    expect(unlabeled.every((sku) => sku.recognizedByModel && sku.historyMonths === 2 && sku.action === null)).toBe(true)
  })

  it('varian baru: 3 SKU belum dikenali model meski riwayat cukup', () => {
    const { inventory } = buildDemoDataset('varian-baru')
    const unknown = inventory.skus.filter((sku) => !sku.recognizedByModel)
    expect(unknown).toHaveLength(3)
    expect(unknown.every((sku) => sku.historyMonths >= 3 && sku.label === null)).toBe(true)
    expect(inventory.skus.filter((sku) => sku.label)).toHaveLength(126)
  })

  it('data lebih baru: unggahan terakhir sesudah klasifikasi terakhir', () => {
    const data = buildDemoDataset('belum-terbaru')
    expect(data.lastUpload.getTime()).toBeGreaterThan(data.lastClassification.getTime())
    expect(data.inventory.monthlyMovements.at(-1)?.month).toBe('2026-06')
  })
})
