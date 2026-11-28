export interface Sku {
  product: string
  variant: string
  size: string
  label: 'fast' | 'slow'
  stock: number
  predicted_next_month: number | null
  rmse_sku: number | null
  safety_stock: number | null
  suggested_order: number | null
  prediction_month: string
}

export interface Forecast {
  id?: number
  source: string
  period_end: string
  season: string
  daily_rows: number | null
  model_version?: string
  z?: number
  cap?: number | null
  rows: Sku[]
}

export interface MasterSku {
  Jenis_Produk: string
  Varian: string
  Ukuran: string
  Ukuran_Urut: number
  Total_Keluar: number
  Threshold_Median: number
  Label: 'Fast-Moving' | 'Slow-Moving'
  Peluang_Fast: number
}

export interface ProductCatalogItem {
  name: string
  variants: string[]
  sizes: string[]
}

export interface AttentionRow {
  produk: string
  varian: string
  ukuran: string
  terjual: number
  median: number
  label: 'Fast' | 'Slow'
  peluang: number
  temuan: 'Lebih laku dari pola' | 'Kurang laku dari pola'
  dekat_median: boolean
  tindakan: string
}

export interface MonthlySalesPoint {
  ym: string
  ihu: number
  denim: number
  tjb: number
  totals?: Record<string, number>
  ramadan: boolean
}

export interface ValidationFileSummary {
  name: string
  products: string[]
  sku_count: number
  period_start: string
  period_end: string
  rows: number
}

export interface UnrecordedPeriod {
  produk: string
  dari: string
  sampai: string
  lama_hari: number
}

export interface ValidationReport {
  total_rows: number
  total_skus: number
  period_start: string
  period_end: string
  files: ValidationFileSummary[]
  balance_checked: boolean
  balance_match_count: number
  balance_total_count: number
  negative_stock_rows: number
  negative_stock_skus: number
  opname_events: number
  opname_skus: number
  opname_plus: number
  opname_minus: number
  unrecorded_periods: UnrecordedPeriod[]
}

export interface ModelMeta {
  versi_model: string
  dilatih_pada?: string
  sumber_data?: string
  periode_data?: [string, string]
  bulan_data_terakhir?: string
  bulan_prediksi?: string
  jumlah_sku?: number
  jumlah_baris_latih_regresi?: number
  aturan_label?: string
  /** Akurasi klasifikasi hasil nested cross-validation di penelitian (persen). */
  akurasi_penelitian?: { akurasi: number; sd: number; roc_auc: number }
  evaluasi_klasifikasi?: {
    akurasi_out_of_fold?: number
    catatan?: string
  }
  evaluasi_regresi_bergulir?: {
    'Random Forest'?: { MAE: number; RMSE: number; WAPE: number }
    'Baseline rata 6 bln'?: { MAE: number; RMSE: number; WAPE: number }
    'Baseline bulan lalu'?: { MAE: number; RMSE: number; WAPE: number }
    bulan_uji?: [string, string]
  }
  versi_library?: Record<string, string>
}

export interface SkuIdentity {
  product: string
  variant: string
  size: string
}

export interface ImportScopeSummary {
  source: string
  period_start: string | null
  period_end: string
  prediction_month: string
  season: string
  daily_rows: number | null
  total_skus: number
  product_counts: Record<string, number>
  total_predicted: number
  total_stock: number
  total_order: number
  files?: ValidationFileSummary[]
}

export interface ProductBreakdownItem {
  product: string
  current_count: number
  candidate_count: number
  missing_count: number
  added_count: number
  status: 'hilang' | 'berkurang' | 'baru' | 'bertambah' | 'tetap'
}

export interface ImportPreviewResponse {
  preview_id: string
  base_revision: string
  is_first_import: boolean
  has_scope_reduction: boolean
  requires_extra_confirmation: boolean
  current: ImportScopeSummary | null
  candidate: ImportScopeSummary
  retained_sku_count: number
  missing_sku_count: number
  added_sku_count: number
  missing_products: string[]
  affected_products: ProductBreakdownItem[]
  product_breakdown: ProductBreakdownItem[]
  missing_skus: SkuIdentity[]
  added_skus: SkuIdentity[]
  validation: ValidationReport
}

export interface RestoreInfo {
  available: boolean
  saved_at: string
  source: string
  period_end: string
  prediction_month: string
  season: string
  total_skus: number
  product_counts: Record<string, number>
}

export interface ModelMasterResponse {
  rows: MasterSku[]
  meta: ModelMeta
  z_default: number
  ramadan_max_year: number
  products: ProductCatalogItem[]
  attention: AttentionRow[]
  monthly_sales: MonthlySalesPoint[] | null
  validation: ValidationReport | null
  restore_info: RestoreInfo | null
  active_revision?: string
}

export interface PeluangFastResponse {
  probability: number
  known: boolean
  product_known: boolean
  variant_known: boolean
  in_training_master: boolean
  /** 'out_of_fold' untuk SKU yang sudah dijual (sama dengan Peta Pola), 'model' untuk kombinasi baru. */
  probability_source?: 'out_of_fold' | 'model'
  /** Label sebenarnya (aturan median saat model dilatih) jika SKU sudah pernah dijual. */
  actual_label?: string | null
  avg_variant: number | null
  avg_size: number | null
  warning: string | null
}

export interface KlasifikasiRow {
  product: string
  variant: string
  size: string
  total_out: number
  median: number
  label: 'fast' | 'slow'
  peluang_fast: number | null
}

export interface ResearchMetrics {
  sumber: string
  klasifikasi: {
    catatan: string
    perbandingan: Array<{
      model: string; akurasi: number; sd: number; precision: number; recall: number; f1: number; rocAuc: number
      jenis: 'ml' | 'dipilih' | 'pembanding'
    }>
    confusionMatrix: { actualSlow: { slow: number; fast: number }; actualFast: { slow: number; fast: number } }
    permutationImportance: Array<{ feature: string; value: number }>
    akurasiVarianBaru: number
    akurasiOutOfFold: number
    setelan: Record<string, number | null>
  }
}

export interface KlasifikasiResponse {
  basis: string
  source: string
  period_end: string | null
  thresholds: Record<string, number>
  fast: number
  slow: number
  rows: KlasifikasiRow[]
  model: { version: string; oof_accuracy: number | null; params: Record<string, unknown> | null; features: string[] }
  research: ResearchMetrics
}

export interface EvaluationMethodMetrics {
  n: number
  mae: number | null
  wape_pct: number | null
  total_actual: number
  total_abs_error: number
}

export interface EvaluationRow {
  product: string
  variant: string
  size: string
  rf_prediction: number | null
  baseline_6m: number | null
  actual: number | null
  rf_diff: number | null
  rf_abs_error: number | null
  baseline_diff: number | null
  baseline_abs_error: number | null
  suggested_order: number | null
  stock_at_prediction: number | null
  status: 'evaluated' | 'missing_data' | 'incomplete_recording' | 'no_prediction'
  reason: string | null
  coverage: number | null
  had_stockout: boolean
  stockout_days: number
  stockout_pct: number
}

export interface EvaluationMonthReport {
  snapshot_id: number
  target_month: string
  data_period_end: string
  season: 'biasa' | 'lebaran'
  model_version: string
  source: string
  created_at: string
  is_primary: boolean
  has_actuals: boolean
  total_snapshot_skus: number
  evaluated_count: number
  zero_sales_count: number
  excluded_missing_count: number
  excluded_incomplete_count: number
  excluded_no_prediction_count: number
  stockout_count: number
  rf: EvaluationMethodMetrics
  baseline_6m: EvaluationMethodMetrics
  rf_beats_baseline: boolean | null
  top_errors: EvaluationRow[]
  rows: EvaluationRow[]
}

export interface EvaluationSeasonSummary {
  evaluated_months: number
  rf: EvaluationMethodMetrics
  baseline_6m: EvaluationMethodMetrics
  rf_beats_baseline: boolean | null
}

export interface EvaluationResearchReference {
  period: [string, string]
  rf_mae: number
  rf_wape_pct: number
  baseline_6m_mae: number
  baseline_6m_wape_pct: number
  unseen_variant_accuracy_pct: number
  note: string
}

export interface EvaluationResponse {
  research_reference: EvaluationResearchReference
  has_evaluated_months: boolean
  overall: {
    evaluated_months: number
    rf: EvaluationMethodMetrics
    baseline_6m: EvaluationMethodMetrics
    rf_beats_baseline: boolean | null
  }
  by_season: {
    biasa: EvaluationSeasonSummary
    lebaran: EvaluationSeasonSummary
  }
  months: EvaluationMonthReport[]
}

export const formatWape = (wapePct: number | null | undefined): string =>
  wapePct === null || wapePct === undefined ? 'Tidak tersedia' : `${decimal1Fmt.format(wapePct)}%`

export const formatMae = (mae: number | null | undefined): string =>
  mae === null || mae === undefined ? '—' : `${decimal1Fmt.format(mae)} unit`

export const formatSignedDiff = (diff: number | null | undefined): string => {
  if (diff === null || diff === undefined) return '—'
  if (Math.abs(diff) < 0.05) return '0'
  const sign = diff > 0 ? '+' : '−'
  const absVal = Math.abs(diff)
  const text = Number.isInteger(absVal) ? numberFmt.format(absVal) : decimal1Fmt.format(absVal)
  return `${sign}${text}`
}

export const SUPPORTED_STOCK_EXTENSIONS = ['.xlsx', '.csv'] as const

export function isSupportedStockFileName(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return SUPPORTED_STOCK_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function validateStockFileSelection<T extends { name: string }>(files: readonly T[]): {
  valid: T[]
  unsupported: T[]
  errorMessage: string | null
} {
  const valid: T[] = []
  const unsupported: T[] = []
  for (const file of files) {
    if (isSupportedStockFileName(file.name)) {
      valid.push(file)
    } else {
      unsupported.push(file)
    }
  }
  if (unsupported.length > 0) {
    const names = unsupported.map((f) => f.name).join(', ')
    return {
      valid,
      unsupported,
      errorMessage: `Format berkas tidak didukung: ${names}. Gunakan berkas berformat .xlsx atau .csv.`,
    }
  }
  return { valid, unsupported, errorMessage: null }
}

export const numberFmt = new Intl.NumberFormat('id-ID')
export const decimal1Fmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const decimal2Fmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const qty = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : numberFmt.format(Math.round(n))

export const monthName = (ym: string): string =>
  new Date(ym + '-01T12:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

export const shortMonthOnly = (ym: string): string =>
  new Date(ym + '-01T12:00:00').toLocaleDateString('id-ID', { month: 'long' })

export const dateName = (ymd: string): string =>
  new Date(ymd + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export const shortDateName = (ymd: string): string =>
  new Date(ymd + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export const shortProduct = (name: string): string =>
  name === 'Tony Jack Biasa' ? 'Tony Jack' : name === 'Iron Head Ultimate' ? 'Iron Head' : name

export const Z_OPTIONS = [
  { label: '90%', z: 1.28, zText: '1,28' },
  { label: '95%', z: 1.65, zText: '1,65' },
  { label: '98%', z: 2.05, zText: '2,05' },
] as const

export const DEFAULT_Z_INDEX = 1 // 95% (Z = 1,65)

export const POLA_INSIGHTS: Record<string, string[]> = {
  'Iron Head Ultimate': [
    'Varian stone grey mendominasi penjualan di seluruh ukuran (28–38), sedangkan ash gray dan royal blue paling kuat pada ukuran 28–33.',
    'Varian ice blue cenderung lambat di semua ukuran; batasi pembelian hanya untuk pelengkap seri.',
    'Ukuran besar (35–38) pada ash gray dan royal blue turun tajam dibanding ukuran 28–33.',
  ],
  'Kemeja Denim': [
    'Kemeja lengan pendek (Pendek Abu dan Pendek Navy) jauh lebih laris dibanding lengan panjang di seluruh ukuran M hingga XXXXL.',
    'Kemeja lengan panjang (Panjang Abu, Hitam, Navy) cenderung lambat pada ukuran M–XL dan belum pernah dijual pada ukuran jumbo (XXL–XXXXL).',
    'Pada Pendek Hitam, ukuran M–XL memiliki peluang jauh lebih baik dibanding ukuran XXL ke atas.',
  ],
  'Tony Jack Biasa': [
    'Ukuran 28–33 pada Biru Muda Wash, Biru Tua Wash, Hitam, dan Hitam Wash merupakan tulang punggung penjualan.',
    'Mulai ukuran 34 ke atas (34–38), penjualan melambat di hampir semua warna kecuali Biru Tua Wash yang bertahan hingga ukuran 37.',
    'Varian Abu Tua bergerak lambat di seluruh rentang ukuran (28–38); hindari pemesanan berlebih pada warna ini.',
  ],
}

export function filterForecastRows(rows: readonly Sku[], productFilter = 'Semua'): Sku[] {
  const filtered =
    !productFilter || productFilter === 'Semua' ? [...rows] : rows.filter((r) => r.product === productFilter)
  return filtered.sort(
    (a, b) =>
      (b.suggested_order ?? -1) - (a.suggested_order ?? -1) ||
      (b.predicted_next_month ?? -1) - (a.predicted_next_month ?? -1) ||
      a.product.localeCompare(b.product) ||
      a.variant.localeCompare(b.variant) ||
      a.size.localeCompare(b.size),
  )
}

/**
 * Meringkas total KPI (Fast/Slow, total prediksi, total stok, total saran pesan)
 * langsung dari baris hasil backend agar Beranda dan Saran Pemesanan selalu identik.
 */
export function summarizeForecastRows(rows: readonly Sku[]) {
  const fastCount = rows.filter((r) => r.label === 'fast').length
  const slowCount = rows.length - fastCount
  const predictedRows = rows.filter((r) => r.predicted_next_month !== null)
  const unpredictedCount = rows.length - predictedRows.length
  const totalPred = predictedRows.reduce((sum, r) => sum + Math.round(r.predicted_next_month ?? 0), 0)
  const totalStock = rows.reduce((sum, r) => sum + Math.round(r.stock), 0)
  const totalOrder = rows.reduce((sum, r) => sum + Math.round(r.suggested_order ?? 0), 0)
  return {
    totalSkus: rows.length,
    fastCount,
    slowCount,
    unpredictedCount,
    totalPred,
    totalStock,
    totalOrder,
  }
}

export function summarizeProductCards(rows: readonly Sku[]) {
  const productNames = Array.from(new Set(rows.map((r) => r.product))).sort()
  return productNames.map((name) => {
    const productRows = filterForecastRows(rows, name)
    const summary = summarizeForecastRows(productRows)
    const chip =
      summary.totalStock < summary.totalPred
        ? 'Stok di bawah perkiraan penjualan'
        : summary.totalStock > summary.totalPred * 1.5
          ? 'Stok menumpuk di sebagian SKU'
          : 'Isi ulang SKU laris yang kosong'
    const chipClass = summary.totalStock < summary.totalPred ? 'chip-s' : 'chip-n'
    return {
      name,
      chip,
      chipClass,
      totalPred: summary.totalPred,
      totalStock: summary.totalStock,
      totalOrder: summary.totalOrder,
    }
  })
}

export function buildLiveMasterMap(master: readonly MasterSku[]): Map<string, [number, number]> {
  return new Map<string, [number, number]>(
    master.map((m) => [
      `${m.Jenis_Produk}|${m.Varian}|${String(m.Ukuran).replace(/\.0$/, '')}`,
      [Number(m.Peluang_Fast), Number(m.Total_Keluar)],
    ]),
  )
}

export function heatColor(p: number): { bg: string; fg: string; bd: string } {
  const clamped = Math.max(0, Math.min(1, p))
  let r: number
  let g: number
  let b: number
  if (clamped < 0.5) {
    const t = clamped / 0.5
    r = Math.round(194 + (243 - 194) * t)
    g = Math.round(65 + (241 - 65) * t)
    b = Math.round(12 + (236 - 12) * t)
  } else {
    const t = (clamped - 0.5) / 0.5
    r = Math.round(243 + (29 - 243) * t)
    g = Math.round(241 + (78 - 241) * t)
    b = Math.round(236 + (216 - 236) * t)
  }
  const fg = clamped <= 0.22 || clamped >= 0.72 ? '#FFFFFF' : '#17212B'
  return { bg: `rgb(${r}, ${g}, ${b})`, fg, bd: '1px solid transparent' }
}
