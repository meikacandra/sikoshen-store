import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { ClassificationRecord } from '../data/classification'
import { demo, type Inventory } from '../data/demo'
import { buildDemoDataset, type DemoDataset } from '../data/demoScenarios'
import { apiFetchState, type HydratedBackendState } from '../lib/api'
import { readDemoSettings } from '../lib/demoSettings'
import type { UploadRecord } from '../data/uploads'

export interface DataStatus {
  periodStart: Date
  periodEnd: Date
  lastUpload: Date
  lastClassification: Date
  classificationRunning: boolean
}

type Action =
  | { type: 'demo/load'; dataset: DemoDataset }
  | { type: 'backend/hydrate'; state: HydratedBackendState }
  | { type: 'upload/saved'; at: Date; periodEnd?: Date; record?: UploadRecord; inventory?: Inventory }
  | { type: 'upload/recorded'; record: UploadRecord }
  | { type: 'classification/started' }
  | { type: 'classification/finished'; at: Date; record?: ClassificationRecord; inventory?: Inventory }
  | { type: 'classification/stopped' }
  | { type: 'recommendation/reviewed'; record: RecommendationReview }
  | { type: 'recommendation/undone'; id: string }

interface DataState {
  status: DataStatus
  inventory: Inventory
  uploads: readonly UploadRecord[]
  classifications: readonly ClassificationRecord[]
  recommendationReviews: readonly RecommendationReview[]
  model: typeof demo.model
}

export interface RecommendationReview {
  id: string
  at: Date
  skuIds: readonly string[]
  classificationAt: Date
}

function fromDataset(dataset: DemoDataset): DataState {
  return {
    inventory: dataset.inventory,
    uploads: dataset.uploads,
    classifications: dataset.classifications,
    recommendationReviews: [],
    model: demo.model,
    status: {
      periodStart: dataset.periodStart,
      periodEnd: dataset.periodEnd,
      lastUpload: dataset.lastUpload,
      lastClassification: dataset.lastClassification,
      classificationRunning: false,
    },
  }
}

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case 'demo/load':
      return fromDataset(action.dataset)
    case 'backend/hydrate':
      return {
        status: action.state.status,
        inventory: action.state.inventory,
        uploads: action.state.uploads,
        classifications: action.state.classifications,
        recommendationReviews: action.state.recommendationReviews,
        model: action.state.model,
      }
    case 'upload/recorded':
      return { ...state, uploads: [action.record, ...state.uploads] }
    case 'upload/saved':
      return {
        ...state,
        inventory: action.inventory ?? state.inventory,
        uploads: action.record ? [action.record, ...state.uploads] : state.uploads,
        status: { ...state.status, lastUpload: action.record?.at ?? action.at, periodEnd: action.periodEnd ?? state.status.periodEnd },
      }
    case 'classification/started':
      return { ...state, status: { ...state.status, classificationRunning: true } }
    case 'classification/finished':
      return {
        ...state,
        inventory: action.inventory ?? state.inventory,
        classifications: action.record ? [action.record, ...state.classifications] : state.classifications,
        status: { ...state.status, classificationRunning: false, lastClassification: action.record?.at ?? action.at },
      }
    case 'classification/stopped':
      return { ...state, status: { ...state.status, classificationRunning: false } }
    case 'recommendation/reviewed':
      return { ...state, recommendationReviews: [action.record, ...state.recommendationReviews] }
    case 'recommendation/undone':
      return { ...state, recommendationReviews: state.recommendationReviews.filter((record) => record.id !== action.id) }
  }
}

interface DataApi extends DataState {
  products: typeof demo.products
  dispatch: (a: Action) => void
}

const DataCtx = createContext<DataApi | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => fromDataset(buildDemoDataset(readDemoSettings().scenario)))

  useEffect(() => {
    if (readDemoSettings().scenario !== 'normal') return
    let active = true
    apiFetchState()
      .then((hydrated) => {
        if (active) dispatch({ type: 'backend/hydrate', state: hydrated })
      })
      .catch(() => {
        // Tetap gunakan dataset lokal bila server API belum dinyalakan
      })
    return () => {
      active = false
    }
  }, [])

  const api = useMemo(() => ({ ...state, products: demo.products, dispatch }), [state])
  return <DataCtx.Provider value={api}>{children}</DataCtx.Provider>
}

export function useData(): DataApi {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData harus dipakai di dalam <DataProvider>')
  return ctx
}
