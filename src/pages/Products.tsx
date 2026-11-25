import { useState } from 'react'
import { Download, Filter, PackageSearch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { SkuTable, skuColumns, type CatalogSku } from '../components/inventory/SkuTable'
import { AccordionItem, BottomSheet, Button, ButtonLink, Card, Chip, EmptyState, LabelChip, Pagination, SearchInput, SegmentedControl, Select, Tabs, conditionMeta, labelMeta, sortRows, type SortState } from '../components/ui'
import { useData } from '../context/DataContext'
import { useProductFilters, type QuickFilter } from '../hooks/useProductFilters'
import { downloadCsv } from '../lib/exportCsv'
import { formatNumber, formatUnit } from '../lib/format'
import { skuPath } from '../lib/inventoryViews'

const PAGE_SIZE = 20

const quickOptions: Array<{ value: QuickFilter; label: string }> = [
  { value: 'semua', label: 'Semua' }, { value: 'fast', label: 'Fast' }, { value: 'slow', label: 'Slow' },
  { value: 'habis', label: 'Habis' }, { value: 'menumpuk', label: 'Menumpuk' },
]
const views: Array<{ value: 'sku' | 'produk'; label: string }> = [
  { value: 'sku', label: 'Per SKU' }, { value: 'produk', label: 'Per jenis produk' },
]

function matchesQuick(sku: CatalogSku, quick: QuickFilter) {
  if (quick === 'fast' || quick === 'slow') return sku.label === quick
  return quick === 'semua' || sku.condition === quick
}

function parseSort(value: string): SortState | null {
  const [key, dir, extra] = value.split('-')
  if (extra || (dir !== 'asc' && dir !== 'desc') || !skuColumns.some((column) => column.key === key)) return null
  return { key, dir }
}

function ProductGroupRows({ rows, sort, onSort, onOpen }: {
  rows: CatalogSku[]
  sort: SortState | null
  onSort: (value: SortState) => void
  onOpen: (sku: CatalogSku) => void
}) {
  const [requestedPage, setPage] = useState(1)
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)))
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <SkuTable rows={visible} sort={sort} onSortChange={(value) => { setPage(1); onSort(value) }} onOpen={onOpen} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
    </>
  )
}

export default function Products() {
  const { inventory, products } = useData()
  const filters = useProductFilters()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const productFilter = filters.get('produk')
  const selectedProduct = products.find(({ id }) => id === productFilter)
  const catalog = inventory.skus.map((sku): CatalogSku => ({
    ...sku, productName: products.find(({ id }) => id === sku.productId)?.name ?? sku.productId,
  }))
  const sort = parseSort(filters.sortParam)
  const filtered = catalog.filter((sku) => {
    if (!matchesQuick(sku, filters.quick)) return false
    if (productFilter && sku.productId !== productFilter) return false
    if (filters.get('varian') && sku.variant !== filters.get('varian')) return false
    if (filters.get('ukuran') && sku.size !== filters.get('ukuran')) return false
    if (filters.get('kondisi') && sku.condition !== filters.get('kondisi')) return false
    if (filters.get('label') && (sku.label ?? 'belum') !== filters.get('label')) return false
    return `${sku.productName} ${sku.variant} ${sku.size} ${sku.id}`.toLocaleLowerCase('id-ID').includes(filters.search)
  })

  const grouped = new Map<string, CatalogSku[]>()
  filtered.forEach((sku) => {
    const rows = grouped.get(sku.productId)
    if (rows) rows.push(sku)
    else grouped.set(sku.productId, [sku])
  })
  const groups = Array.from(grouped.values(), (rows) => sortRows(rows, skuColumns, sort))
  if (sort?.key === 'product') {
    groups.sort((a, b) => a[0].productName.localeCompare(b[0].productName, 'id') * (sort.dir === 'asc' ? 1 : -1))
  }
  const sorted = groups.flat()
  const page = Math.min(filters.page, Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)))
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openSku = (sku: CatalogSku) => navigate(skuPath(sku.id))
  const onSort = (value: SortState) => filters.update({ sort: `${value.key}-${value.dir}` })
  const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }))
  const variantValues = selectedProduct ? selectedProduct.variants : [...new Set(products.flatMap(({ variants }) => variants))]
  const sizeValues = selectedProduct ? selectedProduct.sizes : [...new Set(products.flatMap(({ sizes }) => sizes))]
  const sizeGroups = [
    { group: 'Ukuran huruf', options: options(sizeValues.filter((size) => !Number(size))) },
    { group: 'Ukuran angka', options: options(sizeValues.filter((size) => Number(size))) },
  ].filter(({ options }) => options.length)
  const conditionOptions = Object.entries(conditionMeta).map(([value, { label }]) => ({ value, label }))
  const labelOptions = [
    ...Object.entries(labelMeta).map(([value, { label }]) => ({ value, label })),
    { value: 'belum', label: 'Belum ada label' },
  ]
  const filterFields = [
    { key: 'produk', title: 'Jenis produk', options: products.map(({ id, name }) => ({ value: id, label: name })) },
    { key: 'varian', title: 'Varian warna', options: options(variantValues) },
    { key: 'ukuran', title: 'Ukuran', options: sizeGroups },
    { key: 'kondisi', title: 'Kondisi stok', options: conditionOptions },
    { key: 'label', title: 'Label', options: labelOptions },
  ] as const

  const active = filterFields.flatMap((field) => {
    const value = filters.get(field.key)
    const option = field.options.flatMap((entry): ReadonlyArray<{ value: string; label: string }> =>
      'group' in entry ? entry.options : [entry]).find((entry) => entry.value === value)
    return value ? [{ key: field.key, label: option?.label ?? value }] : []
  })
  const filterCount = active.length + Number(filters.quick !== 'semua')
  const filteredState = !!filters.query || filterCount > 0
  const downloadDisabledReason = filters.searchPending ? 'Tunggu sampai hasil pencarian diperbarui.'
    : !sorted.length ? 'Tidak ada baris untuk diunduh.' : undefined
  const renderFilters = () => filterFields.map((field) => (
    <Select key={field.key} label={field.title} value={filters.get(field.key)}
      onChange={(event) => filters.update(field.key === 'produk'
        ? { produk: event.target.value, varian: '', ukuran: '' } : { [field.key]: event.target.value })}
      options={[{ value: '', label: 'Semua' }, ...field.options]} />
  ))

  function download() {
    downloadCsv('sikoshen-produk-stok.csv',
      ['Kode SKU', 'Produk', 'Varian', 'Ukuran', 'Stok terakhir', 'Total masuk', 'Total keluar', 'Kondisi stok', 'Label'],
      sorted.map((sku) => [
        sku.id, sku.productName, sku.variant, sku.size, sku.stock, sku.totalIncoming, sku.totalOutgoing,
        conditionMeta[sku.condition].label, sku.label ? labelMeta[sku.label].label : 'Belum ada label',
      ]),
    )
  }

  return (
    <>
      <PageHeader title="Produk & Stok" description="Cari SKU untuk melihat stok, riwayat pergerakan, dan labelnya."
        actions={<Button variant="secondary" leftIcon={<Download size={18} />} onClick={download}
          disabledReason={downloadDisabledReason}>Unduh CSV</Button>} />
      {!catalog.length ? <Card><EmptyState title="Belum ada produk" icon={PackageSearch}
        description="Unggah kartu stok untuk menampilkan SKU toko." action={<ButtonLink to="/upload">Unggah kartu stok</ButtonLink>} /></Card> : (
        <div className="space-y-5">
          <aside className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-denim-200 bg-denim-50 px-4 py-3 sm:px-6">
            <div><p className="font-bold text-denim">Jenis produk ≠ SKU</p><p className="text-caption-lg text-muted">Satu SKU mewakili satu kombinasi produk, warna, dan ukuran.</p></div>
            <div className="flex flex-wrap items-center gap-1.5 text-caption font-semibold text-denim" aria-label="Contoh SKU">
              {['Kemeja Denim', 'Hitam', 'L'].map((part, index) => (
                <span key={part} className="inline-flex items-center gap-1.5">{index > 0 && <span aria-hidden="true">+</span>}<span className="rounded-full bg-white px-2.5 py-1">{part}</span></span>
              ))}
              <span aria-hidden="true">=</span><span>1 SKU</span>
            </div>
          </aside>

          <Card className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="flex w-full min-w-0 items-center gap-2 sm:max-w-sm">
                <SearchInput className="min-w-0 flex-1" label="Cari SKU" placeholder="Cari SKU" value={filters.query}
                  onChange={(value) => filters.update({ q: value }, true)} />
                <Button variant="secondary" className="sm:hidden" leftIcon={<Filter size={17} />} onClick={() => setSheetOpen(true)}>
                  Filter{filterCount ? ` (${filterCount})` : ''}
                </Button>
              </div>
              <SegmentedControl options={views} value={filters.view} onChange={(view) => filters.update({ view: view === 'sku' ? '' : view })} label="Tampilan katalog" />
            </div>
            <div className="mb-4 hidden grid-cols-2 gap-3 rounded-control bg-surface p-4 sm:grid lg:grid-cols-3 xl:grid-cols-5">{renderFilters()}</div>
            {filteredState && <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Filter aktif">
              {filters.query && <Chip className="max-w-full" onRemove={() => filters.update({ q: '' })} removeLabel="Hapus pencarian"><span className="min-w-0 truncate">Cari: {filters.query}</span></Chip>}
              {filters.quick !== 'semua' && <Chip onRemove={() => filters.update({ tab: '' })} removeLabel="Hapus tab cepat">{quickOptions.find(({ value }) => value === filters.quick)?.label}</Chip>}
              {active.map(({ key, label }) => (
                <Chip key={key} onRemove={() => filters.update({ [key]: '' })} removeLabel={`Hapus filter ${label}`}>{label}</Chip>
              ))}
              <Button size="sm" variant="link" onClick={filters.clear}>Hapus semua filter</Button>
            </div>}

            <Tabs idPrefix="sku-quick" label="Filter cepat stok" value={filters.quick}
              items={quickOptions.map((item) => ({ ...item, count: catalog.filter((sku) => matchesQuick(sku, item.value)).length }))}
              onChange={(tab) => filters.update({ tab: tab === 'semua' ? '' : tab })} />
            <div id="sku-quick-panel" role="tabpanel" aria-labelledby={`sku-quick-${filters.quick}`} aria-busy={filters.searchPending} className="mt-4">
              {!!sorted.length && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-caption-lg text-muted" aria-live="polite">{formatNumber(sorted.length)} SKU{sort && filters.view === 'sku' ? ' · Diurutkan per jenis produk' : ''}</p>
                <div className="w-full sm:hidden">
                  <Select label="Urutkan SKU" value={filters.sortParam} onChange={(event) => filters.update({ sort: event.target.value })}
                    options={[{ value: '', label: 'Urutan awal' }, ...skuColumns.map(({ key, header }) => ({
                      group: String(header),
                      options: [
                        { value: `${key}-asc`, label: `${header} · menaik` },
                        { value: `${key}-desc`, label: `${header} · menurun` },
                      ],
                    }))]} />
                </div>
              </div>}
              {!sorted.length ? (
                <EmptyState icon={PackageSearch} title={filters.appliedQuery ? `Tidak ada SKU yang cocok dengan “${filters.appliedQuery}”` : 'Tidak ada SKU yang cocok'}
                  className="break-words" description="Coba kata kunci lain atau ubah filter." action={<Button variant="secondary" onClick={filters.clear}>Hapus filter</Button>} />
              ) : filters.view === 'sku' ? (
                <>
                  <SkuTable rows={visible} sort={sort} onSortChange={onSort} onOpen={openSku} grouped />
                  <Pagination page={page} pageSize={PAGE_SIZE} total={sorted.length} onChange={(value) => filters.update({ page: value === 1 ? '' : String(value) })} />
                </>
              ) : (
                <div className="space-y-3">
                  {groups.map((rows) => (
                    <AccordionItem key={rows[0].productId} title={rows[0].productName}
                      meta={<span className="text-right text-caption-lg text-muted">{formatNumber(rows.length)} SKU <span className="block sm:ml-2 sm:inline">{formatUnit(rows.reduce((total, sku) => total + sku.stock, 0))}</span></span>}>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {(['fast', 'slow'] as const).map((label) => <span key={label} className="inline-flex items-center gap-1.5"><LabelChip value={label} /> <span className="text-caption-lg text-muted">{rows.filter((sku) => sku.label === label).length} SKU</span></span>)}
                      </div>
                      <ProductGroupRows rows={rows} sort={sort} onSort={onSort} onOpen={openSku} />
                    </AccordionItem>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter produk"
        footer={<Button onClick={() => setSheetOpen(false)} fullWidth>Lihat {formatNumber(sorted.length)} SKU</Button>}>
        <div className="space-y-3">{renderFilters()}{filteredState && <Button variant="link" onClick={filters.clear}>Hapus semua filter</Button>}</div>
      </BottomSheet>
    </>
  )
}
