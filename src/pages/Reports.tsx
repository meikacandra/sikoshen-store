import { useState, type FormEvent } from 'react'
import { Download, FileBarChart2, Printer } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Banner, Button, ButtonLink, Card, CardHeader, EmptyState, ResponsiveTable, Select, Tabs, type Column } from '../components/ui'
import { useData } from '../context/DataContext'
import { downloadCsv } from '../lib/exportCsv'
import { formatDateTime, formatNumber, formatUnit } from '../lib/format'
import { monthName, skuPath } from '../lib/inventoryViews'
import { isMonthKey, reportData, type ReportGrouping, type ReportRow } from '../lib/reports'
import type { MonthKey } from '../data/movements'

type ReportTab = 'pergerakan' | 'masuk' | 'keluar' | 'riwayat-klasifikasi' | 'riwayat-rekomendasi'
const tabs: { value: ReportTab; label: string }[] = [
  { value: 'pergerakan', label: 'Pergerakan stok' }, { value: 'masuk', label: 'Barang masuk' },
  { value: 'keluar', label: 'Barang keluar' }, { value: 'riwayat-klasifikasi', label: 'Riwayat klasifikasi' },
  { value: 'riwayat-rekomendasi', label: 'Riwayat rekomendasi' },
]

function validTab(value: string | null): ReportTab {
  return tabs.find((tab) => tab.value === value)?.value ?? 'pergerakan'
}

function validGrouping(value: string | null): ReportGrouping {
  return value === 'bulan' || value === 'sku' ? value : 'produk'
}

export default function Reports() {
  const { inventory, products, status, classifications, recommendationReviews } = useData()
  const [params, setParams] = useSearchParams()
  const months = inventory.monthlyMovements.map((row) => row.month)
  const minMonth = months[0] ?? '2023-05'
  const maxMonth = months[months.length - 1] ?? '2026-05'
  const defaultFrom = months[Math.max(0, months.length - 6)] ?? minMonth
  const tab = validTab(params.get('tab'))
  const appliedFrom = params.get('from') ?? defaultFrom
  const appliedTo = params.get('to') ?? maxMonth
  const appliedProduct = params.get('produk') ?? ''
  const appliedSku = params.get('sku') ?? ''
  const appliedGrouping = validGrouping(params.get('kelompok'))
  const [draft, setDraft] = useState(() => ({ from: appliedFrom, to: appliedTo, product: appliedProduct, sku: appliedSku, grouping: appliedGrouping }))
  const [error, setError] = useState('')
  const rangeValid = isMonthKey(appliedFrom) && isMonthKey(appliedTo) && appliedFrom <= appliedTo && appliedFrom >= minMonth && appliedTo <= maxMonth
  const report = rangeValid ? reportData(inventory, appliedFrom as MonthKey, appliedTo as MonthKey, appliedProduct, appliedSku, appliedGrouping) : null
  const classificationHistory = classifications.filter((record) => {
    const month = `${record.at.getFullYear()}-${String(record.at.getMonth() + 1).padStart(2, '0')}`
    return rangeValid && month >= appliedFrom && month <= appliedTo
  })
  const recommendationHistory = recommendationReviews.filter((record) => {
    const month = `${record.at.getFullYear()}-${String(record.at.getMonth() + 1).padStart(2, '0')}`
    return rangeValid && month >= appliedFrom && month <= appliedTo
      && (!appliedSku || record.skuIds.includes(appliedSku))
      && (!appliedProduct || record.skuIds.some((id) => inventory.skus.find((sku) => sku.id === id)?.productId === appliedProduct))
  })
  const historyTab = tab.startsWith('riwayat-')
  const availableSku = inventory.skus.filter((sku) => !draft.product || sku.productId === draft.product)

  function changeTab(nextTab: ReportTab) {
    const next = new URLSearchParams(params)
    if (nextTab === 'pergerakan') next.delete('tab')
    else next.set('tab', nextTab)
    setParams(next)
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isMonthKey(draft.from) || !isMonthKey(draft.to) || draft.from < minMonth || draft.to > maxMonth) {
      setError(`Pilih bulan antara ${monthName(minMonth)} dan ${monthName(maxMonth)}.`)
      return
    }
    if (draft.to < draft.from) {
      setError('Bulan “sampai” tidak boleh lebih awal dari bulan “dari”.')
      return
    }
    setError('')
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries({ from: draft.from, to: draft.to, produk: draft.product, sku: draft.sku, kelompok: draft.grouping === 'produk' ? '' : draft.grouping })) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next)
  }

  function reset() {
    const initial = { from: defaultFrom, to: maxMonth, product: '', sku: '', grouping: 'produk' as ReportGrouping }
    setDraft(initial)
    setError('')
    const next = new URLSearchParams()
    if (tab !== 'pergerakan') next.set('tab', tab)
    setParams(next)
  }

  function download() {
    const filename = `sikoshen-laporan-${tab}-${appliedFrom}-${appliedTo}.csv`
    if (tab === 'riwayat-klasifikasi') {
      downloadCsv(filename, ['Tanggal klasifikasi', 'Periode data', 'Fast-Moving (SKU)', 'Slow-Moving (SKU)', 'SKU berubah label'],
        classificationHistory.map((record) => [formatDateTime(record.at), `${monthName(`${record.periodStart.getFullYear()}-${String(record.periodStart.getMonth() + 1).padStart(2, '0')}`)}–${monthName(`${record.periodEnd.getFullYear()}-${String(record.periodEnd.getMonth() + 1).padStart(2, '0')}`)}`,
          record.fast, record.slow, record.changes.length]))
      return
    }
    if (tab === 'riwayat-rekomendasi') {
      downloadCsv(filename, ['Tanggal ditinjau', 'Jumlah SKU', 'SKU', 'Tanggal klasifikasi'], recommendationHistory.map((record) =>
        [formatDateTime(record.at), record.skuIds.length, record.skuIds.join('; '), formatDateTime(record.classificationAt)]))
      return
    }
    downloadCsv(filename, ['Kelompok', 'Stok awal', 'Masuk', 'Keluar', 'Stok akhir', 'Fast-Moving (SKU)', 'Slow-Moving (SKU)', 'Jumlah SKU', 'Tanggal klasifikasi'],
      [...(report?.rows ?? []).map((row) => [row.name, row.openingStock, row.incoming, row.outgoing, row.closingStock, row.fast, row.slow, row.skuCount, formatDateTime(status.lastClassification)]),
        ['TOTAL', report?.totals.openingStock ?? 0, report?.totals.incoming ?? 0, report?.totals.outgoing ?? 0, report?.totals.closingStock ?? 0,
          report?.rows.reduce((n, row) => n + row.fast, 0) ?? 0, report?.rows.reduce((n, row) => n + row.slow, 0) ?? 0, report?.skuCount ?? 0, formatDateTime(status.lastClassification)]])
  }

  const columns: Column<ReportRow>[] = [
    { key: 'group', header: appliedGrouping === 'bulan' ? 'Bulan' : appliedGrouping === 'sku' ? 'SKU' : 'Jenis produk', rowHeader: true,
      cell: (row) => appliedGrouping === 'bulan' ? monthName(row.key) : appliedGrouping === 'sku' ? <><Link to={skuPath(row.key)} className="font-semibold text-denim hover:underline">{row.key}</Link><span className="block text-caption text-muted">{row.name}</span></> : row.name },
    { key: 'opening', header: 'Stok awal', align: 'right', cell: (row) => formatNumber(row.openingStock) },
    { key: 'incoming', header: 'Masuk', align: 'right', cell: (row) => formatNumber(row.incoming) },
    { key: 'outgoing', header: 'Keluar', align: 'right', cell: (row) => formatNumber(row.outgoing) },
    { key: 'closing', header: 'Stok akhir', align: 'right', cell: (row) => formatNumber(row.closingStock) },
    { key: 'fast', header: 'Fast', align: 'right', cell: (row) => formatNumber(row.fast) },
    { key: 'slow', header: 'Slow', align: 'right', cell: (row) => formatNumber(row.slow) },
  ]

  return <div className="report-page">
    <PageHeader title="Laporan" description="Rekap pergerakan stok dari kartu stok demo dan riwayat keputusan."
      actions={<div className="no-print flex flex-wrap gap-2"><Button variant="secondary" leftIcon={<Download size={17} />} onClick={download}
        disabledReason={!rangeValid || (historyTab ? tab === 'riwayat-klasifikasi' ? !classificationHistory.length : !recommendationHistory.length : !report?.rows.length) ? 'Tidak ada data untuk diunduh.' : undefined}>Unduh Excel (CSV)</Button>
        <Button variant="secondary" leftIcon={<Printer size={17} />} onClick={() => window.print()}
          disabledReason={!rangeValid ? 'Perbaiki rentang bulan terlebih dahulu.' : undefined}>Unduh PDF</Button></div>} />
    <div className="print-header hidden"><h1>Laporan Sikoshen Store</h1><p>{tabs.find((item) => item.value === tab)?.label} · {isMonthKey(appliedFrom) ? monthName(appliedFrom) : appliedFrom}–{isMonthKey(appliedTo) ? monthName(appliedTo) : appliedTo}</p></div>
    {!inventory.skus.length ? <Card><EmptyState icon={FileBarChart2} title="Belum ada data laporan" description="Unggah kartu stok untuk menampilkan rekap."
      steps={['Siapkan kartu stok.', 'Unggah dan periksa file.', 'Pilih rentang laporan.']} action={<ButtonLink to="/upload">Unggah kartu stok</ButtonLink>} /></Card> : <div className="space-y-6">
      <div className="no-print"><Tabs idPrefix="report" items={tabs} value={tab} onChange={changeTab} label="Jenis laporan" /></div>
      <form className="no-print rounded-card border border-border bg-white p-4 shadow-card sm:p-6" onSubmit={apply}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-caption-lg font-semibold">Dari bulan<input type="month" min={minMonth} max={maxMonth} value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            className="mt-1.5 block h-11 w-full rounded-control border border-border-strong bg-white px-3 font-normal focus-ring" /></label>
          <label className="text-caption-lg font-semibold">Sampai bulan<input type="month" min={minMonth} max={maxMonth} value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            className="mt-1.5 block h-11 w-full rounded-control border border-border-strong bg-white px-3 font-normal focus-ring" /></label>
          <Select label="Jenis produk" value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value, sku: '' })}
            options={[{ value: '', label: 'Semua produk' }, ...products.map((product) => ({ value: product.id, label: product.name }))]} />
          <Select label="SKU" value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })}
            options={[{ value: '', label: 'Semua SKU' }, ...availableSku.map((sku) => ({ value: sku.id, label: sku.id }))]} />
          <Select label="Pengelompokan" value={draft.grouping} onChange={(event) => setDraft({ ...draft, grouping: event.target.value as ReportGrouping })}
            options={[{ value: 'produk', label: 'Jenis produk' }, { value: 'bulan', label: 'Bulan' }, { value: 'sku', label: 'SKU' }]} />
        </div>
        {error && <p role="alert" className="mt-3 text-caption-lg text-danger-fg">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Button type="submit">Terapkan</Button><Button variant="ghost" onClick={reset}>Atur ulang</Button></div>
      </form>
      {!rangeValid ? <Banner tone="danger" title="Rentang bulan tidak valid">Pilih bulan dari {monthName(minMonth)} sampai {monthName(maxMonth)}, dengan bulan akhir sama atau sesudah bulan awal.</Banner> : <>
        {!historyTab && report && <>
          <section aria-label="Ringkasan stok" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
            ['Stok awal', report.totals.openingStock], ['Barang masuk', report.totals.incoming], ['Barang keluar', report.totals.outgoing], ['Stok akhir', report.totals.closingStock],
          ].map(([name, count]) => <div key={name} className="rounded-card border border-border bg-white p-4 shadow-card sm:p-5"><p className="text-caption-lg text-muted">{name}</p><p className="mt-2 tabular text-[24px] font-bold">{formatUnit(count as number)}</p></div>)}</section>
          <Card><CardHeader title={tabs.find((item) => item.value === tab)?.label ?? 'Pergerakan stok'} description={`${monthName(appliedFrom)}–${monthName(appliedTo)} · ${report.skuCount} SKU · label dari klasifikasi ${formatDateTime(status.lastClassification)}`} />
            {report.rows.length ? <><ResponsiveTable columns={columns} rows={report.rows} caption="Rekap pergerakan stok" getRowKey={(row) => row.key}
              renderCard={(row) => <div><p className="font-semibold">{appliedGrouping === 'bulan' ? monthName(row.key) : row.name}</p><dl className="mt-2 grid grid-cols-2 gap-2 text-caption-lg">
                <div><dt className="text-muted">Stok awal</dt><dd>{formatUnit(row.openingStock)}</dd></div><div><dt className="text-muted">Stok akhir</dt><dd>{formatUnit(row.closingStock)}</dd></div>
                <div><dt className="text-muted">Masuk</dt><dd>{formatUnit(row.incoming)}</dd></div><div><dt className="text-muted">Keluar</dt><dd>{formatUnit(row.outgoing)}</dd></div></dl><p className="mt-2 text-caption text-muted">Fast {row.fast} · Slow {row.slow}</p></div>} />
              <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-border pt-3 font-bold"><span>Total</span><span className="tabular">Awal {formatUnit(report.totals.openingStock)} · Masuk {formatUnit(report.totals.incoming)} · Keluar {formatUnit(report.totals.outgoing)} · Akhir {formatUnit(report.totals.closingStock)}</span></div></>
              : <EmptyState icon={FileBarChart2} title="Tidak ada pergerakan dalam filter ini" description="Ubah produk, SKU, atau rentang bulan." action={<Button variant="secondary" onClick={reset}>Atur ulang filter</Button>} />}</Card>
          <p className="text-caption-lg text-muted">Stok awal dan akhir berasal dari batas periode. Barang masuk dan keluar adalah jumlah transaksi dalam periode. Jumlah Fast/Slow memakai label klasifikasi terakhir ({formatDateTime(status.lastClassification)}), bukan label historis per bulan.</p>
        </>}
        {tab === 'riwayat-klasifikasi' && <Card><CardHeader title="Riwayat klasifikasi" description={`Proses yang dijalankan pada ${monthName(appliedFrom)}–${monthName(appliedTo)}.`} />
          {classificationHistory.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-body"><thead><tr className="border-b border-border text-left text-caption text-muted"><th className="p-3">Tanggal</th><th className="p-3">Periode data</th><th className="p-3">Fast</th><th className="p-3">Slow</th><th className="p-3">Label berubah</th></tr></thead>
            <tbody>{classificationHistory.map((record) => <tr key={record.id} className="border-b border-border"><td className="p-3">{formatDateTime(record.at)}</td><td className="p-3">{monthName(`${record.periodStart.getFullYear()}-${String(record.periodStart.getMonth() + 1).padStart(2, '0')}`)}–{monthName(`${record.periodEnd.getFullYear()}-${String(record.periodEnd.getMonth() + 1).padStart(2, '0')}`)}</td>
              <td className="p-3 tabular">{record.fast}</td><td className="p-3 tabular">{record.slow}</td><td className="p-3 tabular">{record.changes.length}</td></tr>)}</tbody></table></div>
            : <EmptyState icon={FileBarChart2} title="Belum ada klasifikasi pada rentang ini" description="Pilih rentang bulan lain atau jalankan klasifikasi." action={<ButtonLink to="/klasifikasi">Buka klasifikasi</ButtonLink>} />}</Card>}
        {tab === 'riwayat-rekomendasi' && <Card><CardHeader title="Riwayat rekomendasi" description="SKU yang ditandai sudah ditinjau selama sesi demo ini." />
          {recommendationHistory.length ? <div className="space-y-3">{recommendationHistory.map((record) => <div key={record.id} className="rounded-control border border-border p-4"><p className="font-semibold">{formatDateTime(record.at)} · {record.skuIds.length} SKU ditinjau</p>
            <p className="mt-1 text-caption-lg text-muted">Label klasifikasi {formatDateTime(record.classificationAt)}</p><div className="mt-2 flex flex-wrap gap-2">{record.skuIds.map((id) => <Link key={id} to={skuPath(id)} className="text-caption-lg font-semibold text-denim hover:underline">{id}</Link>)}</div></div>)}</div>
            : <EmptyState icon={FileBarChart2} title="Belum ada rekomendasi yang ditinjau" description="Tandai SKU pada halaman Rekomendasi Persediaan untuk mencatatnya di sini." action={<ButtonLink to="/rekomendasi">Buka rekomendasi</ButtonLink>} />}</Card>}
      </>}
    </div>}
  </div>
}
