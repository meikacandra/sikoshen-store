import { useState } from 'react'
import { Download, Filter, PackageSearch } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Product } from '../../data/products'
import { useDebounce } from '../../hooks/useDebounce'
import { downloadCsv } from '../../lib/exportCsv'
import { formatNumber, formatUnit } from '../../lib/format'
import { skuPath, type InventorySku } from '../../lib/inventoryViews'
import { BottomSheet, Button, Card, CardHeader, EmptyState, LabelChip, Pagination, ResponsiveTable, SearchInput, Select, labelMeta, sortRows, type Column, type SortState } from '../ui'

const pageSize = 20
type Row = InventorySku & { productName: string; median: number | null; sizeType: string }
const labelText = (row: Row) => row.label ? labelMeta[row.label].label : 'Belum ada label'
const columns: Column<Row>[] = [
  { key: 'sku', header: 'SKU', rowHeader: true, sortValue: (row) => row.id, cell: (row) => <>
    <Link to={skuPath(row.id)} className="inline-block whitespace-nowrap rounded font-semibold text-denim hover:underline focus-ring">{row.id}</Link>
    <span className="block text-caption-lg text-muted">{row.productName} · {row.variant} · {row.size}</span>
  </> },
  { key: 'size', header: 'Jenis ukuran', cell: (row) => row.sizeType, sortValue: (row) => row.sizeType },
  { key: 'estimate', header: 'Estimasi total keluar', align: 'right', cell: (row) => row.label ? formatNumber(row.estimatedTotalOut) : '—',
    sortValue: (row) => row.label ? row.estimatedTotalOut : -1 },
  { key: 'median', header: 'Batas median', align: 'right', cell: (row) => row.median === null ? '—' : formatNumber(row.median),
    sortValue: (row) => row.median ?? -1 },
  { key: 'label', header: 'Label', cell: (row) => <LabelChip value={row.label} />, sortValue: labelText },
  { key: 'stock', header: 'Stok sekarang', align: 'right', cell: (row) => formatNumber(row.stock), sortValue: (row) => row.stock },
]

const labelOptions = [{ value: '', label: 'Semua label' }, { value: 'fast', label: 'Fast-Moving' },
  { value: 'slow', label: 'Slow-Moving' }, { value: 'unclassified', label: 'Belum ada label' }]

export function ClassificationResults({ skus, products }: { skus: readonly InventorySku[]; products: readonly Product[] }) {
  const [params, setParams] = useSearchParams()
  const [label, setLabel] = useState('')
  const [product, setProduct] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [requestedPage, setPage] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const query = params.get('sku') ?? params.get('q') ?? ''
  const search = useDebounce(query.trim().toLocaleLowerCase('id-ID'), 200)
  const searchPending = search !== query.trim().toLocaleLowerCase('id-ID')
  const byProduct = new Map(products.map((entry) => [entry.id, entry]))

  const matched = skus.flatMap((sku) => {
    const category = byProduct.get(sku.productId)
    const productName = category?.name ?? sku.productId
    if (product && sku.productId !== product) return []
    if (label && (sku.label ?? 'unclassified') !== label) return []
    if (!`${sku.id} ${productName} ${sku.variant} ${sku.size}`.toLocaleLowerCase('id-ID').includes(search)) return []
    return [{ ...sku, productName, median: category?.median ?? null, sizeType: category?.sizeType ?? (Number(sku.size) ? 'angka' : 'huruf') }]
  })
  const sorted = sortRows(matched, columns, sort)
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(sorted.length / pageSize)))

  function setQuery(value: string) {
    setPage(1)
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('sku')
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  function clear() {
    setLabel('')
    setProduct('')
    setQuery('')
  }

  function changeSort(value: SortState | null) {
    setSort(value)
    setPage(1)
  }

  function exportResults() {
    downloadCsv('sikoshen-hasil-klasifikasi.csv', ['SKU', 'Jenis ukuran', 'Estimasi total keluar', 'Batas median', 'Label', 'Stok sekarang'],
      sorted.map((row) => [row.id, row.sizeType, row.label ? row.estimatedTotalOut : '', row.median ?? '', labelText(row), row.stock]))
  }

  const filters = () => <>
    <Select label="Jenis produk" options={[{ value: '', label: 'Semua produk' }, ...products.map(({ id, name }) => ({ value: id, label: name }))]}
      value={product} onChange={(event) => { setProduct(event.target.value); setPage(1) }} />
    <Select label="Label pergerakan" options={labelOptions} value={label}
      onChange={(event) => { setLabel(event.target.value); setPage(1) }} />
  </>

  return (
    <Card className="min-w-0">
      <CardHeader title="Hasil klasifikasi per SKU"
        action={<Button variant="secondary" leftIcon={<Download size={17} />} onClick={exportResults}
          disabledReason={searchPending ? 'Tunggu sampai pencarian selesai.' : !sorted.length ? 'Tidak ada hasil untuk diunduh.' : undefined}>Unduh CSV</Button>} />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-2">
          <SearchInput label="Cari SKU klasifikasi" placeholder="Cari SKU" className="min-w-0 flex-1" value={query} onChange={setQuery} />
          <Button variant="secondary" className="sm:hidden" leftIcon={<Filter size={16} />} onClick={() => setSheetOpen(true)}>
            Filter{product || label ? ` (${Number(!!product) + Number(!!label)})` : ''}
          </Button>
        </div>
        <div className="hidden sm:contents">{filters()}</div>
      </div>
      {!!(product || label || query) && <Button className="mb-3" variant="link" onClick={clear}>Hapus filter</Button>}
      <div className="mb-3 sm:hidden">
        <Select label="Urutkan hasil" value={sort ? `${sort.key}-${sort.dir}` : ''}
          options={[{ value: '', label: 'Urutan awal' }, ...columns.map(({ key, header }) => ({
            group: String(header), options: [
              { value: `${key}-asc`, label: `${header} · menaik` }, { value: `${key}-desc`, label: `${header} · menurun` },
            ],
          }))]}
          onChange={(event) => {
            const [key, dir] = event.target.value.split('-')
            changeSort(dir === 'asc' || dir === 'desc' ? { key, dir } : null)
          }} />
      </div>
      <div aria-busy={searchPending}>
        <ResponsiveTable columns={columns} rows={sorted.slice((page - 1) * pageSize, page * pageSize)} getRowKey={({ id }) => id}
          caption="Hasil klasifikasi per SKU" sort={sort} onSortChange={changeSort}
          empty={<EmptyState icon={PackageSearch} title="Tidak ada SKU yang cocok" action={<Button variant="secondary" onClick={clear}>Hapus filter pencarian</Button>} />}
          renderCard={(row) => <>
            <Link to={skuPath(row.id)} className="inline-flex min-h-11 items-center break-all rounded font-bold text-denim hover:underline focus-ring">{row.id}</Link>
            <p className="mb-2 text-caption-lg text-muted">{row.productName} · {row.variant} · {row.size} ({row.sizeType})</p>
            <LabelChip value={row.label} />
            <dl className="mt-3 grid grid-cols-3 gap-2 text-caption-lg">
              <div><dt className="text-muted">Estimasi keluar</dt><dd className="tabular font-semibold">{row.label ? formatUnit(row.estimatedTotalOut) : '—'}</dd></div>
              <div><dt className="text-muted">Median</dt><dd className="tabular font-semibold">{row.median === null ? '—' : formatUnit(row.median)}</dd></div>
              <div><dt className="text-muted">Stok sekarang</dt><dd className="tabular font-semibold">{formatUnit(row.stock)}</dd></div>
            </dl>
          </>} />
        <Pagination page={page} total={sorted.length} pageSize={pageSize} onChange={setPage} />
      </div>
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter hasil klasifikasi"
        footer={<Button fullWidth onClick={() => setSheetOpen(false)}>Lihat {formatNumber(sorted.length)} SKU</Button>}>
        <div className="space-y-3">{filters()}</div>
      </BottomSheet>
    </Card>
  )
}
