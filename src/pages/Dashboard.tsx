import { useState } from 'react'
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BarChart3, Boxes, ChartColumn, Layers, Package, Table2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { CompositionBar, CompositionLegend } from '../components/charts/CompositionBar'
import { MovementBarChart } from '../components/charts/MovementBarChart'
import { MovementTable } from '../components/inventory/MovementTable'
import { PageHeader } from '../components/layout/PageHeader'
import { actionMeta, Banner, Button, ButtonLink, Card, CardHeader, EmptyState, ResponsiveTable, SegmentedControl, Select, StatusChip, type Column } from '../components/ui'
import { useData } from '../context/DataContext'
import { useCountUp } from '../hooks/useCountUp'
import { formatNumber, formatSignedPercent } from '../lib/format'
import { filteredPath, monthName, movementRanges, movementWindow, skuPath, type InventorySku, type MovementRange } from '../lib/inventoryViews'
import type { StockAction } from '../lib/types'

const actions: StockAction[] = ['restock', 'pantau', 'tahan', 'evaluasi']

function Kpi({ title, value, detail, to, icon: Icon }: {
  title: string
  value: number
  detail: string
  to: string
  icon: typeof Package
}) {
  const animated = useCountUp(value)
  return (
    <Link to={to} className="group flex min-w-0 flex-col rounded-card border border-border bg-white p-4 shadow-card transition-colors hover:border-denim-200 hover:bg-denim-50/25 focus-ring">
      <div className="mb-3 flex justify-between gap-2">
        <Icon className="h-5 w-5 shrink-0 text-denim" aria-hidden="true" />
        <ArrowRight className="h-4 w-4 shrink-0 text-muted group-hover:text-denim" aria-hidden="true" />
      </div>
      <span className="text-caption-lg font-semibold text-muted">{title}</span>
      <span className="tabular text-kpi text-charcoal"><span aria-hidden="true">{formatNumber(animated)}</span><span className="sr-only">{formatNumber(value)}</span></span>
      <span className="mt-1 text-caption text-muted">{detail}</span>
    </Link>
  )
}

function compare(value: number, previous: number | undefined, month: string | undefined): string {
  if (previous === undefined || !month) return 'Bulan sebelumnya belum tersedia'
  const reference = monthName(month)
  if (previous === 0) return value === 0 ? `Tetap 0 vs ${reference}` : `Naik dari 0 vs ${reference}`
  return `${formatSignedPercent((value - previous) / previous * 100)} vs ${reference}`
}

function countLabels(skus: readonly InventorySku[]) {
  return { fast: skus.filter((sku) => sku.label === 'fast').length, slow: skus.filter((sku) => sku.label === 'slow').length }
}

export default function Dashboard() {
  const { inventory, products, status } = useData()
  const navigate = useNavigate()
  const { skus, monthlyMovements, movementsBySku } = inventory
  const [month, setMonth] = useState('')
  const [range, setRange] = useState<MovementRange>('6')
  const [showTable, setShowTable] = useState(false)

  const latestIndex = monthlyMovements.length - 1
  const latest = monthlyMovements[latestIndex]
  const selectedIndex = monthlyMovements.findIndex((row) => row.month === month)
  const index = selectedIndex < 0 ? latestIndex : selectedIndex
  const selected = monthlyMovements[index]
  const previous = monthlyMovements[index - 1]

  if (!latest || !skus.length) return (
    <>
      <PageHeader title="Dashboard" />
      <Card><EmptyState icon={BarChart3} title="Belum ada data persediaan" description="Unggah kartu stok untuk melihat ringkasan toko."
        action={<ButtonLink to="/upload">Unggah kartu stok</ButtonLink>} /></Card>
    </>
  )

  const chartRows = movementWindow(monthlyMovements, range, selected.month)
  const labels = countLabels(skus)
  const productCount = new Set(skus.map((sku) => sku.productId)).size
  const currentStock = skus.reduce((total, sku) => total + sku.stock, 0)
  const catalogAt = (month: string | undefined) => month
    ? skus.filter((sku) => movementsBySku[sku.id]?.some((row) => row.month <= month))
    : []
  const previousStock = monthlyMovements[latestIndex - 1]
  const previousCatalog = catalogAt(previousStock?.month)
  const periodQuery = { from: selected.month, to: selected.month }
  const urgent = skus.filter((sku) => sku.action === 'restock' || sku.action === 'evaluasi').sort((a, b) =>
    Number(a.action !== 'restock') - Number(b.action !== 'restock') || a.stock - b.stock || a.id.localeCompare(b.id),
  )
  const nameOf = (sku: InventorySku) => products.find(({ id }) => id === sku.productId)?.name ?? sku.productId
  const columns: Column<InventorySku>[] = [
    { key: 'sku', header: 'SKU', rowHeader: true, cell: (sku) => <><span className="block font-semibold">{nameOf(sku)}</span><span className="text-caption-lg text-muted">{sku.variant} · {sku.size}</span></> },
    { key: 'stock', header: 'Stok terakhir', align: 'right', cell: (sku) => formatNumber(sku.stock) },
    { key: 'condition', header: 'Kondisi stok', cell: (sku) => <StatusChip kind="condition" value={sku.condition} /> },
    { key: 'action', header: 'Tindakan', cell: (sku) => sku.action && <StatusChip kind="action" value={sku.action} /> },
  ]

  return (
    <>
      <PageHeader title="Dashboard" description="Pantau persediaan toko dan lihat SKU yang perlu ditindaklanjuti."
        actions={<Select label="Periode pergerakan" value={selected.month} onChange={(event) => setMonth(event.target.value)}
          options={[...monthlyMovements].reverse().map(({ month }) => ({ value: month, label: monthName(month, true) }))} />} />
      <div className="space-y-6">
        {status.lastUpload > status.lastClassification && <Banner tone="warning" title="Data stok lebih baru dari hasil klasifikasi"
          actions={<ButtonLink to="/klasifikasi" variant="secondary">Jalankan klasifikasi</ButtonLink>} />}
        <section aria-label="Ringkasan stok" className="grid grid-cols-2 gap-3 md:grid-cols-3 min-[1180px]:grid-cols-5">
          <Kpi title="Jenis produk" value={productCount} icon={Layers} to="/produk?view=produk"
            detail={compare(productCount, new Set(previousCatalog.map((sku) => sku.productId)).size, previousStock?.month)} />
          <Kpi title="Jumlah SKU" value={skus.length} icon={Boxes} to="/produk"
            detail={compare(skus.length, previousCatalog.length, previousStock?.month)} />
          <Kpi title="Total stok" value={currentStock} icon={Package} to="/produk?sort=stock-desc"
            detail={compare(currentStock, previousStock?.closingStock, previousStock?.month)} />
          <Kpi title="Barang masuk" value={selected.incoming} icon={ArrowDownToLine} to={filteredPath('/laporan', { tab: 'masuk', ...periodQuery })}
            detail={compare(selected.incoming, previous?.incoming, previous?.month)} />
          <Kpi title="Barang keluar" value={selected.outgoing} icon={ArrowUpFromLine} to={filteredPath('/laporan', { tab: 'keluar', ...periodQuery })}
            detail={compare(selected.outgoing, previous?.outgoing, previous?.month)} />
        </section>

        <div className="grid min-w-0 gap-6 min-[1240px]:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <Card className="min-w-0">
            <CardHeader title="Pergerakan stok" description={`${monthName(chartRows[0].month)} – ${monthName(chartRows[chartRows.length - 1].month)}`} />
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl label="Rentang grafik pergerakan" options={movementRanges} value={range} onChange={setRange} size="sm" />
              <Button variant="secondary" size="sm" className="max-sm:h-11" leftIcon={showTable ? <ChartColumn size={16} /> : <Table2 size={16} />}
                onClick={() => setShowTable((value) => !value)}>{showTable ? 'Lihat sebagai grafik' : 'Lihat sebagai tabel'}</Button>
            </div>
            {showTable ? <MovementTable rows={chartRows} selected={selected.month} /> : <MovementBarChart rows={chartRows} selected={selected.month}
              label={`Pergerakan barang masuk dan keluar. Bulan yang disorot ${monthName(selected.month, true)}.`} />}
          </Card>

          <Card>
            <CardHeader title="Komposisi pergerakan" description="Label SKU dari klasifikasi terakhir." />
            <div className="space-y-2.5">
              <CompositionLegend {...labels} />
              <CompositionBar {...labels} />
            </div>
            <ul className="my-4 divide-y divide-border">
              {products.map(({ id, name }) => {
                const productLabels = countLabels(skus.filter((sku) => sku.productId === id))
                return <li key={id} className="space-y-1 py-3"><p className="font-semibold">{name}</p><CompositionLegend {...productLabels} /></li>
              })}
            </ul>
            <ButtonLink to="/klasifikasi" variant="secondary" rightIcon={<ArrowRight size={16} />}>Lihat klasifikasi</ButtonLink>
          </Card>
        </div>

        <section aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="mb-3 text-section-title">Ringkasan tindakan</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {actions.map((action) => {
              const { label, icon: Icon } = actionMeta[action]
              return <Link key={action} to={filteredPath('/rekomendasi', { aksi: action })}
                className="grid content-start gap-2 rounded-card border border-border bg-white p-4 shadow-card hover:border-denim-200 hover:bg-denim-50/25 focus-ring">
                <span className="flex items-center gap-2 text-caption-lg font-semibold"><Icon className="h-4 w-4 shrink-0 text-denim" aria-hidden="true" /> {label}</span>
                <span className="tabular text-xl font-bold">{formatNumber(skus.filter((sku) => sku.action === action).length)} <span className="text-caption-lg font-medium text-muted">SKU</span></span>
              </Link>
            })}
          </div>
        </section>

        <Card>
          <CardHeader title="Perlu segera diperhatikan" description="SKU yang perlu diprioritaskan untuk restock atau dievaluasi karena stok menumpuk." />
          <ResponsiveTable columns={columns} rows={urgent} getRowKey={(sku) => sku.id} caption="SKU yang perlu segera diperhatikan"
            onRowClick={(sku) => navigate(skuPath(sku.id))} rowLabel={(sku) => `Lihat ${nameOf(sku)}, ${sku.variant}, ${sku.size}`}
            empty={<EmptyState icon={Package} title="Tidak ada SKU mendesak" />}
            renderCard={(sku) => (
              <>
                <span className="block font-semibold">{nameOf(sku)} · {sku.variant} · {sku.size}</span>
                <span className="my-2 block text-caption-lg text-muted">Stok terakhir <strong className="text-charcoal">{formatNumber(sku.stock)} unit</strong></span>
                <span className="flex flex-wrap gap-2"><StatusChip kind="condition" value={sku.condition} />{sku.action && <StatusChip kind="action" value={sku.action} />}</span>
              </>
            )} />
        </Card>
      </div>
    </>
  )
}
