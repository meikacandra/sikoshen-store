import { describe, expect, it } from 'vitest'
import { demo } from '../data/demo'
import { formatStockCoverage, getMovementLabel, getStockAction, getStockCondition } from './rules'

describe('aturan stok dan label', () => {
  it.each([
    ['KMJDENIM-HITAM-L', 20, 38, 41, 1480, 'fast', 'bawah', 'restock'],
    ['KMJDENIM-HITAM-XL', 0, 22, 28, 1010, 'fast', 'habis', 'restock'],
    ['TJB-HITAM-32', 14, 30, 35, 1260, 'fast', 'bawah', 'restock'],
    ['IHU-NAVY-31', 26, 24, 18, 650, 'fast', 'normal', 'pantau'],
    ['TJB-KREM-36', 9, 12, 3, 110, 'slow', 'bawah', 'tahan'],
    ['KMJDENIM-BIRU-MUDA-XXXXL', 34, 18, 2, 75, 'slow', 'menumpuk', 'evaluasi'],
    ['IHU-ABU-38', 15, 14, 1, 40, 'slow', 'normal', 'tahan'],
  ] as const)('%s sesuai dengan contoh', (id, stock, averageStock, averageMonthlyOut, estimatedTotalOut, label, condition, action) => {
    expect(demo.inventory.skus.find((sku) => sku.id === id)).toMatchObject({
      stock, averageStock, averageMonthlyOut, estimatedTotalOut, label, condition, action,
    })
  })

  it('menerapkan batas kondisi stok secara inklusif', () => {
    expect(getStockCondition(0, 0)).toBe('habis')
    expect(getStockCondition(10, 10)).toBe('normal')
    expect(getStockCondition(14, 10)).toBe('normal')
    expect(getStockCondition(15, 10)).toBe('menumpuk')
    expect(getStockAction('fast', 'menumpuk')).toBe('pantau')
    expect(getStockAction('slow', 'habis')).toBe('tahan')
  })

  it('memerlukan riwayat yang cukup dan SKU yang dikenali model', () => {
    expect(getMovementLabel(611, 610, 2, true)).toBeNull()
    expect(getMovementLabel(611, 610, 3, false)).toBeNull()
    expect(getMovementLabel(610, 610, 3, true)).toBe('slow')
    expect(getMovementLabel(611, 610, 3, true)).toBe('fast')
    expect(getStockAction(null, 'habis')).toBeNull()
  })

  it('menampilkan kecukupan stok dengan format Indonesia', () => {
    expect(formatStockCoverage(20, 41)).toBe('0,5 bulan')
    expect(formatStockCoverage(0, 41)).toBe('0,0 bulan')
    expect(formatStockCoverage(20, 0)).toBe('—')
  })
})
