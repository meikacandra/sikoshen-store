import type { ClassificationRecord } from '../data/classification'
import { createInventory, demo, type Inventory } from '../data/demo'
import type { MonthlyMovement } from '../data/movements'
import type { Product } from '../data/products'
import type { SkuProfile } from '../data/skus'
import type { UploadRecord } from '../data/uploads'
import type { DataStatus, RecommendationReview } from '../context/DataContext'
import type { SaveMode, UploadScenario, csvColumnCheck } from '../data/uploadDemo'
import type { SkuFeatureSummary } from './classifyInventory'

const API_BASES = [
  import.meta.env.VITE_API_URL,
  '/api',
  'http://127.0.0.1:8000/api',
].filter(Boolean) as string[]

let resolvedBase: string | null = null

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const candidates = resolvedBase ? [resolvedBase, ...API_BASES.filter((b) => b !== resolvedBase)] : API_BASES
  let lastError: unknown = null
  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, init)
      if (response.status === 404 && path !== '/health' && base === '/api') {
        continue
      }
      resolvedBase = base
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw Object.assign(new Error(body.detail ?? `HTTP ${response.status}`), { status: response.status, body })
      }
      return (await response.json()) as T
    } catch (err) {
      lastError = err
      if (err && typeof err === 'object' && 'status' in err) {
        throw err
      }
    }
  }
  throw lastError ?? new Error('Backend API tidak terjangkau')
}

export interface ApiRawState {
  status: {
    periodStart: string
    periodEnd: string
    lastUpload: string
    lastClassification: string
    classificationRunning: boolean
  }
  products: Product[]
  model: typeof demo.model | null
  profiles: SkuProfile[]
  movementsBySku: Record<string, MonthlyMovement[]>
  uploads: Array<
    | { id: string; name: string; at: string; status: 'berhasil'; readyRows: number; skuCount: number; discardedRows: number }
    | { id: string; name: string; at: string; status: 'ditolak' | 'gagal'; reason: string }
  >
  classifications: Array<{
    id: string
    at: string
    periodStart: string
    periodEnd: string
    fast: number
    slow: number
    changes: ClassificationRecord['changes']
  }>
  recommendationReviews: Array<{
    id: string
    at: string
    skuIds: string[]
    classificationAt: string
  }>
}

export interface HydratedBackendState {
  status: DataStatus
  inventory: Inventory
  uploads: UploadRecord[]
  classifications: ClassificationRecord[]
  recommendationReviews: RecommendationReview[]
  model: typeof demo.model
}

function parseLocalDate(isoDate: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(isoDate)
}

export function hydrateBackendState(raw: ApiRawState): HydratedBackendState {
  const inventory = createInventory(raw.profiles, raw.movementsBySku)
  const uploads: UploadRecord[] = raw.uploads.map((u) =>
    u.status === 'berhasil'
      ? {
          id: u.id,
          name: u.name,
          at: parseLocalDate(u.at),
          status: 'berhasil',
          readyRows: u.readyRows,
          skuCount: u.skuCount,
          discardedRows: u.discardedRows,
        }
      : {
          id: u.id,
          name: u.name,
          at: parseLocalDate(u.at),
          status: u.status,
          reason: u.reason,
        },
  )
  const classifications: ClassificationRecord[] = raw.classifications.map((c) => ({
    id: c.id,
    at: parseLocalDate(c.at),
    periodStart: parseLocalDate(c.periodStart),
    periodEnd: parseLocalDate(c.periodEnd),
    fast: c.fast,
    slow: c.slow,
    changes: c.changes,
  }))
  const recommendationReviews: RecommendationReview[] = raw.recommendationReviews.map((r) => ({
    id: r.id,
    at: parseLocalDate(r.at),
    skuIds: r.skuIds,
    classificationAt: parseLocalDate(r.classificationAt),
  }))
  return {
    status: {
      periodStart: parseLocalDate(raw.status.periodStart),
      periodEnd: parseLocalDate(raw.status.periodEnd),
      lastUpload: parseLocalDate(raw.status.lastUpload),
      lastClassification: parseLocalDate(raw.status.lastClassification),
      classificationRunning: raw.status.classificationRunning,
    },
    inventory,
    uploads,
    classifications,
    recommendationReviews,
    model: raw.model
      ? {
          ...demo.model,
          ...raw.model,
          crossValidation: {
            ...demo.model.crossValidation,
            ...raw.model.crossValidation,
          },
        }
      : demo.model,
  }
}

export async function apiLogin(email: string, password: string) {
  return requestApi<{ ok: boolean; user: { name: string; email: string; role: 'Owner' } }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function apiFetchState(): Promise<HydratedBackendState> {
  const raw = await requestApi<ApiRawState>('/state')
  return hydrateBackendState(raw)
}

export async function apiResetDemo(): Promise<HydratedBackendState> {
  const raw = await requestApi<ApiRawState>('/demo/reset', { method: 'POST' })
  return hydrateBackendState(raw)
}

export async function apiRecordUploadProblem(type: 'ditolak' | 'gagal', name: string, reason: string): Promise<UploadRecord> {
  const res = await requestApi<{ id: string; name: string; at: string; status: 'ditolak' | 'gagal'; reason: string }>(
    '/uploads/problem',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, reason }),
    },
  )
  return { id: res.id, name: res.name, at: parseLocalDate(res.at), status: res.status, reason: res.reason }
}

export interface JobStatusResponse<R = unknown> {
  id: string
  kind: 'upload_check' | 'classification'
  status: 'running' | 'success' | 'failed' | 'cancelled'
  progress: number
  currentStep: number
  totalSteps: number
  errorCode: string | null
  reason: string | null
  result: R | null
}

export interface UploadCheckJobResult {
  validation: { file: string; columns: ReturnType<typeof csvColumnCheck> } | null
  duplicate: boolean
  summary: {
    convertedRows: number
    readyRows: number
    discardedRows: number
    fixedRows: number
    parsedFileRows: number
  }
  preview: string[][]
}

export async function apiStartUploadCheck(params: {
  files: Array<{ name: string; file?: File }>
  scenario: UploadScenario
  forceFailure: boolean
}): Promise<{ jobId: string }> {
  const form = new FormData()
  form.append('scenario', params.scenario)
  form.append('forceFailure', String(params.forceFailure))
  form.append('fileNamesJson', JSON.stringify(params.files.map((f) => f.name)))
  for (const item of params.files) {
    if (item.file) {
      form.append('files', item.file, item.name)
    }
  }
  return requestApi<{ jobId: string }>('/uploads/check', {
    method: 'POST',
    body: form,
  })
}

export async function apiSaveUpload(params: {
  fileName: string
  saveMode: SaveMode
  readyRows: number
  discardedRows: number
}): Promise<HydratedBackendState> {
  const raw = await requestApi<ApiRawState>('/uploads/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return hydrateBackendState(raw)
}

export async function apiStartClassification(
  forceFailure: boolean,
  skuFeatures?: SkuFeatureSummary[],
): Promise<{ jobId: string }> {
  return requestApi<{ jobId: string }>('/classifications/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceFailure, skuFeatures }),
  })
}

export async function apiGetJobStatus<R = unknown>(jobId: string): Promise<JobStatusResponse<R>> {
  return requestApi<JobStatusResponse<R>>(`/jobs/${encodeURIComponent(jobId)}`)
}

export async function apiCancelJob(jobId: string): Promise<void> {
  await requestApi(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' })
}

export async function apiReviewRecommendations(record: RecommendationReview): Promise<void> {
  await requestApi('/recommendations/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: record.id,
      skuIds: record.skuIds,
      classificationAt: record.classificationAt.toISOString(),
    }),
  })
}

export async function apiUndoRecommendationReview(reviewId: string): Promise<void> {
  await requestApi(`/recommendations/review/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
  })
}
