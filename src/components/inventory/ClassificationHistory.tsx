import { useState } from 'react'
import { History } from 'lucide-react'
import type { ClassificationRecord, LabelChange } from '../../data/classification'
import { formatDateTime, formatNumber, formatPeriod } from '../../lib/format'
import { Card, CardHeader, Drawer, EmptyState, LabelChip, ResponsiveTable, StatusChip, type Column } from '../ui'

const changeColumns: Column<LabelChange>[] = [
  { key: 'sku', header: 'SKU', rowHeader: true, cell: ({ skuId }) => <span className="break-all font-semibold">{skuId}</span> },
  { key: 'previous', header: 'Sebelumnya', cell: ({ previous }) => <LabelChip value={previous} /> },
  { key: 'current', header: 'Sekarang', cell: ({ current }) => <LabelChip value={current} /> },
]

const columns: Column<ClassificationRecord>[] = [
  { key: 'at', header: 'Waktu', className: 'whitespace-nowrap', rowHeader: true, cell: (row) => <strong>{formatDateTime(row.at)}</strong> },
  { key: 'period', header: 'Periode data', className: 'whitespace-nowrap', cell: (row) => formatPeriod(row.periodStart, row.periodEnd) },
  { key: 'counts', header: 'Hasil label', className: 'whitespace-nowrap', cell: (row) => `${row.fast} Fast · ${row.slow} Slow` },
  { key: 'change', header: 'Perubahan', className: 'whitespace-nowrap', cell: (row) => row.changes.length
    ? <StatusChip kind="tone" tone="info" label={`${row.changes.length} SKU berubah label`} /> : '—' },
]

export function ClassificationHistory({ records }: { records: readonly ClassificationRecord[] }) {
  const [selected, setSelected] = useState<ClassificationRecord | null>(null)

  return (
    <Card>
      <CardHeader title="Riwayat klasifikasi" description="Buka satu hasil untuk melihat SKU yang berubah label." />
      <ResponsiveTable columns={columns} rows={[...records]} getRowKey={(row) => row.id} caption="Riwayat klasifikasi"
        onRowClick={setSelected} rowLabel={(row) => `Buka klasifikasi ${formatDateTime(row.at)}`}
        empty={<EmptyState icon={History} title="Belum ada riwayat klasifikasi" />}
        renderCard={(row) => <>
          <span className="block font-bold">{formatDateTime(row.at)}</span>
          <span className="block text-caption-lg text-muted">{formatPeriod(row.periodStart, row.periodEnd)}</span>
          <span className="mt-2 flex flex-wrap gap-2">{row.fast} Fast · {row.slow} Slow</span>
          {!!row.changes.length && <span className="mt-2 block"><StatusChip kind="tone" tone="info" label={`${row.changes.length} SKU berubah label`} /></span>}
        </>} />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Perbandingan klasifikasi"
        description={selected && formatDateTime(selected.at)}>
        {selected && (
          <div className="space-y-4">
            <p className="text-caption-lg text-muted">{formatPeriod(selected.periodStart, selected.periodEnd)} · {formatNumber(selected.fast)} Fast · {formatNumber(selected.slow)} Slow</p>
            <ResponsiveTable columns={changeColumns} rows={[...selected.changes]} getRowKey={({ skuId }) => skuId} caption="SKU yang berubah label"
              empty={<EmptyState icon={History} title="Tidak ada rincian perubahan label" />}
              renderCard={(row) => <>
                <p className="mb-2 break-all font-semibold">{row.skuId}</p>
                <dl className="grid gap-2">
                  <div><dt className="mb-1 text-caption text-muted">Sebelumnya</dt><dd><LabelChip value={row.previous} /></dd></div>
                  <div><dt className="mb-1 text-caption text-muted">Sekarang</dt><dd><LabelChip value={row.current} /></dd></div>
                </dl>
              </>} />
          </div>
        )}
      </Drawer>
    </Card>
  )
}
