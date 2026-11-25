import { useState } from 'react'
import { Download } from 'lucide-react'
import { stockColumns, templateRows, uploadIssues, uploadSummary, type UploadIssue } from '../../data/uploadDemo'
import { downloadCsv } from '../../lib/exportCsv'
import { formatNumber } from '../../lib/format'
import { AccordionItem, Button, Card, CardHeader, Pagination, ResponsiveTable, type Column } from '../ui'

const issues = uploadIssues()
const issuePageSize = 10

const columns: Column<UploadIssue>[] = [
  { key: 'product', header: 'Jenis produk', rowHeader: true, cell: (row) => row.product },
  { key: 'date', header: 'Tanggal tercatat', cell: (row) => row.date, className: 'whitespace-nowrap' },
  { key: 'field', header: 'Kolom', cell: (row) => row.field },
  { key: 'original', header: 'Nilai awal', cell: (row) => row.original },
  { key: 'result', header: 'Hasil', cell: (row) => `${row.status} · ${row.result}` },
]

const previewColumns: Column<(typeof templateRows)[number]>[] = stockColumns.map((header, index) => ({
  key: header, header, cell: (row) => row[index], rowHeader: index === 0, className: 'whitespace-nowrap',
}))

const summary: Array<[string, number]> = [
  ['Baris setelah konversi', uploadSummary.convertedRows], ['Siap disimpan', uploadSummary.readyRows],
  ['Dibuang', uploadSummary.discardedRows], ['Diperbaiki otomatis', uploadSummary.fixedRows],
]

const issueFilters = [
  { label: 'Semua masalah', value: '' },
  { label: 'Dibuang', value: 'Dibuang' },
  { label: 'Diperbaiki', value: 'Diperbaiki' },
  { label: 'Diabaikan', value: 'Diabaikan' },
]

export function UploadReview() {
  const [requestedPage, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const filtered = filter ? issues.filter(({ status }) => status === filter) : issues
  const page = Math.min(requestedPage, Math.ceil(filtered.length / issuePageSize))
  const items = filtered.slice((page - 1) * issuePageSize, page * issuePageSize)

  function exportIssues() {
    downloadCsv('daftar-masalah-kartu-stok.csv',
      ['Baris contoh', 'Jenis produk', 'Tanggal tercatat', 'Kolom', 'Nilai awal', 'Status', 'Hasil'],
      issues.map(({ id, product, date, field, original, status, result }) => [id, product, date, field, original, status, result]),
    )
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.map(([label, value]) => (
          <div key={label} className="rounded-control border border-border bg-surface p-3">
            <dt className="text-caption-lg text-muted">{label}</dt>
            <dd className="mt-1 tabular text-xl font-bold">{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2">
        <AccordionItem title="Dibuang" defaultOpen>
          <p>Tanggal yang tidak valid dibuang, misalnya <code>12/9/923</code>.</p>
        </AccordionItem>
        <AccordionItem title="Diperbaiki otomatis, perlu dicek ke toko">
          <p className="mb-1">Nilai stok negatif diubah menjadi 0.</p>
          <ul className="list-disc pl-5"><li>Kemeja Denim: 964 baris</li><li>Tony Jack Biasa: 550 baris</li><li>Iron Head Ultimate: 128 baris</li></ul>
        </AccordionItem>
        <AccordionItem title="Diabaikan">
          <p>Nilai <code>Stok_Akhir</code> kosong di 21 baris diabaikan saat membaca saldo stok.</p>
        </AccordionItem>
        <AccordionItem title="Normal">
          <p>Sel barang masuk atau keluar yang kosong dibaca sebagai 0.</p>
        </AccordionItem>
      </div>

      <section aria-labelledby="upload-issues">
        <CardHeader as="h3" id="upload-issues" title="Contoh baris bermasalah"
          action={<Button variant="secondary" leftIcon={<Download size={16} />} onClick={exportIssues}>Unduh daftar lengkap</Button>} />
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Jenis masalah">
          {issueFilters.map(({ label, value }) => <Button key={value} variant={filter === value ? 'primary' : 'secondary'} aria-pressed={filter === value}
            onClick={() => { setFilter(value); setPage(1) }}>{label}</Button>)}
        </div>
        <ResponsiveTable columns={columns} rows={items} getRowKey={(row) => String(row.id)} caption="Contoh baris bermasalah"
          renderCard={(row) => <><p className="font-semibold">{row.product}</p><p className="text-caption-lg text-muted">{row.date} · {row.field}</p><p>{row.original} → {row.result}</p></>} />
        <Pagination page={page} total={filtered.length} pageSize={issuePageSize} onChange={setPage} />
      </section>

      <Card className="bg-surface shadow-none">
        <CardHeader as="h3" title="Pratinjau hasil konversi" />
        <ResponsiveTable columns={previewColumns} rows={[...templateRows]} getRowKey={(row) => row.join('-')} caption="Pratinjau hasil konversi"
          renderCard={(row) => <><p className="font-semibold">{row[1]} · {row[2]} · {row[3]}</p><p className="text-caption-lg text-muted">{row[0]}</p><p>Masuk {row[4]} · Keluar {row[5]} · Stok akhir {row[6]}</p></>} />
      </Card>
    </div>
  )
}
