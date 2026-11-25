import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'
import { Button, ProgressBar } from '../ui'
import { cn } from '../../lib/cn'

export function ProcessProgress({ steps, progress, currentStep, onCancel }: {
  steps: readonly string[]
  progress: number
  currentStep: number
  onCancel: () => void
}) {
  return (
    <div className="space-y-5">
      <div role="status" aria-live="polite" className="font-semibold">{steps[currentStep]}…</div>
      <ProgressBar label="Progres proses" value={progress} />
      <ol className="grid gap-2">
        {steps.map((step, index) => {
          const complete = index < currentStep || progress >= 100
          const active = index === currentStep && !complete
          const Icon = complete ? CheckCircle2 : active ? LoaderCircle : Circle
          return (
            <li key={step} className={cn('flex items-center gap-2 rounded-control px-2 py-1', active && 'bg-denim-50 font-semibold text-denim')}
              aria-current={active ? 'step' : undefined}>
              <Icon size={17} aria-hidden="true" className={cn(complete && 'text-success-fg', active && 'animate-spin motion-reduce:animate-none', !active && !complete && 'text-muted')} />
              <span>{step}<span className="sr-only">{complete ? ', selesai' : ''}</span></span>
            </li>
          )
        })}
      </ol>
      <Button variant="secondary" onClick={onCancel}>Batalkan</Button>
    </div>
  )
}
