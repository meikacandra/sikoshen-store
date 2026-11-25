import { createContext, useContext, useState, type ReactNode } from 'react'
import { useSimulatedProcess } from '../hooks/useSimulatedProcess'
import { apiStartClassification, hydrateBackendState, type ApiRawState } from '../lib/api'
import { classificationSteps, classifyInventory, summarizeSkuFeatures } from '../lib/classifyInventory'
import { useData } from './DataContext'
import { useDemo } from './DemoContext'
import { useToast } from './ToastContext'

interface ClassificationProcessApi {
  status: ReturnType<typeof useSimulatedProcess>['status']
  progress: number
  currentStep: number
  errorCode: string | null
  start: (forceFailure?: boolean) => boolean
  cancel: () => void
}

const ClassificationProcessContext = createContext<ClassificationProcessApi | null>(null)

export function ClassificationProcessProvider({ children }: { children: ReactNode }) {
  const data = useData()
  const demo = useDemo()
  const { toast } = useToast()
  const process = useSimulatedProcess({ steps: classificationSteps, durationMs: 5000 })
  const [errorCode, setErrorCode] = useState<string | null>(null)

  function start(forceFailure = false) {
    const { inventory, products, status, dispatch } = data
    if (!inventory.skus.some((sku) => sku.recognizedByModel && sku.historyMonths >= 3)) return false
    if (process.status === 'running') return false
    const shouldFail = demo.consumeFailure() || forceFailure
    const useLiveBackend = demo.scenario === 'normal'
    const skuFeatures = summarizeSkuFeatures(inventory, products)

    const started = process.start<ApiRawState>({
      forceFailure: shouldFail,
      backendJob: useLiveBackend ? () => apiStartClassification(shouldFail, skuFeatures) : undefined,
      onSuccess: (rawBackendState) => {
        if (rawBackendState) {
          const hydrated = hydrateBackendState(rawBackendState)
          dispatch({ type: 'backend/hydrate', state: hydrated })
          const latestChanges = hydrated.classifications[0]?.changes.length ?? 3
          toast({
            title: 'Klasifikasi selesai',
            description: `${latestChanges} SKU berubah label. Rekomendasi sudah diperbarui.`,
          })
          return
        }
        const at = new Date()
        const result = classifyInventory(inventory, products, {
          at,
          id: `classification-${at.getTime()}`,
          periodStart: status.periodStart,
          periodEnd: status.periodEnd,
        })
        dispatch({ type: 'classification/finished', at, ...result })
        toast({
          title: 'Klasifikasi selesai',
          description: `${result.record.changes.length} SKU berubah label. Rekomendasi sudah diperbarui.`,
        })
      },
      onFailure: (backendErrorCode) => {
        setErrorCode(backendErrorCode || `KLS-${Date.now().toString(36).toUpperCase()}`)
        dispatch({ type: 'classification/stopped' })
        toast({ tone: 'danger', title: 'Klasifikasi gagal', description: 'Tidak ada data yang berubah.' })
      },
    })
    if (started) {
      setErrorCode(null)
      data.dispatch({ type: 'classification/started' })
    }
    return started
  }

  function cancel() {
    if (!process.cancel()) return
    data.dispatch({ type: 'classification/stopped' })
    toast({ tone: 'info', title: 'Klasifikasi dibatalkan' })
  }

  return (
    <ClassificationProcessContext.Provider
      value={{
        status: process.status,
        progress: process.progress,
        currentStep: process.currentStep,
        errorCode,
        start,
        cancel,
      }}
    >
      {children}
    </ClassificationProcessContext.Provider>
  )
}

export function useClassificationProcess() {
  const process = useContext(ClassificationProcessContext)
  if (!process) throw new Error('ClassificationProcessProvider belum dipasang.')
  return process
}
