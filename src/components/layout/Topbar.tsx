import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, ChevronDown, Clock, Cpu, Upload } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatDateTime, formatPeriod } from '../../lib/format'
import { BottomSheet } from '../ui/Overlay'
import { Spinner } from '../ui/Spinner'

/** Bilah status data: tampil di semua halaman terlindungi. */
export function Topbar() {
  const [statusOpen, setStatusOpen] = useState(false)
  const { status, inventory, uploads, classifications } = useData()
  const empty = !inventory.skus.length
  const period = empty ? 'Belum ada data' : formatPeriod(status.periodStart, status.periodEnd)
  const uploadedAt = empty || !uploads.some((item) => item.status === 'berhasil') ? 'Belum ada' : formatDateTime(status.lastUpload)
  const classifiedAt = empty || !classifications.length ? 'Belum ada' : formatDateTime(status.lastClassification)

  return (
    <>
    <header className="no-print sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Merek (ponsel saja: sidebar tidak ada) */}
        <p className="shrink-0 font-bold text-charcoal sm:hidden">Sikoshen Store</p>

        <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-caption-lg text-muted max-md:hidden">
          <div className="flex items-center gap-1.5">
            <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt>Periode data</dt>
            <dd className="font-semibold text-charcoal">{period}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt>Terakhir diunggah</dt>
            <dd className="tabular font-semibold text-charcoal">{uploadedAt}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt>Klasifikasi</dt>
            <dd className="tabular font-semibold text-charcoal">{classifiedAt}</dd>
          </div>
        </dl>

        {/* Ponsel dan tablet sempit: ringkas, rincian tersedia di bottom sheet. */}
        <button
          type="button"
          onClick={() => setStatusOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={statusOpen}
          className="flex h-11 min-w-0 flex-1 items-center justify-end gap-1 text-caption text-muted focus-ring md:hidden"
        >
          <span className="truncate">Data {period}</span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>

        {status.classificationRunning && (
          <Link
            to="/klasifikasi"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-denim-50 px-3 text-caption-lg font-semibold text-denim focus-ring"
            aria-live="polite"
          >
            <Spinner className="h-3.5 w-3.5" />
            <span className="max-sm:sr-only">Klasifikasi berjalanâ€¦</span>
          </Link>
        )}

        <Link
          to="/upload"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-caption-lg font-semibold text-denim hover:bg-denim-50 focus-ring sm:h-9"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span className="max-lg:sr-only">Unggah kartu stok baru</span>
        </Link>
      </div>
    </header>
    <BottomSheet open={statusOpen} onClose={() => setStatusOpen(false)} title="Status data">
      <dl className="space-y-4 text-body">
        <div>
          <dt className="text-muted">Periode data</dt>
          <dd className="mt-1 font-semibold text-charcoal">{period}</dd>
        </div>
        <div>
          <dt className="text-muted">Terakhir diunggah</dt>
          <dd className="mt-1 font-semibold text-charcoal">{uploadedAt}</dd>
        </div>
        <div>
          <dt className="text-muted">Klasifikasi terakhir</dt>
          <dd className="mt-1 font-semibold text-charcoal">{classifiedAt}</dd>
        </div>
      </dl>
    </BottomSheet>
    </>
  )
}
