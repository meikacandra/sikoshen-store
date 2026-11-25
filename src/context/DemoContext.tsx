import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildDemoDataset, type DemoScenario } from '../data/demoScenarios'
import { apiFetchState, apiResetDemo } from '../lib/api'
import { defaultDemoSettings, readDemoSettings, writeDemoSettings, type DemoSettings } from '../lib/demoSettings'
import { useData } from './DataContext'

interface DemoApi extends DemoSettings {
  setScenario: (scenario: DemoScenario) => void
  setFailNext: (value: boolean) => void
  /** Mengembalikan true sekali bila proses berikutnya harus gagal, lalu mematikan opsi itu. */
  consumeFailure: () => boolean
  reset: () => void
}

const DemoCtx = createContext<DemoApi | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useData()
  const [settings, setSettings] = useState<DemoSettings>(readDemoSettings)
  const failRef = useRef(settings.failNext)

  useEffect(() => {
    failRef.current = settings.failNext
    writeDemoSettings(settings)
  }, [settings])

  const setScenario = useCallback((scenario: DemoScenario) => {
    dispatch({ type: 'demo/load', dataset: buildDemoDataset(scenario) })
    setSettings((current) => ({ ...current, scenario }))
    if (scenario === 'normal') {
      void apiFetchState()
        .then((hydrated) => dispatch({ type: 'backend/hydrate', state: hydrated }))
        .catch(() => {})
    }
  }, [dispatch])

  const setFailNext = useCallback((failNext: boolean) => {
    failRef.current = failNext
    setSettings((current) => ({ ...current, failNext }))
  }, [])

  const consumeFailure = useCallback(() => {
    if (!failRef.current) return false
    failRef.current = false
    setSettings((current) => ({ ...current, failNext: false }))
    return true
  }, [])

  const reset = useCallback(() => {
    failRef.current = false
    dispatch({ type: 'demo/load', dataset: buildDemoDataset('normal') })
    setSettings(defaultDemoSettings)
    void apiResetDemo()
      .then((hydrated) => dispatch({ type: 'backend/hydrate', state: hydrated }))
      .catch(() => {})
  }, [dispatch])

  const api = useMemo(() => ({ ...settings, setScenario, setFailNext, consumeFailure, reset }),
    [settings, setScenario, setFailNext, consumeFailure, reset])
  return <DemoCtx.Provider value={api}>{children}</DemoCtx.Provider>
}

export function useDemo(): DemoApi {
  const ctx = useContext(DemoCtx)
  if (!ctx) throw new Error('useDemo harus dipakai di dalam <DemoProvider>')
  return ctx
}
