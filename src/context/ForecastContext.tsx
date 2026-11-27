import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import type {
  AttentionRow,
  EvaluationResponse,
  Forecast,
  ImportPreviewResponse,
  MasterSku,
  ModelMasterResponse,
  ModelMeta,
  MonthlySalesPoint,
  PeluangFastResponse,
  ProductCatalogItem,
  RestoreInfo,
  ValidationReport,
} from '../lib/planner'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface ForecastContextValue {
  data: Forecast | null
  master: MasterSku[]
  modelMeta: ModelMeta | null
  products: ProductCatalogItem[]
  attention: AttentionRow[]
  monthlySales: MonthlySalesPoint[] | null
  validation: ValidationReport | null
  restoreInfo: RestoreInfo | null
  evaluation: EvaluationResponse | null
  ramadanMaxYear: number | null
  loading: boolean
  error: string
  notice: string
  busy: boolean
  setError: (msg: string) => void
  setNotice: (msg: string) => void
  load: () => Promise<void>
  fetchForecast: (params?: { z?: number; cap?: number | null }) => Promise<Forecast>
  checkCombination: (produk: string, varian: string, ukuran: string) => Promise<PeluangFastResponse>
  previewImport: (files: File[]) => Promise<{ preview: ImportPreviewResponse | null; error: string | null }>
  commitImport: (previewId: string, confirmScopeReduction: boolean) => Promise<{ ok: boolean; conflict?: boolean }>
  cancelImportPreview: (previewId: string) => Promise<void>
  restorePreviousForecast: () => Promise<boolean>
}

const ForecastCtx = createContext<ForecastContextValue | null>(null)

export function ForecastProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [data, setData] = useState<Forecast | null>(null)
  const [master, setMaster] = useState<MasterSku[]>([])
  const [modelMeta, setModelMeta] = useState<ModelMeta | null>(null)
  const [products, setProducts] = useState<ProductCatalogItem[]>([])
  const [attention, setAttention] = useState<AttentionRow[]>([])
  const [monthlySales, setMonthlySales] = useState<MonthlySalesPoint[] | null>(null)
  const [validation, setValidation] = useState<ValidationReport | null>(null)
  const [restoreInfo, setRestoreInfo] = useState<RestoreInfo | null>(null)
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [ramadanMaxYear, setRamadanMaxYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const apiJson = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      let response: Response
      try {
        response = await fetch(url, init)
      } catch {
        throw new ApiError(
          'Tidak dapat terhubung ke server backend. Pastikan server backend aktif lalu coba lagi.',
          0,
        )
      }
      if (response.status === 401) {
        logout()
        throw new ApiError('Silakan masuk kembali.', 401)
      }
      const rawText = await response.text().catch(() => '')
      let result: Record<string, unknown> = {}
      if (rawText) {
        try {
          result = JSON.parse(rawText) as Record<string, unknown>
        } catch {
          result = {}
        }
      }
      if (!response.ok) {
        let message = ''
        if (typeof result.detail === 'string' && result.detail.trim()) {
          message = result.detail.trim()
        } else if (Array.isArray(result.detail) && result.detail.length > 0) {
          message = result.detail
            .map((item) =>
              typeof item === 'object' && item !== null && 'msg' in item
                ? String((item as { msg: unknown }).msg)
                : String(item),
            )
            .join('; ')
        } else if (rawText && !rawText.trim().startsWith('<')) {
          message = `${rawText.trim().slice(0, 200)} (HTTP ${response.status})`
        } else {
          message = `Permintaan gagal diproses oleh server (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
        }
        throw new ApiError(message, response.status)
      }
      return result as T
    },
    [logout],
  )

  const applyMasterPayload = useCallback((payload: ModelMasterResponse) => {
    setMaster(payload.rows ?? [])
    setModelMeta(payload.meta ?? null)
    setProducts(payload.products ?? [])
    setAttention(payload.attention ?? [])
    setMonthlySales(payload.monthly_sales ?? null)
    setValidation(payload.validation ?? null)
    setRestoreInfo(payload.restore_info ?? null)
    setRamadanMaxYear(payload.ramadan_max_year ?? null)
  }, [])

  const loadMaster = useCallback(async () => {
    const payload = await apiJson<ModelMasterResponse>('/api/model/master')
    applyMasterPayload(payload)
  }, [apiJson, applyMasterPayload])

  const loadEvaluation = useCallback(async () => {
    const payload = await apiJson<EvaluationResponse>('/api/evaluation')
    setEvaluation(payload)
  }, [apiJson])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [fcRes, masterRes, evalRes] = await Promise.allSettled([
        apiJson<Forecast>('/api/forecast'),
        apiJson<ModelMasterResponse>('/api/model/master'),
        apiJson<EvaluationResponse>('/api/evaluation'),
      ])
      if (masterRes.status === 'fulfilled') {
        applyMasterPayload(masterRes.value)
      }
      if (evalRes.status === 'fulfilled') {
        setEvaluation(evalRes.value)
      }
      if (fcRes.status === 'fulfilled') {
        setData(fcRes.value)
      } else {
        setData(null)
        const msg = fcRes.reason instanceof Error ? fcRes.reason.message : 'Prediksi belum bisa dimuat.'
        setError(msg)
      }
      if (masterRes.status === 'rejected' && fcRes.status === 'fulfilled') {
        const msg = masterRes.reason instanceof Error ? masterRes.reason.message : 'Metadata model belum bisa dimuat.'
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [apiJson, applyMasterPayload])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const fetchForecast = useCallback(
    async (params?: { z?: number; cap?: number | null }) => {
      const search = new URLSearchParams()
      if (params?.z !== undefined) search.set('z', String(params.z))
      if (params?.cap !== undefined && params.cap !== null && params.cap > 0) {
        search.set('cap', String(Math.floor(params.cap)))
      }
      const query = search.toString()
      return apiJson<Forecast>(`/api/forecast${query ? `?${query}` : ''}`)
    },
    [apiJson],
  )

  const checkCombination = useCallback(
    async (produk: string, varian: string, ukuran: string) => {
      const search = new URLSearchParams({ produk, varian, ukuran })
      return apiJson<PeluangFastResponse>(`/api/model/peluang-fast?${search.toString()}`)
    },
    [apiJson],
  )

  const previewImport = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        const msg = 'Pilih minimal satu berkas kartu stok (.xlsx atau .csv) terlebih dahulu.'
        return { preview: null, error: msg }
      }
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const body = new FormData()
        files.forEach((f) => body.append('files', f))
        const dataPreview = await apiJson<ImportPreviewResponse>('/api/forecast/import/preview', {
          method: 'POST',
          body,
        })
        return { preview: dataPreview, error: null }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Kartu stok gagal divalidasi untuk pratinjau.'
        return { preview: null, error: msg }
      } finally {
        setBusy(false)
      }
    },
    [apiJson],
  )

  const commitImport = useCallback(
    async (previewId: string, confirmScopeReduction: boolean) => {
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const updated = await apiJson<Forecast>('/api/forecast/import/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preview_id: previewId,
            confirm_scope_reduction: confirmScopeReduction,
          }),
        })
        setData(updated)
        await Promise.allSettled([loadMaster(), loadEvaluation()])
        setNotice('Impor berhasil diterapkan. Riwayat stok dan prediksi bulan depan kini aktif.')
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Impor gagal diterapkan.'
        const conflict = e instanceof ApiError && e.status === 409
        setError(msg)
        return { ok: false, conflict }
      } finally {
        setBusy(false)
      }
    },
    [apiJson, loadMaster, loadEvaluation],
  )

  const cancelImportPreview = useCallback(
    async (previewId: string) => {
      try {
        await apiJson(`/api/forecast/import/preview/${encodeURIComponent(previewId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Abaikan jika pratinjau sudah dihapus atau tidak ditemukan
      }
    },
    [apiJson],
  )

  const restorePreviousForecast = useCallback(async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const restored = await apiJson<Forecast>('/api/forecast/restore', { method: 'POST' })
      setData(restored)
      await Promise.allSettled([loadMaster(), loadEvaluation()])
      setNotice('Hasil aktif sebelumnya berhasil dipulihkan beserta metadata validasi dan riwayatnya.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulihkan hasil sebelumnya.')
      return false
    } finally {
      setBusy(false)
    }
  }, [apiJson, loadMaster, loadEvaluation])

  const value = useMemo(
    () => ({
      data,
      master,
      modelMeta,
      products,
      attention,
      monthlySales,
      validation,
      restoreInfo,
      evaluation,
      ramadanMaxYear,
      loading,
      error,
      notice,
      busy,
      setError,
      setNotice,
      load,
      fetchForecast,
      checkCombination,
      previewImport,
      commitImport,
      cancelImportPreview,
      restorePreviousForecast,
    }),
    [
      data,
      master,
      modelMeta,
      products,
      attention,
      monthlySales,
      validation,
      restoreInfo,
      evaluation,
      ramadanMaxYear,
      loading,
      error,
      notice,
      busy,
      load,
      fetchForecast,
      checkCombination,
      previewImport,
      commitImport,
      cancelImportPreview,
      restorePreviousForecast,
    ],
  )

  return <ForecastCtx.Provider value={value}>{children}</ForecastCtx.Provider>
}

export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastCtx)
  if (!ctx) throw new Error('useForecast harus dipakai di dalam <ForecastProvider>')
  return ctx
}
