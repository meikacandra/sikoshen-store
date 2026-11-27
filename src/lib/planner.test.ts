import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MENU_ITEMS } from '../layout/menu'
import {
  filterForecastRows,
  formatMae,
  formatSignedDiff,
  formatWape,
  summarizeForecastRows,
  summarizeProductCards,
  validateStockFileSelection,
  type Sku,
} from './planner'

function loadReferenceSkus(): Sku[] {
  const csvPath = path.resolve(__dirname, '../../backend/models/prediksi_bulan_depan.csv')
  const lines = fs.readFileSync(csvPath, 'utf-8').trim().split(/\r?\n/)
  const headers = lines[0].split(',')
  const idx = (name: string) => headers.indexOf(name)

  return lines.slice(1).map((line) => {
    const cols = line.split(',')
    return {
      product: cols[idx('Jenis_Produk')],
      variant: cols[idx('Varian')],
      size: cols[idx('Ukuran')],
      label: cols[idx('Label')] === 'Fast-Moving' ? 'fast' : 'slow',
      stock: Number(cols[idx('Stok_Saat_Ini')]),
      predicted_next_month: Number(cols[idx('Prediksi_Penjualan')]),
      rmse_sku: Number(cols[idx('RMSE_SKU')]),
      safety_stock: Number(cols[idx('Stok_Pengaman')]),
      suggested_order: Number(cols[idx('Saran_Pesan')]),
      prediction_month: cols[idx('Bulan')],
    }
  })
}

describe('konsistensi ringkasan Beranda dan Saran Pemesanan dari output backend', () => {
  const skus = loadReferenceSkus()

  it('memuat 6 menu navigasi utama sesuai urutan mockup', () => {
    expect(MENU_ITEMS.map((m) => m.id)).toEqual([
      'beranda',
      'unggah-data',
      'saran-pemesanan',
      'peta-pola',
      'cek-kombinasi',
      'perlu-perhatian',
    ])
  })

  it('menghasilkan ringkasan Beranda dan Saran Pemesanan yang identik (62 Fast, 1.829 prediksi, 2.095 stok, 2.206 saran pesan)', () => {
    const sorted = filterForecastRows(skus)
    const summary = summarizeForecastRows(sorted)

    expect(summary.totalSkus).toBe(126)
    expect(summary.fastCount).toBe(62)
    expect(summary.slowCount).toBe(64)
    expect(summary.unpredictedCount).toBe(0)
    expect(summary.totalPred).toBe(1829)
    expect(summary.totalStock).toBe(2095)
    expect(summary.totalOrder).toBe(2206)
  })

  it('menghasilkan rincian per produk di Beranda yang jumlahnya sama persis dengan filter di Saran Pemesanan', () => {
    const cards = summarizeProductCards(skus)
    expect(cards).toEqual([
      {
        name: 'Iron Head Ultimate',
        chip: 'Stok di bawah perkiraan penjualan',
        chipClass: 'chip-s',
        totalPred: 431,
        totalStock: 226,
        totalOrder: 822,
      },
      {
        name: 'Kemeja Denim',
        chip: 'Stok menumpuk di sebagian SKU',
        chipClass: 'chip-n',
        totalPred: 306,
        totalStock: 714,
        totalOrder: 220,
      },
      {
        name: 'Tony Jack Biasa',
        chip: 'Isi ulang SKU laris yang kosong',
        chipClass: 'chip-n',
        totalPred: 1092,
        totalStock: 1155,
        totalOrder: 1164,
      },
    ])

    for (const card of cards) {
      const filtered = summarizeForecastRows(filterForecastRows(skus, card.name))
      expect(filtered.totalPred).toBe(card.totalPred)
      expect(filtered.totalStock).toBe(card.totalStock)
      expect(filtered.totalOrder).toBe(card.totalOrder)
    }
  })

  it('menangani SKU yang belum cukup riwayat (predicted_next_month = null) tanpa mengubahnya menjadi angka palsu', () => {
    const withMissing: Sku[] = [
      ...skus.slice(0, 2),
      {
        product: 'Iron Head Ultimate',
        variant: 'ash gray',
        size: '29',
        label: 'slow',
        stock: 5,
        predicted_next_month: null,
        rmse_sku: 4.5,
        safety_stock: 8,
        suggested_order: null,
        prediction_month: '2026-06',
      },
    ]
    const summary = summarizeForecastRows(withMissing)
    expect(summary.totalSkus).toBe(3)
    expect(summary.unpredictedCount).toBe(1)
  })

  it('memformat MAE, WAPE (termasuk tidak tersedia saat aktual total 0), dan selisih bertanda dengan benar', () => {
    expect(formatWape(null)).toBe('Tidak tersedia')
    expect(formatWape(40)).toBe('40,0%')
    expect(formatMae(2.67)).toBe('2,7 unit')
    expect(formatMae(null)).toBe('—')
    expect(formatSignedDiff(4)).toBe('+4')
    expect(formatSignedDiff(-3.5)).toBe('−3,5')
    expect(formatSignedDiff(0)).toBe('0')
    expect(formatSignedDiff(null)).toBe('—')
  })

  it('memvalidasi ekstensi berkas kartu stok (.xlsx dan .csv) serta menolak format tidak didukung', () => {
    const ok = validateStockFileSelection([{ name: 'iron head ultimate.xlsx' }, { name: 'HARIAN.CSV' }])
    expect(ok.errorMessage).toBeNull()
    expect(ok.valid).toHaveLength(2)
    expect(ok.unsupported).toHaveLength(0)

    const bad = validateStockFileSelection([{ name: 'iron.xlsx' }, { name: 'catatan.pdf' }, { name: 'foto.png' }])
    expect(bad.unsupported).toHaveLength(2)
    expect(bad.errorMessage).toContain('catatan.pdf, foto.png')
    expect(bad.errorMessage).toContain('.xlsx')
    expect(bad.errorMessage).toContain('.csv')
  })
})
