import { useState } from 'react'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useDemo } from '../../context/DemoContext'
import { useToast } from '../../context/ToastContext'
import { demoScenarios, type DemoScenario } from '../../data/demoScenarios'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { cn } from '../../lib/cn'
import { Banner, BottomSheet, Button, Checkbox, ConfirmDialog, Drawer } from '../ui'

/** Tombol melayang "Mode demo" untuk memperlihatkan kondisi khusus saat presentasi. */
export function DemoPanel() {
  const isMobile = useIsMobile()
  const { status } = useData()
  const demo = useDemo()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const running = status.classificationRunning
  const busyReason = running ? 'Tunggu klasifikasi selesai atau batalkan terlebih dahulu.' : undefined
  const active = demo.scenario !== 'normal' || demo.failNext
  const Panel = isMobile ? BottomSheet : Drawer

  function chooseScenario(value: DemoScenario) {
    if (running || value === demo.scenario) return
    demo.setScenario(value)
    toast({ tone: 'info', title: 'Kondisi data diganti', description: demoScenarios.find((item) => item.value === value)?.label })
  }

  function confirmReset() {
    demo.reset()
    setResetOpen(false)
    toast({ title: 'Data demo diatur ulang', description: 'Semua data kembali ke kondisi awal 126 SKU.' })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        className={cn('no-print fixed right-3 z-40 inline-flex h-11 items-center gap-2 rounded-full border px-4 text-caption-lg font-semibold shadow-pop transition-colors focus-ring sm:right-6',
          'bottom-[80px] sm:bottom-6',
          active ? 'border-denim bg-denim text-white hover:bg-denim-700' : 'border-border-strong bg-white text-charcoal hover:bg-surface')}>
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        Mode demo
        {active && <span className="sr-only">(aktif)</span>}
        {active && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-white" />}
      </button>

      <Panel open={open} onClose={() => setOpen(false)} title="Mode demo"
        description="Atur kondisi data untuk presentasi. Pengaturan disimpan di peramban ini."
        footer={<div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)} disabledReason={busyReason}>Atur ulang data demo</Button>
          <Button onClick={() => setOpen(false)}>Selesai</Button>
        </div>}>
        <div className="space-y-6">
          {running && <Banner tone="info" title="Klasifikasi sedang berjalan">Kondisi data bisa diganti setelah proses selesai.</Banner>}
          <fieldset>
            <legend className="mb-2 text-body font-bold text-charcoal">Kondisi data</legend>
            <div className="space-y-2">
              {demoScenarios.map((item) => {
                const checked = demo.scenario === item.value
                return (
                  <label key={item.value} className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
                    checked ? 'border-denim bg-denim-50' : 'border-border hover:bg-surface', running && 'cursor-not-allowed opacity-60')}>
                    <input type="radio" name="demo-scenario" value={item.value} checked={checked} disabled={running}
                      onChange={() => chooseScenario(item.value)} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--denim))] focus-ring" />
                    <span>
                      <span className="block font-semibold text-charcoal">{item.label}</span>
                      <span className="block text-caption-lg text-muted">{item.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-body font-bold text-charcoal">Proses simulasi</legend>
            <Checkbox label="Paksa proses berikutnya gagal" checked={demo.failNext} onChange={(value) => {
              demo.setFailNext(value)
              toast({ tone: 'info', title: value ? 'Proses berikutnya akan gagal' : 'Proses berjalan normal kembali' })
            }}
              description="Berlaku sekali untuk unggah kartu stok atau klasifikasi berikutnya." />
          </fieldset>
        </div>
      </Panel>

      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={confirmReset} tone="danger"
        title="Atur ulang semua data demo?" confirmLabel="Atur ulang"
        description="Unggahan, klasifikasi, dan tinjauan rekomendasi selama sesi ini akan dihapus. Data kembali ke kondisi awal." />
    </>
  )
}
