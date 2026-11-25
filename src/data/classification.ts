import type { MovementLabel } from '../lib/types'
import { DEMO_PERIOD_END, DEMO_PERIOD_START } from './movements'
import type { SkuProfile } from './skus'

export interface LabelChange {
  skuId: string
  previous: MovementLabel | null
  current: MovementLabel | null
}

export interface ClassificationRecord {
  id: string
  at: Date
  periodStart: Date
  periodEnd: Date
  fast: number
  slow: number
  changes: readonly LabelChange[]
}

export function initialClassification(skus: readonly SkuProfile[]): ClassificationRecord[] {
  const fastSkus = skus.filter(({ label }) => label === 'fast')
  const slowSkus = skus.filter(({ label }) => label === 'slow')
  const changes: LabelChange[] = [
    ...fastSkus.slice(0, 2).map(({ id }) => ({ skuId: id, previous: 'slow', current: 'fast' } as const)),
    ...slowSkus.slice(0, 1).map(({ id }) => ({ skuId: id, previous: 'fast', current: 'slow' } as const)),
  ]
  const addedFast = changes.filter(({ current }) => current === 'fast').length
  const addedSlow = changes.length - addedFast
  return [
    {
      id: 'classification-1', at: new Date(2026, 5, 3, 14, 20),
      periodStart: DEMO_PERIOD_START, periodEnd: DEMO_PERIOD_END,
      fast: fastSkus.length, slow: slowSkus.length, changes,
    },
    {
      id: 'classification-2', at: new Date(2026, 4, 2, 10, 30),
      periodStart: DEMO_PERIOD_START, periodEnd: new Date(2026, 3, 30),
      fast: fastSkus.length - addedFast + addedSlow,
      slow: slowSkus.length - addedSlow + addedFast,
      changes: [],
    },
  ]
}
