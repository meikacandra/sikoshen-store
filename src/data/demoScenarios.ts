import type { ClassificationRecord } from './classification'
import { createInventory, demo, type Inventory } from './demo'
import type { MonthKey, MonthlyMovement } from './movements'
import { DEMO_PERIOD_END, DEMO_PERIOD_START } from './movements'
import type { SkuProfile } from './skus'
import { applyDemoUpload, demoPeriodEnd } from './uploadDemo'
import type { UploadRecord } from './uploads'

export type DemoScenario = 'normal' | 'kosong' | 'sku-baru' | 'varian-baru' | 'belum-terbaru'

export const demoScenarios: ReadonlyArray<{ value: DemoScenario; label: string; description: string }> = [
  { value: 'normal', label: 'Normal', description: '126 SKU, semua sudah diklasifikasikan.' },
  { value: 'kosong', label: 'Belum ada data', description: 'Belum ada kartu stok yang diunggah.' },
  { value: 'sku-baru', label: 'SKU baru belum diklasifikasikan', description: '3 SKU baru dengan riwayat kurang dari 3 bulan.' },
  { value: 'varian-baru', label: 'Varian baru belum dikenali model', description: 'Varian warna baru yang belum pernah dilatih.' },
  { value: 'belum-terbaru', label: 'Data lebih baru dari hasil klasifikasi', description: 'Kartu stok Juni sudah diunggah, klasifikasi belum dijalankan ulang.' },
]

export function isDemoScenario(value: unknown): value is DemoScenario {
  return demoScenarios.some((item) => item.value === value)
}

export interface DemoDataset {
  inventory: Inventory
  uploads: readonly UploadRecord[]
  classifications: readonly ClassificationRecord[]
  periodStart: Date
  periodEnd: Date
  lastUpload: Date
  lastClassification: Date
}

/** Riwayat singkat untuk SKU tambahan. Bulan berurutan dan saldo selalu nonnegatif. */
function shortHistory(months: readonly MonthKey[], opening: number, flows: ReadonlyArray<readonly [number, number]>): MonthlyMovement[] {
  let stock = opening
  return months.map((month, index) => {
    const [incoming, outgoing] = flows[index % flows.length]
    const openingStock = stock
    stock = Math.max(0, openingStock + incoming - outgoing)
    return { month, openingStock, incoming, outgoing: openingStock + incoming - stock, closingStock: stock }
  })
}

function extraProfile(id: string, productId: string, variant: string, size: string, stock: number, recognizedByModel: boolean): SkuProfile {
  return { id, productId, variant, size, stock, averageStockTarget: stock, estimatedTotalOut: 0, label: null, recognizedByModel }
}

function withExtraSkus(extra: ReadonlyArray<{ profile: SkuProfile; history: MonthlyMovement[] }>): Inventory {
  const base = demo.inventory
  return createInventory(
    [...base.profiles, ...extra.map(({ profile }) => profile)],
    { ...base.movementsBySku, ...Object.fromEntries(extra.map(({ profile, history }) => [profile.id, history])) },
  )
}

const baseDataset: DemoDataset = {
  inventory: demo.inventory,
  uploads: demo.uploads,
  classifications: demo.classifications,
  periodStart: DEMO_PERIOD_START,
  periodEnd: DEMO_PERIOD_END,
  lastUpload: demo.uploads[0].at,
  lastClassification: demo.classifications[0].at,
}

export function buildDemoDataset(scenario: DemoScenario): DemoDataset {
  switch (scenario) {
    case 'normal':
      return baseDataset
    case 'kosong':
      return { ...baseDataset, inventory: createInventory([], {}), uploads: [], classifications: [] }
    case 'sku-baru': {
      // Kombinasi yang sebelumnya tidak dijual. Varian sudah dikenal, tetapi riwayat baru 2 bulan.
      const months: MonthKey[] = ['2026-04', '2026-05']
      const inventory = withExtraSkus([
        { profile: extraProfile('TJB-COKELAT-28', 'TJB', 'Cokelat', '28', 10, true), history: shortHistory(months, 0, [[12, 3], [4, 3]]) },
        { profile: extraProfile('TJB-COKELAT-38', 'TJB', 'Cokelat', '38', 8, true), history: shortHistory(months, 0, [[10, 2], [2, 2]]) },
        { profile: extraProfile('TJB-KREM-28', 'TJB', 'Krem', '28', 9, true), history: shortHistory(months, 0, [[12, 4], [3, 2]]) },
      ])
      return { ...baseDataset, inventory }
    }
    case 'varian-baru': {
      // Riwayat cukup, tetapi varian warna belum ada di data latih model.
      const months: MonthKey[] = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']
      const inventory = withExtraSkus(['M', 'L', 'XL'].map((size, index) => ({
        profile: extraProfile(`KMJDENIM-HIJAU-ARMY-${size}`, 'KMJDENIM', 'Hijau Army', size, 0, false),
        history: shortHistory(months, 0, [[14 + index * 2, 6], [6, 7 + index], [8, 6]]),
      })))
      return { ...baseDataset, inventory }
    }
    case 'belum-terbaru': {
      const at = new Date(2026, 6, 1, 9, 10)
      const inventory = applyDemoUpload(demo.inventory, 'june')
      const record: UploadRecord = {
        id: 'upload-demo-juni', name: 'Kartu stok Juni 2026 (3 file)', at, status: 'berhasil',
        readyRows: 2814, discardedRows: 12, skuCount: inventory.skus.length,
      }
      return { ...baseDataset, inventory, uploads: [record, ...demo.uploads], periodEnd: demoPeriodEnd, lastUpload: at }
    }
  }
}
