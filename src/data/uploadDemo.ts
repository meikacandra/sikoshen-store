import { createInventory, demo, type Inventory } from './demo'
import { getDailyMovements, type DailyMovement, type MonthlyMovement } from './movements'
import { FEATURED_SKU_ID } from './skus'

export const demoFiles = ['STOK KMJ DENIM-40.xlsx', 'STOK TJ BIASA-50.xlsx', 'iron head ultimate.xlsx']

export const uploadSteps = [
  'Mengenali format file', 'Mengonversi ke format baris', 'Memeriksa tanggal',
  'Memeriksa stok negatif', 'Mendeteksi jenis ukuran',
] as const

export const stockColumns = ['Tanggal', 'Jenis_Produk', 'Varian Warna', 'Ukuran', 'Barang_Masuk', 'Barang_Keluar', 'Stok_Akhir'] as const

export const uploadSummary = { convertedRows: 94679, readyRows: 93977, discardedRows: 702, fixedRows: 1642 }

export const demoPeriodEnd = new Date(2026, 5, 30)

export type UploadScenario = 'normal' | 'failure' | 'duplicate' | 'invalid'
export type SaveMode = 'june' | 'replace'

const may = '2026-05'
const june = '2026-06'

function normalizeColumn(value: string) {
  return value.trim().replace(/^"|"$/g, '').toLocaleLowerCase('id-ID').replace(/[\s_-]+/g, '')
}

export function csvColumnCheck(header: string) {
  const delimiter = header.includes(';') && !header.includes(',') ? ';' : ','
  const names = new Set(header.split(delimiter).map(normalizeColumn))
  return stockColumns.map((name) => ({ name, present: names.has(normalizeColumn(name)) }))
}

export const templateRows = [
  ['2026-05-06', 'Kemeja Denim', 'Hitam', 'L', 30, 5, 54],
  ['2026-05-12', 'Kemeja Denim', 'Hitam', 'L', 0, 9, 45],
  ['2026-05-31', 'Tony Jack Biasa', 'Hitam', '32', 0, 4, 14],
] as const

const affectedGroups = [
  { product: 'Kemeja Denim', count: 964 },
  { product: 'Tony Jack Biasa', count: 550 },
  { product: 'Iron Head Ultimate', count: 128 },
] as const

export interface UploadIssue {
  id: number
  product: string
  date: string
  field: string
  original: string | number
  result: string
  status: 'Dibuang' | 'Diperbaiki' | 'Diabaikan'
}

/** Daftar masalah tiruan yang sesuai dengan jumlah pada hasil pemeriksaan. */
export function uploadIssues(): UploadIssue[] {
  const items: Omit<UploadIssue, 'id'>[] = []
  const groupNames = affectedGroups.map(({ product }) => product)
  for (let i = 0; i < uploadSummary.discardedRows; i++) {
    items.push({ product: groupNames[i % 3], date: '12/9/923', field: 'Tanggal', original: '12/9/923', result: 'Tanggal tidak valid', status: 'Dibuang' })
  }
  for (const { product, count } of affectedGroups) {
    for (let i = 0; i < count; i++) {
      items.push({ product, date: `2026-05-${String(i % 31 + 1).padStart(2, '0')}`, field: 'Stok_Akhir',
        original: -1 - i % 8, result: '0', status: 'Diperbaiki' })
    }
  }
  for (let i = 0; i < 21; i++) {
    items.push({ product: groupNames[i % 3], date: '2026-05-31', field: 'Stok_Akhir', original: '(kosong)', result: 'Nilai kosong diabaikan', status: 'Diabaikan' })
  }
  return items.map((item, index) => ({ id: index + 1, ...item }))
}

function correctedDenimMay(row: MonthlyMovement): MonthlyMovement {
  const transactions = getDailyMovements(FEATURED_SKU_ID, row)
  const last = transactions.find((item) => item.date === '2026-05-31')
  // Koreksi bersifat idempoten saat file contoh yang sama diunggah ulang.
  if (!last || last.outgoing !== 6 || last.closingStock < 4) return row
  return {
    ...row, outgoing: row.outgoing + 4, closingStock: row.closingStock - 4,
    transactions: transactions.map((item) => item === last ? { ...item, outgoing: item.outgoing + 4, closingStock: item.closingStock - 4 } : item),
  }
}

function sourceInventory(inventory: Inventory): Inventory {
  return inventory.skus.length ? inventory : demo.inventory
}

export function duplicatePreview(inventory: Inventory) {
  const current = sourceInventory(inventory).movementsBySku[FEATURED_SKU_ID]?.find((row) => row.month === may)
  if (!current) return []
  return [
    { label: 'Tersimpan', row: current },
    { label: 'File baru', row: correctedDenimMay(current) },
  ].map(({ label, row }) => {
    const recent = getDailyMovements(FEATURED_SKU_ID, row).filter(({ date }) => date >= '2026-05-25')
    return {
      label,
      incoming: recent.reduce((total, entry) => total + entry.incoming, 0),
      outgoing: recent.reduce((total, entry) => total + entry.outgoing, 0),
      closingStock: row.closingStock,
    }
  })
}

export function applyDemoUpload(inventory: Inventory, mode: SaveMode): Inventory {
  const source = sourceInventory(inventory)
  const histories = Object.fromEntries(source.profiles.map((profile, index) => {
    const history = [...(source.movementsBySku[profile.id] ?? [])]
      .filter((row) => row.month !== june)
      .map((row) => row.month === may && profile.id === FEATURED_SKU_ID && mode === 'replace' ? correctedDenimMay(row) : row)
    const previous = history.filter(({ month }) => month < june).sort((a, b) => b.month.localeCompare(a.month))[0]
    const openingStock = previous?.closingStock ?? profile.stock
    const incoming = index % 4 + 3
    const outgoing = Math.min(openingStock + incoming, index % 5 + 2)
    const closingStock = openingStock + incoming - outgoing
    const transactions: DailyMovement[] = [
      { date: '2026-06-04', incoming, outgoing: 0, closingStock: openingStock + incoming },
      { date: '2026-06-21', incoming: 0, outgoing, closingStock },
    ]
    const juneRow: MonthlyMovement = { month: june, openingStock, incoming, outgoing, closingStock, transactions }
    return [profile.id, [...history, juneRow].sort((a, b) => a.month.localeCompare(b.month))]
  }))
  return createInventory(source.profiles, histories)
}
