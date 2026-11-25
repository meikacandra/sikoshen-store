import { isDemoScenario, type DemoScenario } from '../data/demoScenarios'
import { readStorage, removeStorage, writeStorage } from './storage'

const KEY = 'sikoshen.demo'

export interface DemoSettings {
  scenario: DemoScenario
  failNext: boolean
}

export const defaultDemoSettings: DemoSettings = { scenario: 'normal', failNext: false }

export function readDemoSettings(): DemoSettings {
  const raw = readStorage<Partial<DemoSettings> | null>(KEY, null)
  if (!raw || typeof raw !== 'object') return defaultDemoSettings
  return {
    scenario: isDemoScenario(raw.scenario) ? raw.scenario : 'normal',
    failNext: raw.failNext === true,
  }
}

export function writeDemoSettings(settings: DemoSettings): void {
  if (settings.scenario === 'normal' && !settings.failNext) removeStorage(KEY)
  else writeStorage(KEY, settings)
}
