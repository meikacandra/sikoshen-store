import { useState } from 'react'
import { FileClock } from 'lucide-react'
import type { UploadRecord } from '../../data/uploads'
import { formatDateTime, formatNumber } from '../../lib/format'
import { Button, Card, CardHeader, Drawer, EmptyState, ResponsiveTable, Select, StatusChip, type Column } from '../ui'

const statusLabels = { berhasil: 'Berhasil', ditolak: 'Ditolak', gagal: 'Gagal' } as const

function UploadStatus({ status }: { status: UploadRecord['status'] }) {
  return <StatusChip kind="tone" tone={status === 'berhasil' ? 'success' : 'danger'} label={statusLabels[status]} />
}

export function UploadHistory({ uploads }: { uploads: readonly UploadRecord[] }) {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<UploadRecord | null>(null)
  const rows = uploads.filter((row) => !filter || row.status === filter)
  const detail = (row: UploadRecord) => <Button size="sm" variant="secondary" className="max-sm:h-11" onClick={() => setSelected(row)}
    aria-label={`Detail unggahan ${row.name}`}>Detail</Button>
  const columns: Column<UploadRecord>[] = [
    { key: 'name', header: 'File', rowHeader: true, cell: (row) => <span className="break-words font-semibold">{row.name}</span> },
    { key: 'date', header: 'Waktu', className: 'whitespace-nowrap', cell: (row) => formatDateTime(row.at) },
    { key: 'status', header: 'Status', cell: (row) => <UploadStatus status={row.status} /> },
    { key: 'detail', header: 'Rincian', align: 'right', cell: detail },
  ]

  return (
    <Card>
      <CardHeader title="Riwayat unggahan" action={<Select label="Status unggahan" value={filter}
        onChange={(event) => setFilter(event.target.value)} options={[
          { value: '', label: 'Semua status' },
          ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
        ]} />} />
      <ResponsiveTable columns={columns} rows={rows} getRowKey={(row) => row.id} caption="Riwayat unggahan"
        empty={<EmptyState icon={FileClock} title="Tidak ada unggahan dengan status ini"
          action={filter && <Button variant="secondary" onClick={() => setFilter('')}>Hapus filter</Button>} />}
        renderCard={(row) => <div className="space-y-2"><p className="break-words font-semibold">{row.name}</p>
          <p className="text-caption-lg text-muted">{formatDateTime(row.at)}</p>
          <div className="flex flex-wrap items-center justify-between gap-2"><UploadStatus status={row.status} />{detail(row)}</div>
        </div>} />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Detail unggahan">
        {selected && <>
          <p className="break-words font-bold">{selected.name}</p>
          <p className="mb-3 text-caption-lg text-muted">{formatDateTime(selected.at)}</p>
          <UploadStatus status={selected.status} />
          {selected.status === 'berhasil'
            ? <dl className="mt-4 space-y-2">
                <div><dt className="text-muted">Baris disimpan</dt><dd className="font-semibold">{formatNumber(selected.readyRows)}</dd></div>
                <div><dt className="text-muted">Jumlah SKU</dt><dd className="font-semibold">{formatNumber(selected.skuCount)}</dd></div>
                <div><dt className="text-muted">Baris dibuang</dt><dd className="font-semibold">{formatNumber(selected.discardedRows)}</dd></div>
              </dl>
            : <p className="mt-3">{selected.reason}</p>}
        </>}
      </Drawer>
    </Card>
  )
}
