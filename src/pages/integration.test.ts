import { describe, expect, it } from 'vitest'
import { demo } from '../data/demo'
import { buildDemoDataset, demoScenarios } from '../data/demoScenarios'
import { DEMO_HISTORY_MONTHS, FEATURED_SKU_ID } from '../data/skus'
import { classifyInventory } from '../lib/classifyInventory'
import { matrixCount, sortRecommendations } from '../lib/recommendations'
import { reportData } from '../lib/reports'

describe('Pengujian Komprehensif Seluruh Persyaratan Sikoshen Store', () => {
  const { inventory, products, model, uploads, classifications } = demo

  describe('1. Integritas Katalog & Mock Data', () => {
    it('memiliki 3 jenis produk dengan total 126 SKU', () => {
      expect(products).toHaveLength(3)
      expect(inventory.skus).toHaveLength(126)

      const denim = inventory.skus.filter((s) => s.productId === 'KMJDENIM')
      const tj = inventory.skus.filter((s) => s.productId === 'TJB')
      const ihu = inventory.skus.filter((s) => s.productId === 'IHU')

      expect(denim).toHaveLength(36)
      expect(tj).toHaveLength(52)
      expect(ihu).toHaveLength(38)
    })

    it('memiliki proporsi Fast (61) dan Slow (65) sesuai target tiap produk', () => {
      const fast = inventory.skus.filter((s) => s.label === 'fast')
      const slow = inventory.skus.filter((s) => s.label === 'slow')

      expect(fast).toHaveLength(61)
      expect(slow).toHaveLength(65)

      // Kemeja Denim: 17 Fast, 19 Slow
      expect(inventory.skus.filter((s) => s.productId === 'KMJDENIM' && s.label === 'fast')).toHaveLength(17)
      expect(inventory.skus.filter((s) => s.productId === 'KMJDENIM' && s.label === 'slow')).toHaveLength(19)

      // Tony Jack Biasa: 26 Fast, 26 Slow
      expect(inventory.skus.filter((s) => s.productId === 'TJB' && s.label === 'fast')).toHaveLength(26)
      expect(inventory.skus.filter((s) => s.productId === 'TJB' && s.label === 'slow')).toHaveLength(26)

      // Iron Head Ultimate: 18 Fast, 20 Slow
      expect(inventory.skus.filter((s) => s.productId === 'IHU' && s.label === 'fast')).toHaveLength(18)
      expect(inventory.skus.filter((s) => s.productId === 'IHU' && s.label === 'slow')).toHaveLength(20)
    })

    it('total stok adalah 2.430 unit dengan rincian per produk tepat', () => {
      const totalStock = inventory.skus.reduce((sum, s) => sum + s.stock, 0)
      expect(totalStock).toBe(2430)

      const denimStock = inventory.skus.filter((s) => s.productId === 'KMJDENIM').reduce((sum, s) => sum + s.stock, 0)
      const tjStock = inventory.skus.filter((s) => s.productId === 'TJB').reduce((sum, s) => sum + s.stock, 0)
      const ihuStock = inventory.skus.filter((s) => s.productId === 'IHU').reduce((sum, s) => sum + s.stock, 0)

      expect(denimStock).toBe(760)
      expect(tjStock).toBe(1100)
      expect(ihuStock).toBe(570)
    })

    it('memiliki jumlah tindakan persediaan tepat: 9, 52, 51, 14', () => {
      const counts = {
        restock: inventory.skus.filter((s) => s.action === 'restock').length,
        pantau: inventory.skus.filter((s) => s.action === 'pantau').length,
        tahan: inventory.skus.filter((s) => s.action === 'tahan').length,
        evaluasi: inventory.skus.filter((s) => s.action === 'evaluasi').length,
      }
      expect(counts.restock).toBe(9)
      expect(counts.pantau).toBe(52)
      expect(counts.tahan).toBe(51)
      expect(counts.evaluasi).toBe(14)
    })
  })

  describe('2. Detail SKU Unggulan (KMJDENIM-HITAM-L)', () => {
    it('memiliki data riwayat bulanan dan harian persis sesuai spesifikasi', () => {
      const sku = inventory.skus.find((s) => s.id === FEATURED_SKU_ID)!
      expect(sku).toBeDefined()
      expect(sku.stock).toBe(20)
      expect(sku.averageStock).toBe(38)
      expect(sku.averageMonthlyOut).toBe(41)
      expect(sku.estimatedTotalOut).toBe(1480)
      expect(sku.label).toBe('fast')
      expect(sku.condition).toBe('bawah')
      expect(sku.action).toBe('restock')

      const history = inventory.movementsBySku[FEATURED_SKU_ID]
      expect(history).toHaveLength(DEMO_HISTORY_MONTHS)

      // Total keluar aktual Mei 2023–Mei 2026: 1.452 unit
      const totalOut = history.reduce((sum, r) => sum + r.outgoing, 0)
      expect(totalOut).toBe(1452)
    })
  })

  describe('3. Model Machine Learning Metadata', () => {
    it('memiliki parameter dan performa model yang sesuai', () => {
      expect(model.algorithm).toBe('Random Forest Regressor')
      expect(model.trees).toBe(100)
      expect(model.maxDepth).toBe(10)
      expect(model.trainSkuCount).toBe(100)
      expect(model.testSkuCount).toBe(26)
      expect(model.correctLabels).toBe(25)
      expect(model.accuracyPercent).toBeCloseTo(96.15, 2)
      expect(model.fastRecall).toBe(1.00)
      expect(model.slowRecall).toBe(0.92)
      expect(model.crossValidation.averagePercent).toBe(90.79)
      expect(model.crossValidation.standardDeviationPercent).toBe(5.79)
      expect(model.confusionMatrix).toEqual({
        actualSlow: { slow: 12, fast: 1 },
        actualFast: { slow: 0, fast: 13 },
      })
      expect(model.featureImportance).toHaveLength(8)
      expect(model.featureImportance[0].feature).toBe('Total barang masuk')
      expect(model.featureImportance[0].value).toBe(0.27)
      expect(model.featureImportanceNoLeakage).toHaveLength(7)
      expect(model.featureImportanceNoLeakage[0].feature).toBe('Naik-turun stok')
      expect(model.mae).toBe('66,19 unit')
    })
  })

  describe('4. Riwayat Awal Unggahan dan Klasifikasi', () => {
    it('memiliki 2 riwayat unggahan awal', () => {
      expect(uploads).toHaveLength(2)
      expect(uploads[0].status).toBe('berhasil')
      if (uploads[0].status === 'berhasil') {
        expect(uploads[0].readyRows).toBe(93977)
        expect(uploads[0].skuCount).toBe(126)
        expect(uploads[0].discardedRows).toBe(702)
      }
      expect(uploads[1].status).toBe('ditolak')
    })

    it('memiliki 2 riwayat klasifikasi awal', () => {
      expect(classifications).toHaveLength(2)
      expect(classifications[0]).toMatchObject({ fast: 61, slow: 65 })
      expect(classifications[0].changes).toHaveLength(3)
      expect(classifications[1]).toMatchObject({ fast: 60, slow: 66 })
    })
  })

  describe('5. Alur Klasifikasi & Rekomendasi Persediaan', () => {
    it('menjalankan simulasi klasifikasi dengan pembaruan label yang valid', () => {
      const at = new Date(2026, 5, 4)
      const res = classifyInventory(inventory, products, {
        id: 'new-run',
        at,
        periodStart: new Date(2023, 4, 1),
        periodEnd: new Date(2026, 4, 31),
      })
      expect(res.record.changes).toHaveLength(3)
      expect(res.record.fast + res.record.slow).toBe(126)
    })

    it('mengurutkan rekomendasi berdasarkan prioritas urgensi tindakan', () => {
      const sorted = sortRecommendations(inventory.skus)
      const actions = sorted.map((s) => s.action)

      // Semua restock harus muncul sebelum pantau, lalu evaluasi, lalu tahan
      const firstRestock = actions.indexOf('restock')
      const firstPantau = actions.indexOf('pantau')
      const firstEvaluasi = actions.indexOf('evaluasi')
      const firstTahan = actions.indexOf('tahan')

      expect(firstRestock).toBeLessThan(firstPantau)
      expect(firstPantau).toBeLessThan(firstEvaluasi)
      expect(firstEvaluasi).toBeLessThan(firstTahan)
    })

    it('menghitung matriks label x kondisi stok', () => {
      const matrix = {
        fastHabis: matrixCount(inventory.skus, 'fast', 'habis'),
        fastBawah: matrixCount(inventory.skus, 'fast', 'bawah'),
        fastNormal: matrixCount(inventory.skus, 'fast', 'normal'),
        fastMenumpuk: matrixCount(inventory.skus, 'fast', 'menumpuk'),
      }
      // Prioritaskan restock = fast + (habis atau bawah) = 9
      expect(matrix.fastHabis + matrix.fastBawah).toBe(9)
    })
  })

  describe('6. Laporan (Pergerakan, Masuk, Keluar)', () => {
    it('mengelompokkan per jenis produk dengan saldo awal + masuk - keluar = saldo akhir', () => {
      const report = reportData(inventory, '2025-12', '2026-05', '', '', 'produk')
      expect(report.rows).toHaveLength(3)
      expect(report.skuCount).toBe(126)

      for (const row of report.rows) {
        expect(row.openingStock + row.incoming - row.outgoing).toBe(row.closingStock)
      }

      expect(report.totals.openingStock + report.totals.incoming - report.totals.outgoing).toBe(report.totals.closingStock)
      expect(report.totals.closingStock).toBe(2430)
    })

    it('mengelompokkan per bulan dengan benar', () => {
      const report = reportData(inventory, '2025-12', '2026-05', '', '', 'bulan')
      expect(report.rows).toHaveLength(6)
      const mayRow = report.rows.find((r) => r.key === '2026-05')
      expect(mayRow?.incoming).toBe(610)
      expect(mayRow?.outgoing).toBe(702)
      expect(mayRow?.closingStock).toBe(2430)
    })
  })

  describe('7. Mode Demo & Kondisi Khusus', () => {
    it('semua 5 skenario demo tersedia dan terdefinisi dengan jelas', () => {
      expect(demoScenarios).toHaveLength(5)
      const values = demoScenarios.map((s) => s.value)
      expect(values).toEqual(['normal', 'kosong', 'sku-baru', 'varian-baru', 'belum-terbaru'])
    })

    it('skenario kosong mengembalikan empty dataset tanpa crash', () => {
      const kosong = buildDemoDataset('kosong')
      expect(kosong.inventory.skus).toHaveLength(0)
      expect(kosong.uploads).toHaveLength(0)
      expect(kosong.classifications).toHaveLength(0)
    })

    it('skenario sku-baru memunculkan banner SKU belum diklasifikasikan', () => {
      const skuBaru = buildDemoDataset('sku-baru')
      const unclassified = skuBaru.inventory.skus.filter((s) => !s.label)
      expect(unclassified).toHaveLength(3)
      expect(unclassified.every((s) => s.historyMonths < 3)).toBe(true)
    })

    it('skenario varian-baru memunculkan SKU yang tidak dikenali model', () => {
      const varianBaru = buildDemoDataset('varian-baru')
      const unrec = varianBaru.inventory.skus.filter((s) => !s.recognizedByModel)
      expect(unrec).toHaveLength(3)
    })

    it('skenario belum-terbaru memiliki waktu unggah lebih baru dari klasifikasi', () => {
      const stale = buildDemoDataset('belum-terbaru')
      expect(stale.lastUpload.getTime()).toBeGreaterThan(stale.lastClassification.getTime())
    })
  })
})
