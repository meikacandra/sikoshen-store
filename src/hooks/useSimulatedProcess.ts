import { useCallback, useEffect, useRef, useState } from 'react'
import { apiCancelJob, apiGetJobStatus, type JobStatusResponse } from '../lib/api'

type ProcessStatus = 'idle' | 'running' | 'success' | 'failed' | 'cancelled'

export interface RunOptions<R = unknown> {
  forceFailure?: boolean
  backendJob?: () => Promise<{ jobId: string }>
  onSuccess?: (result?: R) => void
  onFailure?: (errorCode?: string | null, reason?: string | null) => void
}

export function useSimulatedProcess({ steps, durationMs, failRate = 0 }: {
  steps: readonly string[]
  durationMs: number
  failRate?: number
}) {
  const [state, setState] = useState<{ status: ProcessStatus; progress: number; backendStep?: number }>({
    status: 'idle',
    progress: 0,
  })
  const timer = useRef<number>()
  const activeJobId = useRef<string | null>(null)
  const lastRun = useRef<RunOptions<unknown>>()

  const stop = useCallback(() => {
    window.clearInterval(timer.current)
    timer.current = undefined
  }, [])

  useEffect(() => stop, [stop])

  const startLocalSimulation = useCallback(<R,>(options: RunOptions<R>) => {
    const shouldFail = options.forceFailure === true || (failRate > 0 && Math.random() < failRate)
    const started = performance.now()
    timer.current = window.setInterval(() => {
      const progress = Math.min(100, (performance.now() - started) / durationMs * 100)
      if (shouldFail && progress >= 64) {
        stop()
        setState({ status: 'failed', progress })
        options.onFailure?.()
      } else if (progress >= 100) {
        stop()
        setState({ status: 'success', progress: 100 })
        options.onSuccess?.()
      } else {
        setState({ status: 'running', progress })
      }
    }, 80)
  }, [durationMs, failRate, stop])

  const start = useCallback(<R = unknown,>(options: RunOptions<R> = {}) => {
    if (timer.current !== undefined || activeJobId.current !== null) return false
    lastRun.current = options as RunOptions<unknown>
    setState({ status: 'running', progress: 0 })

    if (options.backendJob) {
      activeJobId.current = 'starting'
      options
        .backendJob()
        .then(({ jobId }) => {
          if (activeJobId.current === null) {
            void apiCancelJob(jobId).catch(() => {})
            return
          }
          activeJobId.current = jobId
          timer.current = window.setInterval(async () => {
            if (!activeJobId.current || activeJobId.current === 'starting') return
            try {
              const job: JobStatusResponse<R> = await apiGetJobStatus<R>(activeJobId.current)
              if (job.status === 'cancelled') {
                stop()
                activeJobId.current = null
                setState({ status: 'cancelled', progress: 0 })
              } else if (job.status === 'failed') {
                stop()
                activeJobId.current = null
                setState({ status: 'failed', progress: job.progress, backendStep: job.currentStep })
                options.onFailure?.(job.errorCode, job.reason)
              } else if (job.status === 'success') {
                stop()
                activeJobId.current = null
                setState({ status: 'success', progress: 100, backendStep: steps.length - 1 })
                options.onSuccess?.(job.result ?? undefined)
              } else {
                setState({ status: 'running', progress: job.progress, backendStep: job.currentStep })
              }
            } catch {
              // Abaikan gangguan jaringan sesaat saat polling
            }
          }, 140)
        })
        .catch(() => {
          // Fallback ke simulasi lokal apabila backend sedang tidak aktif (mis. mode demo offline)
          activeJobId.current = null
          startLocalSimulation(options)
        })
      return true
    }

    startLocalSimulation(options)
    return true
  }, [startLocalSimulation, steps.length, stop])

  const cancel = useCallback(() => {
    if (timer.current === undefined && activeJobId.current === null) return false
    stop()
    const currentJob = activeJobId.current
    activeJobId.current = null
    if (currentJob && currentJob !== 'starting') {
      void apiCancelJob(currentJob).catch(() => {})
    }
    setState({ status: 'cancelled', progress: 0 })
    return true
  }, [stop])

  const retry = useCallback(
    () => (lastRun.current ? start({ ...lastRun.current, forceFailure: false }) : false),
    [start],
  )

  const currentStep =
    state.backendStep !== undefined
      ? Math.min(steps.length - 1, state.backendStep)
      : Math.min(steps.length - 1, Math.floor((state.progress / 100) * steps.length))

  return { status: state.status, progress: state.progress, currentStep, start, cancel, retry }
}
