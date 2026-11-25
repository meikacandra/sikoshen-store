import { describe, expect, it } from 'vitest'
import { createInventory, demo } from './demo'
import { generateMovements, getDailyMovements, summarizeMovements } from './movements'
import { FEATURED_SKU_ID, generateSkuProfiles } from './skus'

const { skus, profiles, movementsBySku, monthlyMovements } = demo.inventory

describe('dataset demo', () => {
  it('membentuk 126 SKU unik dengan angka katalog yang sesuai', () => {
    expect(new Set(skus.map(({ id }) => id)).size).toBe(126)
    expect(skus).toHaveLength(126)
    const summary = demo.products.map(({ id }) => {
      const group = skus.filter(({ productId }) => productId === id)
      const estimates = group.map(({ estimatedTotalOut }) => estimatedTotalOut).sort((a, b) => a - b)
      const midpoint = estimates.length / 2
      return {
        count: group.length,
        fast: group.filter(({ label }) => label === 'fast').length,
        slow: group.filter(({ label }) => label === 'slow').length,
        stock: group.reduce((sum, { stock }) => sum + stock, 0),
        median: (estimates[midpoint - 1] + estimates[midpoint]) / 2,
      }
    })
    expect(summary).toEqual([
      { count: 36, fast: 17, slow: 19, stock: 760, median: 610 },
      { count: 52, fast: 26, slow: 26, stock: 1100, median: 480 },
      { count: 38, fast: 18, slow: 20, stock: 570, median: 300 },
    ])
    expect(['restock', 'pantau', 'tahan', 'evaluasi'].map(
      (action) => skus.filter((sku) => sku.action === action).length,
    )).toEqual([9, 52, 51, 14])
    expect(skus.reduce((sum, { stock }) => sum + stock, 0)).toBe(2430)
  })

  it('merekonsiliasi angka pergerakan bulanan dengan stok SKU', () => {
    expect(monthlyMovements).toHaveLength(37)
    expect(monthlyMovements[0].month).toBe('2023-05')
    expect(monthlyMovements.at(-1)).toMatchObject({ month: '2026-05', closingStock: 2430 })
    expect(monthlyMovements.slice(-6).map(({ incoming, outgoing }) => [incoming, outgoing])).toEqual([
      [520, 610], [480, 540], [690, 820], [560, 650], [640, 680], [610, 702],
    ])
    const invalid = skus.flatMap(({ id, stock }) => {
      const series = movementsBySku[id]
      if (series.length !== 37 || series.at(-1)?.closingStock !== stock) return [id]
      return series.flatMap((row, index) => {
        const { openingStock, closingStock, incoming, outgoing } = row
        const valid = [openingStock, closingStock, incoming, outgoing].every((n) => Number.isInteger(n) && n >= 0)
          && openingStock + incoming - outgoing === closingStock
          && (index === 0 || series[index - 1].closingStock === openingStock)
        return valid ? [] : [`${id} ${row.month}`]
      })
    })
    expect(invalid).toEqual([])
  })

  it('mempertahankan riwayat yang ditentukan untuk Kemeja Denim Hitam L', () => {
    const history = movementsBySku[FEATURED_SKU_ID]
    expect(history.reduce((sum, row) => sum + row.outgoing, 0)).toBe(1452)
    expect(history.slice(-6).map(({ openingStock, incoming, outgoing, closingStock }) =>
      [openingStock, incoming, outgoing, closingStock])).toEqual([
      [54, 40, 42, 52], [52, 30, 36, 46], [46, 60, 52, 54],
      [54, 40, 58, 36], [36, 40, 44, 32], [32, 30, 42, 20],
    ])
    expect(getDailyMovements(FEATURED_SKU_ID, history[36])).toEqual([
      { date: '2026-05-02', incoming: 0, outgoing: 3, closingStock: 29 },
      { date: '2026-05-06', incoming: 30, outgoing: 5, closingStock: 54 },
      { date: '2026-05-12', incoming: 0, outgoing: 9, closingStock: 45 },
      { date: '2026-05-18', incoming: 0, outgoing: 11, closingStock: 34 },
      { date: '2026-05-24', incoming: 0, outgoing: 8, closingStock: 26 },
      { date: '2026-05-31', incoming: 0, outgoing: 6, closingStock: 20 },
    ])
  })

  it('menghasilkan rincian harian yang cocok dengan tiap rekap bulanan', () => {
    const invalid = Object.entries(movementsBySku).flatMap(([skuId, history]) =>
      history.flatMap((month) => {
        let stock = month.openingStock
        let incoming = 0
        let outgoing = 0
        const valid = getDailyMovements(skuId, month).every((day) => {
          stock += day.incoming - day.outgoing
          incoming += day.incoming
          outgoing += day.outgoing
          return stock >= 0 && day.closingStock === stock && day.incoming + day.outgoing > 0
        })
        return valid && incoming === month.incoming && outgoing === month.outgoing && stock === month.closingStock
          ? [] : [`${skuId} ${month.month}`]
      }),
    )
    expect(invalid).toEqual([])
  })

  it('menghitung rata-rata dari saldo akhir tiap hari pada 126 SKU', () => {
    const mismatches = skus.filter(({ id, averageStock }) => {
      let stockTotal = 0
      let dayCount = 0
      for (const month of movementsBySku[id]) {
        const [year, monthNumber] = month.month.split('-').map(Number)
        const daysInMonth = new Date(year, monthNumber, 0).getDate()
        const dailyBalances = new Map(getDailyMovements(id, month).map(
          ({ date, closingStock }) => [Number(date.slice(-2)), closingStock],
        ))
        let stock = month.openingStock
        for (let date = 1; date <= daysInMonth; date += 1) {
          stock = dailyBalances.get(date) ?? stock
          stockTotal += stock
          dayCount += 1
        }
      }
      return Math.round(stockTotal / dayCount) !== averageStock
    })
    expect(mismatches.map(({ id }) => id)).toEqual([])
  })

  it('menyembunyikan label dan tindakan untuk SKU yang belum memenuhi syarat', () => {
    const profile = profiles.find(({ id }) => id === FEATURED_SKU_ID)!
    const history = movementsBySku[profile.id]
    expect(createInventory([profile], { [profile.id]: history.slice(-2) }).skus[0]).toMatchObject({
      historyMonths: 2, label: null, action: null,
    })
    expect(createInventory([{ ...profile, recognizedByModel: false }], { [profile.id]: history }).skus[0])
      .toMatchObject({ historyMonths: 37, label: null, action: null })
    expect(createInventory([{ ...profile, label: null }], { [profile.id]: history }).skus[0])
      .toMatchObject({ historyMonths: 37, label: null, action: null })
  })

  it('mengambil saldo dari batas periode saat meringkas beberapa bulan', () => {
    expect(summarizeMovements(monthlyMovements.slice(-6).reverse())).toEqual({
      openingStock: 2932, incoming: 3500, outgoing: 4002, closingStock: 2430,
    })
  })

  it('menyesuaikan transaksi dan stok SKU saat bulan contoh dikoreksi', () => {
    const profile = profiles.find(({ id }) => id === FEATURED_SKU_ID)!
    const history = movementsBySku[profile.id]
    const may = { ...history[36], incoming: 31, closingStock: 21 }
    const correctedHistory = [...history.slice(0, -1), may]
    const daily = getDailyMovements(profile.id, may)
    expect(daily.reduce((sum, day) => sum + day.incoming, 0)).toBe(31)
    expect(daily.reduce((sum, day) => sum + day.outgoing, 0)).toBe(42)
    expect(daily.at(-1)?.closingStock).toBe(21)
    expect(createInventory([profile], { [profile.id]: correctedHistory }).skus[0].stock).toBe(21)
  })

  it('membatasi rata-rata keluar ke 12 bulan kalender terakhir dalam inventaris', () => {
    const sample = profiles.find(({ id }) => id === FEATURED_SKU_ID)!
    const other = profiles.find(({ id }) => id !== FEATURED_SKU_ID)!
    const history = movementsBySku[sample.id]
    const sparse = history.filter(({ month }) => month <= '2025-06' || month === '2026-04')
    const result = createInventory([sample, other], {
      [sample.id]: sparse,
      [other.id]: movementsBySku[other.id],
    })
    const june = history.find(({ month }) => month === '2025-06')!
    const april = history.find(({ month }) => month === '2026-04')!
    expect(result.skus[0].averageMonthlyOut).toBe((june.outgoing + april.outgoing) / 2)
  })

  it.each([2, 5, 9, 10, 30, 35])('menjaga jumlah rekomendasi untuk seed %i', (seed) => {
    const seededProfiles = generateSkuProfiles(seed)
    const result = createInventory(seededProfiles, generateMovements(seededProfiles, seed))
    expect(['restock', 'pantau', 'tahan', 'evaluasi'].map(
      (action) => result.skus.filter((sku) => sku.action === action).length,
    )).toEqual([9, 52, 51, 14])
  })

  it('menghasilkan data yang sama dengan seed yang sama', () => {
    expect(generateSkuProfiles()).toEqual(profiles)
    expect(generateMovements(profiles)).toEqual(movementsBySku)
    expect(generateSkuProfiles(17)).not.toEqual(profiles)
  })

  it('menyimpan riwayat klasifikasi dan unggahan awal', () => {
    expect(demo.classifications[0]).toMatchObject({ fast: 61, slow: 65 })
    expect(demo.classifications[0].changes).toHaveLength(3)
    expect(demo.classifications[1]).toMatchObject({ fast: 60, slow: 66 })
    expect(demo.uploads[0]).toMatchObject({ status: 'berhasil', readyRows: 93977, discardedRows: 702, skuCount: 126 })
    expect(demo.uploads[1]).toMatchObject({ status: 'ditolak' })
  })
})
