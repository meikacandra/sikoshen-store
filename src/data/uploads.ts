interface UploadBase {
  id: string
  name: string
  at: Date
}

export type UploadRecord = UploadBase & (
  | { status: 'berhasil'; readyRows: number; skuCount: number; discardedRows: number }
  | { status: 'ditolak' | 'gagal'; reason: string }
)

export const initialUploads: readonly UploadRecord[] = [
  {
    id: 'upload-1',
    name: '3 file kartu stok (Denim, TJ Biasa, Iron Head)',
    at: new Date(2026, 5, 3, 14, 5),
    status: 'berhasil',
    readyRows: 93977,
    skuCount: 126,
    discardedRows: 702,
  },
  {
    id: 'upload-2',
    name: 'STOK TJ BIASA-50.pdf',
    at: new Date(2026, 5, 3, 13, 52),
    status: 'ditolak',
    reason: 'Format .pdf tidak didukung.',
  },
]
