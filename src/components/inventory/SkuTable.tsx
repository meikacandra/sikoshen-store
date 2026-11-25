import { ResponsiveTable, LabelChip, StatusChip, conditionMeta, labelMeta, type Column, type SortState } from '../ui'
import { formatNumber, formatUnit } from '../../lib/format'
import type { InventorySku } from '../../lib/inventoryViews'

export type CatalogSku = InventorySku & { productName: string }

const metrics = [
  { key: 'stock', header: 'Stok terakhir' },
  { key: 'totalIncoming', header: 'Total masuk' },
  { key: 'totalOutgoing', header: 'Total keluar' },
] as const

export const skuColumns: Column<CatalogSku>[] = [
  { key: 'product', header: 'Produk', rowHeader: true, cell: (sku) => <span className="font-semibold">{sku.productName}</span>, sortValue: (sku) => sku.productName },
  { key: 'variant', header: 'Varian', cell: (sku) => sku.variant, sortValue: (sku) => sku.variant },
  { key: 'size', header: 'Ukuran', cell: (sku) => sku.size, sortValue: (sku) => Number(sku.size) || ['M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'].indexOf(sku.size) },
  ...metrics.map(({ key, header }): Column<CatalogSku> => ({ key, header, align: 'right', cell: (sku) => formatNumber(sku[key]), sortValue: (sku) => sku[key] })),
  { key: 'condition', header: 'Kondisi stok', cell: (sku) => <StatusChip kind="condition" value={sku.condition} />, sortValue: (sku) => conditionMeta[sku.condition].label },
  { key: 'label', header: 'Label', cell: (sku) => <LabelChip value={sku.label} />, sortValue: (sku) => sku.label ? labelMeta[sku.label].label : 'Belum ada label' },
]

export function SkuTable({ rows, sort, onSortChange, onOpen, grouped = false }: {
  rows: CatalogSku[]
  sort: SortState | null
  onSortChange: (value: SortState) => void
  onOpen: (sku: CatalogSku) => void
  grouped?: boolean
}) {
  return (
    <ResponsiveTable rows={rows} columns={skuColumns} getRowKey={(sku) => sku.id} caption="Daftar SKU"
      groupBy={grouped ? (sku) => sku.productName : undefined}
      sort={sort} onSortChange={onSortChange} onRowClick={onOpen}
      rowLabel={(sku) => `Lihat ${sku.productName}, ${sku.variant}, ukuran ${sku.size}`}
      renderCard={(sku) => (
        <>
          <span className="block font-bold">{sku.productName} · {sku.variant} · {sku.size}</span>
          <span className="block break-all text-caption text-muted">{sku.id}</span>
          <span className="my-3 grid grid-cols-3 gap-2">
            {metrics.map(({ key, header }) => (
              <span key={key}>
                <span className="block text-caption text-muted">{header}</span>
                <span className="tabular block font-semibold">{formatUnit(sku[key])}</span>
              </span>
            ))}
          </span>
          <span className="flex flex-wrap gap-2"><StatusChip kind="condition" value={sku.condition} /><LabelChip value={sku.label} /></span>
        </>
      )} />
  )
}
