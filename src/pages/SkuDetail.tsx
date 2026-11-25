import { useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Copy, PackageSearch } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { MovementBarChart } from '../components/charts/MovementBarChart'
import { MovementTable } from '../components/inventory/MovementTable'
import { PageHeader } from '../components/layout/PageHeader'
import { actionMeta, Banner, Button, ButtonLink, Card, CardHeader, EmptyState, HelpTip, LabelChip, ResponsiveTable, SegmentedControl, Select, StatusChip, type Column } from '../components/ui'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { getDailyMovements, type DailyMovement } from '../data/movements'
import { formatNumber, formatUnit } from '../lib/format'
import { dayName, filteredPath, monthName, movementRanges, movementWindow, skuPath, type MovementRange } from '../lib/inventoryViews'

const dailyColumns: Column<DailyMovement>[] = [
  { key: 'date', header: 'Tanggal', rowHeader: true, cell: (row) => <span className="whitespace-nowrap font-semibold">{dayName(row.date)}</span> },
  { key: 'incoming', header: 'Masuk', align: 'right', cell: (row) => formatNumber(row.incoming) },
  { key: 'outgoing', header: 'Keluar', align: 'right', cell: (row) => formatNumber(row.outgoing) },
  { key: 'closing', header: 'Stok akhir', align: 'right', cell: (row) => formatNumber(row.closingStock) },
]

export default function SkuDetail() {
  const { skuId } = useParams()
  const { products, inventory } = useData()
  const { toast } = useToast()
  const [range, setRange] = useState<MovementRange>('6')
  const [month, setMonth] = useState('')
  const sku = inventory.skus.find(({ id }) => id === skuId)

  if (!sku) return (
    <>
      <PageHeader title="Detail SKU" />
      <Card><EmptyState title="SKU tidak ditemukan" icon={PackageSearch}
        description="Periksa kode SKU atau pilih barang dari daftar stok."
        action={<ButtonLink to="/produk" leftIcon={<ArrowLeft size={18} />}>Kembali ke Produk & Stok</ButtonLink>} /></Card>
    </>
  )

  const product = products.find(({ id }) => id === sku.productId)
  const productName = product?.name ?? sku.productId
  const productPath = filteredPath('/produk', { produk: sku.productId })
  const history = inventory.movementsBySku[sku.id] ?? []
  const selected = history.find((row) => row.month === month) ?? history[history.length - 1]
  const chartRows = movementWindow(history, range, selected?.month)
  const dailyRows = selected ? getDailyMovements(sku.id, selected) : []
  const title = `${sku.variant} · ${sku.size}`
  const peerScore = (other: typeof sku) => Number(other.variant === sku.variant) * 2 + Number(other.size === sku.size)
  const peers = inventory.skus.filter((other) => other.productId === sku.productId && other.id !== sku.id)
    .sort((a, b) => peerScore(b) - peerScore(a))
  const action = sku.action ? actionMeta[sku.action] : null
  const reason = sku.action === 'restock'
    ? sku.condition === 'habis' ? 'Stok SKU Fast-Moving ini sudah habis.' : 'Stok SKU Fast-Moving ini berada di bawah rata-rata historisnya.'
    : sku.action === 'pantau' ? 'SKU ini Fast-Moving dan stoknya masih memenuhi rata-rata historis.'
      : sku.action === 'evaluasi' ? 'Stok SKU Slow-Moving ini mencapai sedikitnya 1,5 kali rata-rata historisnya.'
        : 'SKU ini Slow-Moving dan stoknya belum masuk kategori menumpuk.'

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast({ title: 'Kode disalin', description: code })
    } catch {
      toast({ tone: 'warning', title: 'Kode tidak dapat disalin', description: 'Pilih teks kode SKU untuk menyalinnya secara manual.' })
    }
  }

  return (
    <>
      <PageHeader title={title} description={productName}
        breadcrumb={
          <nav aria-label="Jejak navigasi" className="flex flex-wrap items-center gap-2 text-caption-lg text-muted">
            <Link to="/produk" className="rounded font-semibold text-denim hover:underline focus-ring">Produk & Stok</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link to={productPath} className="rounded font-semibold text-denim hover:underline focus-ring">{productName}</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{title}</span>
          </nav>
        } />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border bg-white px-4 py-3 sm:px-6">
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <div><dt className="text-caption text-muted">Jenis ukuran</dt><dd className="font-semibold capitalize">{product?.sizeType ?? (Number(sku.size) ? 'angka' : 'huruf')}</dd></div>
            <div><dt className="text-caption text-muted">Kode SKU</dt><dd className="break-all font-mono font-semibold">{sku.id}</dd></div>
          </dl>
          <Button size="sm" variant="secondary" className="max-sm:h-11" leftIcon={<Copy size={16} />} onClick={() => void copyCode(sku.id)}>Salin kode</Button>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader title="Stok saat ini" />
            <p className="mb-3 tabular text-kpi">{formatNumber(sku.stock)} <span className="text-body font-medium text-muted">unit</span></p>
            <StatusChip kind="condition" value={sku.condition} />
            <p className="mt-3 text-caption-lg text-muted">Rata-rata stok historis <strong className="text-charcoal">{formatUnit(sku.averageStock)}</strong></p>
          </Card>
          <Card>
            <CardHeader title="Label pergerakan" />
            <LabelChip value={sku.label} />
            {sku.label && product ? (
              <p className="mt-3 text-body text-muted">
                Estimasi total keluar <strong className="text-charcoal">{formatUnit(sku.estimatedTotalOut)}</strong>,
                {' '}{sku.label === 'fast' ? 'di atas' : 'sama dengan atau di bawah'} median <strong className="text-charcoal">{formatUnit(product.median)}</strong>.
                {sku.fastProbability != null && (
                  <> Peluang Fast-Moving <strong className="text-charcoal">{Math.round(sku.fastProbability * 100)}%</strong>.</>
                )}
                {' '}<HelpTip label="median">Median adalah nilai tengah untuk jenis produk yang sama. Estimasi ini digunakan untuk menentukan label berdasarkan riwayat stok.</HelpTip>
              </p>
            ) : <p className="mt-3 text-body text-muted">{!sku.recognizedByModel ? 'SKU ini belum dikenali model.' : sku.historyMonths < 3 ? 'SKU perlu riwayat minimal tiga bulan.' : 'Hasil klasifikasi tersedia setelah proses klasifikasi dijalankan.'}</p>}
          </Card>
          <Card>
            <CardHeader title="Prediksi bulan depan" description={sku.predictionMonth ? `Periode ${sku.predictionMonth}` : undefined} />
            <p className="mb-2 tabular text-kpi">
              {sku.predictedNextMonth != null ? formatNumber(Math.round(sku.predictedNextMonth)) : '–'}{' '}
              <span className="text-body font-medium text-muted">unit</span>
            </p>
            <dl className="space-y-1 text-caption-lg text-muted">
              <div>Stok pengaman (Z=1,65): <strong className="text-charcoal">{sku.safetyStock != null ? formatUnit(sku.safetyStock) : '–'}</strong></div>
              <div>Saran pesan: <strong className="text-charcoal">{sku.suggestedOrder != null ? formatUnit(sku.suggestedOrder) : '–'}</strong></div>
            </dl>
          </Card>
        </div>

        <Banner tone={action?.tone ?? 'info'} title={action?.label ?? 'Belum ada rekomendasi'}
          actions={<>
            <ButtonLink to={filteredPath('/rekomendasi', { sku: sku.id })} variant="secondary">Lihat rekomendasi</ButtonLink>
            <ButtonLink to={filteredPath('/klasifikasi', { sku: sku.id })} variant="secondary">Lihat klasifikasi</ButtonLink>
          </>}>
          {action ? reason : 'Tindakan persediaan tersedia setelah SKU mendapat label.'}
        </Banner>

        <Card className="min-w-0">
          <CardHeader title="Riwayat pergerakan stok" />
          {!selected ? <EmptyState title="Belum ada riwayat pergerakan" icon={PackageSearch} /> : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl label="Rentang riwayat stok" options={movementRanges} value={range} onChange={setRange} size="sm" />
                <p className="text-caption-lg text-muted">{monthName(chartRows[0].month)} – {monthName(chartRows[chartRows.length - 1].month)}</p>
              </div>
              <MovementBarChart rows={chartRows} selected={selected.month} label={`Pergerakan stok ${productName} ${sku.variant} ${sku.size}`} />
              <div>
                <h3 className="mb-3 text-body-lg font-bold">Ringkasan per bulan</h3>
                <MovementTable rows={chartRows} balances selected={selected.month} />
              </div>
            </div>
          )}
        </Card>

        {!!selected && (
          <Card>
            <CardHeader title="Rincian kartu stok" description="Hanya hari dengan transaksi yang ditampilkan."
              action={<Select label="Bulan rincian" value={selected.month} onChange={(event) => setMonth(event.target.value)}
                options={[...history].reverse().map((row) => ({ value: row.month, label: monthName(row.month, true) }))} />} />
            <ResponsiveTable rows={dailyRows} columns={dailyColumns} getRowKey={(row) => row.date} caption={`Transaksi ${monthName(selected.month, true)}`}
              empty={<EmptyState icon={PackageSearch} title="Tidak ada transaksi pada bulan ini" />}
              renderCard={(row) => (
                <>
                  <p className="mb-2 font-bold">{dayName(row.date)}</p>
                  <dl className="grid grid-cols-3 gap-2">
                    <div><dt className="text-caption text-muted">Masuk</dt><dd className="tabular font-semibold">{formatNumber(row.incoming)}</dd></div>
                    <div><dt className="text-caption text-muted">Keluar</dt><dd className="tabular font-semibold">{formatNumber(row.outgoing)}</dd></div>
                    <div><dt className="text-caption text-muted">Stok akhir</dt><dd className="tabular font-semibold">{formatNumber(row.closingStock)}</dd></div>
                  </dl>
                </>
              )} />
          </Card>
        )}

        {!!peers.length && (
          <Card>
            <CardHeader title="SKU lain dalam jenis yang sama" description={productName} />
            <ul className="flex flex-wrap gap-2">
              {peers.slice(0, 8).map((peer) => (
                <li key={peer.id}><Link to={skuPath(peer.id)} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-caption-lg font-semibold text-denim hover:border-denim-200 hover:bg-denim-50 focus-ring">{peer.variant} · {peer.size}</Link></li>
              ))}
            </ul>
            {peers.length > 8 && <ButtonLink className="mt-4" to={productPath} variant="link" rightIcon={<ArrowRight size={16} />}>Lihat semua SKU {productName}</ButtonLink>}
          </Card>
        )}
      </div>
    </>
  )
}
