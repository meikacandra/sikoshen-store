import { describe, expect, it } from 'vitest'
import { demo } from '../data/demo'
import { getDailyMovements } from '../data/movements'
import { FEATURED_SKU_ID } from '../data/skus'
import { applyDemoUpload, csvColumnCheck, duplicatePreview, stockColumns, uploadIssues } from '../data/uploadDemo'
import { classifyInventory } from './classifyInventory'

describe('alur kartu stok dan klasifikasi', () => {
  it('memeriksa kolom CSV berformat Indonesia dan mencatat kolom yang hilang', () => {
    const fullHeader = stockColumns.map((column) => `"${column}"`).join(';')
    expect(csvColumnCheck(`\uFEFF${fullHeader}`).every((column) => column.present)).toBe(true)
    expect(csvColumnCheck('Tanggal,Jenis Produk,Varian_Warna,Ukuran,Barang_Masuk').filter(({ present }) => !present)
      .map(({ name }) => name)).toEqual(['Barang_Keluar', 'Stok_Akhir'])
  })

  it('mencocokkan isi daftar masalah dengan jumlah pemeriksaan', () => {
    const issues = uploadIssues()
    expect(issues.filter(({ status }) => status === 'Dibuang')).toHaveLength(702)
    expect(issues.filter(({ status }) => status === 'Diperbaiki')).toHaveLength(1642)
    expect(issues.filter(({ status }) => status === 'Diabaikan')).toHaveLength(21)
  })

  it('menambahkan Juni tanpa mengubah saldo Mei ketika memilih Juni saja', () => {
    const result = applyDemoUpload(demo.inventory, 'june')
    expect(result.skus).toHaveLength(126)
    expect(result.monthlyMovements).toHaveLength(38)
    expect(result.monthlyMovements.at(-2)).toEqual(demo.inventory.monthlyMovements.at(-1))
    expect(result.monthlyMovements.at(-1)).toMatchObject({ month: '2026-06', openingStock: 2430 })
  })

  it('mengganti transaksi bertanggal sama, menyambung saldo Juni, dan tidak menduplikasi koreksi', () => {
    expect(duplicatePreview(demo.inventory).map(({ outgoing, closingStock }) => [outgoing, closingStock])).toEqual([[6, 20], [10, 16]])
    const result = applyDemoUpload(demo.inventory, 'replace')
    const [may, june] = result.movementsBySku[FEATURED_SKU_ID].slice(-2)
    expect(may).toMatchObject({ outgoing: 46, closingStock: 16 })
    expect(getDailyMovements(FEATURED_SKU_ID, may).at(-1)).toMatchObject({ date: '2026-05-31', outgoing: 10, closingStock: 16 })
    expect(june.openingStock).toBe(16)
    expect(applyDemoUpload(result, 'replace').movementsBySku[FEATURED_SKU_ID]).toEqual(result.movementsBySku[FEATURED_SKU_ID])
    expect(demo.inventory.movementsBySku[FEATURED_SKU_ID].at(-1)?.closingStock).toBe(20)
  })

  it('memperbarui tepat tiga label berbeda pada setiap klasifikasi demo setelah unggah', () => {
    const input = applyDemoUpload(demo.inventory, 'june')
    const metadata = { id: 'test', at: new Date(2026, 6, 1), periodStart: new Date(2023, 4, 1), periodEnd: new Date(2026, 5, 30) }
    const first = classifyInventory(input, demo.products, metadata)
    const second = classifyInventory(first.inventory, demo.products, { ...metadata, id: 'test-2' })
    expect(first.record).toMatchObject({ fast: 60, slow: 66 })
    expect(second.record).toMatchObject({ fast: 61, slow: 65 })
    for (const result of [first, second]) {
      expect(new Set(result.record.changes.map((row) => row.skuId)).size).toBe(3)
      for (const change of result.record.changes) {
        const row = result.inventory.skus.find(({ id }) => id === change.skuId)!
        const group = demo.products.find(({ id }) => id === row.productId)!
        expect(row.label).toBe(row.estimatedTotalOut > group.median ? 'fast' : 'slow')
        expect(row.label).toBe(change.current)
        expect(row.label).not.toBe(change.previous)
      }
    }
    expect(first.inventory.skus.find(({ id }) => id === FEATURED_SKU_ID)?.estimatedTotalOut).toBe(1480)
  })
})
