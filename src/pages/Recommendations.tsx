import { useMemo, useState } from 'react'
import { ChevronDown, Download, ListChecks, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { actionMeta, conditionMeta, labelMeta } from '../components/ui/Chip'
import { Banner, Button, ButtonLink, Card, CardHeader, Checkbox, EmptyState, LabelChip, Pagination, ResponsiveTable, SearchInput, StatusChip, type Column } from '../components/ui'
import { useData } from '../context/DataContext'
import { useDemo } from '../context/DemoContext'
import { useToast } from '../context/ToastContext'
import { apiReviewRecommendations, apiUndoRecommendationReview } from '../lib/api'
import { cn } from '../lib/cn'
import { downloadCsv } from '../lib/exportCsv'
import { formatDateTime, formatNumber, formatUnit } from '../lib/format'
import { type InventorySku, skuPath } from '../lib/inventoryViews'
import { actionOrder, conditionOrder, matrixCount, recommendationReason, sortRecommendations } from '../lib/recommendations'
import { formatStockCoverage, STOCK_COVERAGE_NOTE } from '../lib/rules'
import type { MovementLabel, StockAction, StockCondition } from '../lib/types'

const PAGE_SIZE = 20

export default function Recommendations() {
  const { inventory, status, dispatch, recommendationReviews } = useData()
  const demo = useDemo()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [hideReviewed, setHideReviewed] = useState(false)
  const [page, setPage] = useState(1)
  const action = actionOrder.includes(params.get('aksi') as StockAction) ? params.get('aksi') as StockAction : null
  const label = ['fast', 'slow'].includes(params.get('label') ?? '') ? params.get('label') as MovementLabel : null
  const condition = conditionOrder.includes(params.get('kondisi') as StockCondition) ? params.get('kondisi') as StockCondition : null
  const skuId = params.get('sku') ?? ''
  const classified = inventory.skus.filter((sku) => sku.label && sku.action)
  const unlabeled = inventory.skus.filter((sku) => !sku.label)
  const reviewed = useMemo(() => new Set(recommendationReviews.flatMap((record) => record.skuIds)), [recommendationReviews])
  const stale = status.lastUpload > status.lastClassification
  const filtered = useMemo(() => sortRecommendations(classified.filter((sku) =>
    (!action || sku.action === action) && (!label || sku.label === label) && (!condition || sku.condition === condition)
    && (!skuId || sku.id === skuId) && (!hideReviewed || !reviewed.has(sku.id))
    && (!query || `${sku.id} ${sku.productName} ${sku.variant} ${sku.size}`.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))),
  )), [classified, action, label, condition, skuId, hideReviewed, reviewed, query])
  const actualPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const visible = filtered.slice((actualPage - 1) * PAGE_SIZE, actualPage * PAGE_SIZE)
  const selectable = visible.filter((sku) => !reviewed.has(sku.id)).map((sku) => sku.id)
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id))
  const selectedAvailable = selected.filter((id) => !reviewed.has(id) && filtered.some((sku) => sku.id === id))

  function updateFilters(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next)
    setPage(1)
    setSelected([])
  }

  function review() {
    if (!selectedAvailable.length) return
    const record = { id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date(), skuIds: selectedAvailable, classificationAt: status.lastClassification }
    dispatch({ type: 'recommendation/reviewed', record })
    if (demo.scenario === 'normal') {
      void apiReviewRecommendations(record).catch(() => {})
    }
    setSelected([])
    toast({ title: `${selectedAvailable.length} rekomendasi ditandai ditinjau`, description: 'Tinjauan tersimpan di database MySQL.',
      action: { label: 'Batalkan', onClick: () => {
        dispatch({ type: 'recommendation/undone', id: record.id })
        if (demo.scenario === 'normal') {
          void apiUndoRecommendationReview(record.id).catch(() => {})
        }
      } } })
  }

  function download() {
    downloadCsv('sikoshen-rekomendasi.csv',
      ['Kode SKU', 'Produk', 'Varian', 'Ukuran', 'Label', 'Tanggal klasifikasi', 'Stok', 'Rata-rata stok', 'Kondisi stok', 'Rata-rata keluar per bulan', 'Cukup untuk (bulan)', 'Tindakan', 'Ditinjau', 'Alasan'],
      filtered.map((sku) => [sku.id, sku.productName, sku.variant, sku.size, labelMeta[sku.label!].label,
        formatDateTime(status.lastClassification), sku.stock, Math.round(sku.averageStock), conditionMeta[sku.condition].label,
        Number(sku.averageMonthlyOut.toFixed(1)), sku.averageMonthlyOut > 0 ? Number((sku.stock / sku.averageMonthlyOut).toFixed(1)) : '',
        actionMeta[sku.action!].label, reviewed.has(sku.id) ? 'Ya' : 'Tidak', recommendationReason(sku)]))
  }

  const columns: Column<InventorySku>[] = [
    { key: 'select', header: <span className="sr-only">Pilih</span>, cell: (sku) => reviewed.has(sku.id) ? null : <Checkbox
      label={`Pilih ${sku.id}`} hideLabel checked={selected.includes(sku.id)} onChange={(checked) => setSelected((xs) => checked ? [...xs, sku.id] : xs.filter((id) => id !== sku.id))} /> },
    { key: 'sku', header: 'SKU', rowHeader: true, cell: (sku) => <div className="min-w-44"><Link className="font-semibold text-denim hover:underline" to={skuPath(sku.id)}>{sku.id}</Link>
      <p className="text-caption text-muted">{sku.productName} · {sku.variant} · {sku.size}</p></div> },
    { key: 'label', header: 'Label', cell: (sku) => <LabelChip value={sku.label} short /> },
    { key: 'stock', header: 'Stok', align: 'right', cell: (sku) => formatNumber(sku.stock) },
    { key: 'average', header: 'Rata-rata stok', align: 'right', cell: (sku) => formatNumber(Math.round(sku.averageStock)) },
    { key: 'condition', header: 'Kondisi', cell: (sku) => <StatusChip kind="condition" value={sku.condition} size="sm" /> },
    { key: 'out', header: 'Keluar/bln*', align: 'right', cell: (sku) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(sku.averageMonthlyOut) },
    { key: 'coverage', header: 'Cukup untuk*', cell: (sku) => formatStockCoverage(sku.stock, sku.averageMonthlyOut) },
    { key: 'action', header: 'Tindakan', cell: (sku) => <div className="flex items-center gap-1.5"><StatusChip kind="action" value={sku.action!} size="sm" />{reviewed.has(sku.id) && <StatusChip kind="tone" tone="success" label="Ditinjau" size="sm" />}</div> },
    { key: 'why', header: 'Alasan', cell: (sku) => <Button variant="ghost" size="sm" aria-expanded={expanded.includes(sku.id)} aria-label={`Lihat alasan ${sku.id}`}
      rightIcon={<ChevronDown className={cn('h-4 w-4 transition-transform', expanded.includes(sku.id) && 'rotate-180')} />}
      onClick={() => setExpanded((xs) => xs.includes(sku.id) ? xs.filter((id) => id !== sku.id) : [...xs, sku.id])}>Lihat</Button> },
  ]

  return <>
    <PageHeader title="Rekomendasi Persediaan" description="Tindakan per SKU berdasarkan label pergerakan dan kondisi stok saat ini."
      actions={<Button variant="secondary" leftIcon={<Download size={17} />} onClick={download}
        disabledReason={!filtered.length ? 'Tidak ada rekomendasi pada filter ini.' : undefined}>Unduh daftar</Button>} />
    {!inventory.skus.length ? <Card><EmptyState icon={ListChecks} title="Belum ada rekomendasi" description="Unggah kartu stok, lalu jalankan klasifikasi untuk menampilkan saran."
      steps={['Siapkan kartu stok.', 'Unggah dan periksa file.', 'Jalankan klasifikasi.']} action={<ButtonLink to="/upload">Unggah kartu stok</ButtonLink>} /></Card> : <div className="space-y-6">
      {stale && <Banner tone="warning" title="Data stok lebih baru dari hasil klasifikasi" actions={<ButtonLink to="/klasifikasi" variant="secondary" size="sm">Jalankan klasifikasi</ButtonLink>}>
        Tindakan memakai stok terkini dan label klasifikasi {formatDateTime(status.lastClassification)}. Jalankan ulang agar label memakai data terbaru.</Banner>}
      {!!unlabeled.length && <Banner tone="warning" title={`${unlabeled.length} SKU belum memiliki rekomendasi`}>
        SKU tanpa label pergerakan ditampilkan terpisah di bawah tabel.</Banner>}
      <section aria-label="Ringkasan tindakan" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {actionOrder.map((key) => { const meta = actionMeta[key]; const count = classified.filter((sku) => sku.action === key).length
          return <button key={key} type="button" aria-pressed={action === key} onClick={() => updateFilters({ aksi: action === key ? null : key })}
            className={cn('rounded-card border bg-white p-4 text-left shadow-card transition-colors focus-ring sm:p-5', action === key ? 'border-denim ring-1 ring-denim' : 'border-border hover:border-denim-200')}>
            <span className="flex items-center gap-2 text-caption-lg font-semibold text-muted"><meta.icon size={17} aria-hidden="true" />{meta.label}</span>
            <span className="mt-2 block tabular text-[28px] font-bold leading-none text-charcoal">{formatNumber(count)}</span><span className="mt-1 block text-caption text-muted">SKU</span>
          </button> })}
      </section>
      <Card><CardHeader title="Peta label dan kondisi stok" description="Pilih angka untuk memfilter kombinasi label dan kondisi." />
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-center text-caption-lg"><caption className="sr-only">Jumlah SKU menurut label dan kondisi stok</caption>
          <thead><tr><th scope="col" className="p-2 text-left">Label</th>{conditionOrder.map((key) => <th scope="col" key={key} className="p-2">{conditionMeta[key].label}</th>)}</tr></thead>
          <tbody>{(['fast', 'slow'] as const).map((key) => <tr key={key} className="border-t border-border"><th scope="row" className="p-2 text-left"><LabelChip value={key} short /></th>
            {conditionOrder.map((stock) => <td key={stock} className="p-1"><button type="button" aria-label={`${labelMeta[key].label}, ${conditionMeta[stock].label}: ${matrixCount(classified, key, stock)} SKU`}
              aria-pressed={label === key && condition === stock} onClick={() => updateFilters({ label: label === key && condition === stock ? null : key, kondisi: label === key && condition === stock ? null : stock })}
              className={cn('min-h-11 w-full rounded-control font-bold hover:bg-denim-50 focus-ring', label === key && condition === stock ? 'bg-denim text-white hover:bg-denim-700' : 'bg-surface text-denim')}>
              {matrixCount(classified, key, stock)}</button></td>)}</tr>)}</tbody></table></div></Card>
      <Card><CardHeader title="Daftar tindakan" description={`Label terakhir diperbarui ${formatDateTime(status.lastClassification)}. Urutan dimulai dari tindakan paling mendesak.`}
        action={<Button onClick={review} leftIcon={<ListChecks size={17} />} disabledReason={!selectedAvailable.length ? 'Pilih SKU yang belum ditinjau.' : undefined}>Tandai sudah ditinjau ({selectedAvailable.length})</Button>} />
        <div className="mb-4 flex flex-wrap items-center gap-4"><SearchInput label="Cari rekomendasi" value={query} onChange={(value) => { setQuery(value); setPage(1); setSelected([]) }} className="w-full sm:max-w-xs" />
          <Checkbox label="Sembunyikan yang sudah ditinjau" checked={hideReviewed} onChange={(value) => { setHideReviewed(value); setPage(1); setSelected([]) }} />
          {(action || label || condition || skuId || query || hideReviewed) && <Button variant="link" size="sm" leftIcon={<RotateCcw size={15} />}
            onClick={() => { setParams(new URLSearchParams()); setQuery(''); setHideReviewed(false); setPage(1); setSelected([]) }}>Hapus filter</Button>}</div>
        {!!filtered.length && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-caption-lg text-muted"><span>{formatNumber(filtered.length)} rekomendasi</span>
          <Checkbox label="Pilih semua pada halaman ini" checked={allSelected} onChange={(checked) => setSelected((xs) => checked ? [...new Set([...xs, ...selectable])] : xs.filter((id) => !selectable.includes(id)))} /></div>}
        <ResponsiveTable columns={columns} rows={visible} caption="Daftar rekomendasi persediaan" getRowKey={(sku) => sku.id}
          rowClassName={(sku) => reviewed.has(sku.id) ? 'opacity-55' : undefined}
          renderExpanded={(sku) => expanded.includes(sku.id) ? <p className="max-w-3xl text-caption-lg">{recommendationReason(sku)}</p> : null}
          renderCard={(sku) => <div><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link to={skuPath(sku.id)} className="font-bold text-denim hover:underline">{sku.id}</Link>
            <p className="text-caption text-muted">{sku.productName} · {sku.variant} · {sku.size}</p></div>{!reviewed.has(sku.id) && <Checkbox label={`Pilih ${sku.id}`} hideLabel checked={selected.includes(sku.id)} onChange={(checked) => setSelected((xs) => checked ? [...xs, sku.id] : xs.filter((id) => id !== sku.id))} />}</div>
            <div className="mt-3 flex flex-wrap gap-1.5"><LabelChip value={sku.label} short /><StatusChip kind="condition" value={sku.condition} size="sm" /><StatusChip kind="action" value={sku.action!} size="sm" />{reviewed.has(sku.id) && <StatusChip kind="tone" tone="success" label="Ditinjau" size="sm" />}</div>
            <p className="mt-3 text-caption-lg text-muted">Stok {formatUnit(sku.stock)} · Rata-rata stok {formatUnit(Math.round(sku.averageStock))} · Cukup untuk {formatStockCoverage(sku.stock, sku.averageMonthlyOut)}</p>
            <Button variant="link" size="sm" className="mt-2" aria-expanded={expanded.includes(sku.id)} onClick={() => setExpanded((xs) => xs.includes(sku.id) ? xs.filter((id) => id !== sku.id) : [...xs, sku.id])}>Lihat alasan</Button></div>}
          empty={<EmptyState icon={ListChecks} title="Tidak ada rekomendasi yang cocok" description="Coba kata kunci atau filter lain." action={<Button variant="secondary" onClick={() => { setParams(new URLSearchParams()); setQuery(''); setHideReviewed(false) }}>Hapus filter</Button>} />} />
        <Pagination page={actualPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
        <p className="mt-4 text-caption text-muted">* {STOCK_COVERAGE_NOTE}. Rata-rata keluar dihitung dari bulan dengan riwayat dalam 12 bulan terakhir. Rekomendasi adalah bahan pertimbangan, bukan pesanan pembelian otomatis.</p>
      </Card>
      {!!unlabeled.length && <Card><CardHeader title="Belum ada rekomendasi" description={`${unlabeled.length} SKU tanpa label pergerakan belum dapat diberi tindakan.`} />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{unlabeled.map((sku) => <li key={sku.id} className="rounded-control bg-surface p-3"><Link className="font-semibold text-denim hover:underline" to={skuPath(sku.id)}>{sku.id}</Link>
          <p className="text-caption text-muted">{sku.productName} · {sku.historyMonths} bulan riwayat</p></li>)}</ul></Card>}
    </div>}
  </>
}
