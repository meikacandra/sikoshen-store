/**
 * Galeri komponen (Fase 1) — untuk memeriksa tampilan & interaksi komponen ui/.
 * Tidak masuk menu; buka lewat /komponen.
 */
import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, PackageSearch, Play, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import {
  AccordionItem,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  ConfirmDialog,
  Drawer,
  EmptyState,
  HelpTip,
  IconButton,
  Input,
  LabelChip,
  Modal,
  Pagination,
  ProgressBar,
  ResponsiveTable,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  StatusChip,
  Stepper,
  Tabs,
  sortRows,
  type Column,
  type SortState,
} from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useDebounce } from '../hooks/useDebounce'
import { formatNumber } from '../lib/format'
import type { MovementLabel, StockCondition } from '../lib/types'

interface DemoRow {
  id: string
  produk: string
  varian: string
  ukuran: string
  stok: number
  kondisi: StockCondition
  label: MovementLabel
}

// Baris contoh (hanya untuk galeri; mock data lengkap dibuat pada Fase 2)
const ROWS: DemoRow[] = [
  { id: '1', produk: 'Kemeja Denim', varian: 'Hitam', ukuran: 'L', stok: 20, kondisi: 'bawah', label: 'fast' },
  { id: '2', produk: 'Kemeja Denim', varian: 'Hitam', ukuran: 'XL', stok: 0, kondisi: 'habis', label: 'fast' },
  { id: '3', produk: 'Tony Jack Biasa', varian: 'Hitam', ukuran: '32', stok: 14, kondisi: 'bawah', label: 'fast' },
  { id: '4', produk: 'Iron Head Ultimate', varian: 'Navy', ukuran: '31', stok: 26, kondisi: 'normal', label: 'fast' },
  { id: '5', produk: 'Tony Jack Biasa', varian: 'Krem', ukuran: '36', stok: 9, kondisi: 'bawah', label: 'slow' },
  { id: '6', produk: 'Kemeja Denim', varian: 'Biru Muda', ukuran: 'XXXXL', stok: 34, kondisi: 'menumpuk', label: 'slow' },
  { id: '7', produk: 'Iron Head Ultimate', varian: 'Abu', ukuran: '38', stok: 15, kondisi: 'normal', label: 'slow' },
]

const COLUMNS: Column<DemoRow>[] = [
  { key: 'produk', header: 'Produk', cell: (r) => r.produk, sortValue: (r) => r.produk, rowHeader: true },
  { key: 'varian', header: 'Varian', cell: (r) => r.varian, sortValue: (r) => r.varian },
  { key: 'ukuran', header: 'Ukuran', cell: (r) => r.ukuran },
  { key: 'stok', header: 'Stok', cell: (r) => formatNumber(r.stok), sortValue: (r) => r.stok, align: 'right' },
  { key: 'kondisi', header: 'Kondisi stok', cell: (r) => <StatusChip kind="condition" value={r.kondisi} /> },
  { key: 'label', header: 'Label', cell: (r) => <LabelChip value={r.label} /> },
]

export default function ComponentGallery() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'semua' | 'fast' | 'slow'>('semua')
  const [seg, setSeg] = useState<'sku' | 'jenis'>('sku')
  const [query, setQuery] = useState('')
  const q = useDebounce(query, 200)
  const [sort, setSort] = useState<SortState | null>({ key: 'stok', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [progress, setProgress] = useState(35)
  const [step, setStep] = useState(1)
  const [agree, setAgree] = useState(false)
  const [chips, setChips] = useState(['Kemeja Denim', 'Fast-Moving', 'Ukuran L'])

  const rows = useMemo(() => {
    let r = ROWS
    if (tab !== 'semua') r = r.filter((x) => x.label === tab)
    if (q) r = r.filter((x) => `${x.produk} ${x.varian} ${x.ukuran}`.toLowerCase().includes(q.toLowerCase()))
    return sortRows(r, COLUMNS, sort)
  }, [tab, q, sort])

  return (
    <>
      <PageHeader
        title="Galeri komponen"
        description="Pemeriksaan Fase 1: semua komponen dasar dengan state-nya. Halaman ini tidak ada di menu."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tombol" description="Hover, fokus (Tab), loading, dan nonaktif dengan alasan." />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => toast({ title: 'Tombol utama ditekan' })}>Utama</Button>
            <Button variant="secondary" onClick={() => toast({ title: 'Tombol sekunder ditekan', tone: 'info' })}>
              Sekunder
            </Button>
            <Button variant="ghost" onClick={() => toast({ title: 'Tombol ghost ditekan', tone: 'info' })}>
              Ghost
            </Button>
            <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>
              Hapus…
            </Button>
            <Button loading loadingText="Memproses…">Simpan</Button>
            <Button disabledReason="Belum tersedia — riwayat baru 2 dari minimal 3 bulan" leftIcon={<Play className="h-4 w-4" aria-hidden="true" />}>
              Jalankan klasifikasi
            </Button>
            <IconButton aria-label="Unduh CSV" icon={<Download className="h-5 w-5" aria-hidden="true" />} onClick={() => toast({ title: 'Unduhan dimulai', tone: 'info' })} />
            <Button variant="link" onClick={() => setModal(true)}>
              Tautan
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Chip & status" description="Selalu warna + ikon + teks." />
          <div className="flex flex-wrap gap-2">
            <StatusChip kind="condition" value="habis" />
            <StatusChip kind="condition" value="bawah" />
            <StatusChip kind="condition" value="normal" />
            <StatusChip kind="condition" value="menumpuk" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip kind="action" value="restock" />
            <StatusChip kind="action" value="pantau" />
            <StatusChip kind="action" value="tahan" />
            <StatusChip kind="action" value="evaluasi" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <LabelChip value="fast" />
            <LabelChip value="slow" />
            <LabelChip value={null} />
            <Badge tone="info">Ditinjau</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <Chip key={c} onRemove={() => setChips((xs) => xs.filter((x) => x !== c))} removeLabel={`Hapus filter ${c}`}>
                {c}
              </Chip>
            ))}
            {chips.length === 0 && (
              <Button variant="link" size="sm" onClick={() => setChips(['Kemeja Denim', 'Fast-Moving', 'Ukuran L'])}>
                Kembalikan chip
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Form" />
          <div className="space-y-4">
            <Input label="Nama toko" placeholder="Sikoshen Store" hint="Teks bantu di bawah field." />
            <Input label="Email" defaultValue="owner@" error="Format email belum benar." />
            <Select
              label="Ukuran"
              options={[
                { value: '', label: 'Semua ukuran' },
                { group: 'Huruf', options: ['M', 'L', 'XL'].map((v) => ({ value: v, label: v })) },
                { group: 'Angka', options: ['28', '30', '32'].map((v) => ({ value: v, label: v })) },
              ]}
            />
            <Checkbox label="Saya mengerti data lama akan diganti" description="Contoh checkbox persetujuan." checked={agree} onChange={setAgree} />
            <p className="flex items-center gap-1.5 text-body">
              Batas median <HelpTip label="Median">Nilai tengah total barang keluar semua SKU dalam satu jenis produk.</HelpTip>
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Progres & tahapan" />
          <Stepper steps={['Pilih file', 'Periksa', 'Hasil pemeriksaan', 'Konfirmasi', 'Selesai']} current={step} />
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Mundur
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setStep((s) => Math.min(4, s + 1))}>
              Maju
            </Button>
          </div>
          <ProgressBar className="mt-6" value={progress} label="Memeriksa stok negatif" />
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setProgress((p) => Math.min(100, p + 15))}>
              +15%
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setProgress(0)}>
              Reset
            </Button>
          </div>
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      </div>

      <div className="mt-6 space-y-3">
        <Banner tone="danger" title="Unggah gagal" actions={<Button size="sm" variant="secondary" onClick={() => toast({ title: 'Mencoba lagi…', tone: 'info' })}>Coba lagi</Button>}>
          Koneksi terputus. Tidak ada data yang berubah. Kode kejadian: UPL-2406-0312.
        </Banner>
        <Banner tone="warning" title="3 SKU belum diklasifikasikan">Riwayatnya kurang dari 3 bulan.</Banner>
        <Banner tone="success" title="93.977 baris tersimpan" />
        <Banner tone="info" title="Ini bukan prediksi penjualan bulan depan" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Tabel responsif"
          description="Sorting (klik header), pencarian debounce 200 ms, tab dengan jumlah. Di ponsel berubah jadi kartu."
          action={<SegmentedControl label="Tampilan" value={seg} onChange={setSeg} options={[{ value: 'sku', label: 'Per SKU' }, { value: 'jenis', label: 'Per jenis produk' }]} />}
        />
        <Tabs
          label="Saring label"
          value={tab}
          onChange={(v) => {
            setTab(v)
            setPage(1)
          }}
          items={[
            { value: 'semua', label: 'Semua', count: ROWS.length },
            { value: 'fast', label: 'Fast', count: ROWS.filter((r) => r.label === 'fast').length },
            { value: 'slow', label: 'Slow', count: ROWS.filter((r) => r.label === 'slow').length },
          ]}
        />
        <SearchInput className="my-4 max-w-sm" value={query} onChange={setQuery} label="Cari SKU" placeholder="Cari produk, varian, ukuran…" />
        <ResponsiveTable
          caption="Contoh SKU"
          columns={COLUMNS}
          rows={rows}
          getRowKey={(r) => r.id}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(r) => toast({ title: `${r.produk} · ${r.varian} · ${r.ukuran}`, description: 'Detail SKU dibangun pada Fase 3.', tone: 'info' })}
          rowLabel={(r) => `Buka ${r.produk} ${r.varian} ${r.ukuran}`}
          groupBy={seg === 'sku' ? (r) => r.produk : undefined}
          renderCard={(r) => (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.produk}</p>
                <p className="text-caption-lg text-muted">
                  {r.varian} · {r.ukuran} · Stok {formatNumber(r.stok)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <LabelChip value={r.label} short />
                <StatusChip kind="condition" value={r.kondisi} size="sm" />
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={PackageSearch}
              title={`Tidak ada SKU yang cocok dengan '${q}'`}
              action={
                <Button variant="secondary" onClick={() => { setQuery(''); setTab('semua') }}>
                  Hapus filter
                </Button>
              }
            />
          }
        />
        <Pagination page={page} pageSize={20} total={rows.length} onChange={setPage} />
      </Card>

      <Card className="mt-6">
        <CardHeader title="Overlay & umpan balik" description="Semua menjebak fokus, tutup dengan Esc, dan mengembalikan fokus." />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal(true)}>Modal</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>Drawer</Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>Bottom sheet</Button>
          <Button variant="secondary" onClick={() => toast({ title: 'Kode disalin' })}>Toast berhasil</Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: '3 SKU ditandai sudah ditinjau',
                tone: 'info',
                action: { label: 'Batalkan', onClick: () => toast({ title: 'Penandaan dibatalkan', tone: 'info' }) },
              })
            }
          >
            Toast dengan aksi
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: 'Proses gagal', description: 'Tidak ada data yang berubah.', tone: 'danger' })}>
            Toast gagal
          </Button>
        </div>
        <div className="mt-6 space-y-2">
          <AccordionItem title="Dibuang: tanggal tidak valid" meta={<Badge tone="danger">702 baris</Badge>}>
            Contoh: "12/9/923". Baris dengan tanggal yang tidak bisa dibaca tidak disimpan.
          </AccordionItem>
          <AccordionItem title="Diperbaiki otomatis, perlu dicek ke toko" meta={<Badge tone="warning">1.642 baris</Badge>}>
            Stok negatif diubah menjadi 0.
          </AccordionItem>
        </div>
      </Card>

      <Card className="mt-6">
        <EmptyState
          icon={FileSpreadsheet}
          title="Belum ada data"
          description="Unggah kartu stok untuk mulai melihat ringkasan persediaan."
          steps={['Siapkan file kartu stok (.xlsx/.csv)', 'Unggah dan periksa hasilnya', 'Jalankan klasifikasi']}
          action={<Button onClick={() => toast({ title: 'Menuju halaman Upload', tone: 'info' })}>Unggah kartu stok</Button>}
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Contoh modal"
        description="Klik latar, tekan Esc, atau tombol Tutup."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Batal</Button>
            <Button onClick={() => { setModal(false); toast({ title: 'Disimpan' }) }}>Simpan</Button>
          </>
        }
      >
        <Input label="Catatan" placeholder="Tulis catatan…" />
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); toast({ title: 'Data contoh dihapus', tone: 'success' }) }}
        title="Hapus data contoh?"
        description="Tindakan ini hanya contoh dan tidak mengubah apa pun."
        confirmLabel="Hapus"
        tone="danger"
      />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Detail unggahan" description="3 Jun 2026, 14.05">
        <dl className="space-y-3 text-body">
          <div className="flex justify-between"><dt className="text-muted">Baris siap</dt><dd className="tabular font-semibold">93.977</dd></div>
          <div className="flex justify-between"><dt className="text-muted">SKU</dt><dd className="tabular font-semibold">126</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Dibuang</dt><dd className="tabular font-semibold">702</dd></div>
        </dl>
      </Drawer>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Filter" footer={<Button fullWidth onClick={() => setSheet(false)}>Terapkan</Button>}>
        <Select label="Jenis produk" options={[{ value: '', label: 'Semua jenis' }, { value: 'kd', label: 'Kemeja Denim' }]} />
      </BottomSheet>
    </>
  )
}
