import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Download, FileSpreadsheet, FolderOpen, UploadCloud, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ProcessProgress } from '../components/inventory/ProcessProgress'
import { UploadHistory } from '../components/inventory/UploadHistory'
import { UploadReview } from '../components/inventory/UploadReview'
import { PageHeader } from '../components/layout/PageHeader'
import { Banner, Button, Card, CardHeader, Checkbox, Modal, ResponsiveTable, Select, StatusChip, Stepper, type Column } from '../components/ui'
import { useClassificationProcess } from '../context/ClassificationProcessContext'
import { useData } from '../context/DataContext'
import { useDemo } from '../context/DemoContext'
import { useToast } from '../context/ToastContext'
import { applyDemoUpload, csvColumnCheck, demoFiles, demoPeriodEnd, duplicatePreview, stockColumns, templateRows, uploadSteps, uploadSummary, type SaveMode, type UploadScenario } from '../data/uploadDemo'
import { useSimulatedProcess } from '../hooks/useSimulatedProcess'
import { apiFetchState, apiRecordUploadProblem, apiSaveUpload, apiStartUploadCheck, type UploadCheckJobResult } from '../lib/api'
import { cn } from '../lib/cn'
import { downloadCsv } from '../lib/exportCsv'
import { formatDateTime, formatNumber, formatPeriod } from '../lib/format'

const stages = ['Pilih file', 'Periksa', 'Hasil pemeriksaan', 'Konfirmasi', 'Selesai']
const scenarioOptions: Array<{ value: UploadScenario; label: string }> = [
  { value: 'normal', label: 'Pemeriksaan normal' },
  { value: 'failure', label: 'Unggah gagal (koneksi terputus)' },
  { value: 'duplicate', label: 'Periode duplikat' },
  { value: 'invalid', label: 'Validasi gagal (kolom tidak lengkap)' },
]

type ChosenFile = { name: string; file?: File }
type CheckedColumn = ReturnType<typeof csvColumnCheck>[number]
type DuplicateRow = ReturnType<typeof duplicatePreview>[number]
const columnChecks: Column<CheckedColumn>[] = [
  { key: 'name', header: 'Kolom wajib', rowHeader: true, cell: (row) => row.name },
  { key: 'present', header: 'Status', cell: (row) => <StatusChip kind="tone" tone={row.present ? 'success' : 'danger'}
    label={row.present ? 'Ada' : 'Tidak ditemukan'} /> },
]

const duplicateColumns: Column<DuplicateRow>[] = [
  { key: 'label', header: 'Sumber', rowHeader: true, cell: (row) => <strong>{row.label}</strong> },
  { key: 'incoming', header: 'Masuk', align: 'right', cell: (row) => formatNumber(row.incoming) },
  { key: 'outgoing', header: 'Keluar', align: 'right', cell: (row) => formatNumber(row.outgoing) },
  { key: 'stock', header: 'Stok akhir', align: 'right', cell: (row) => formatNumber(row.closingStock) },
]

function downloadTemplate() {
  downloadCsv('template-kartu-stok.csv', stockColumns, templateRows)
}

async function checkColumns(files: readonly ChosenFile[], scenario: UploadScenario) {
  if (scenario === 'invalid') return { file: files[0].name, columns: csvColumnCheck(stockColumns.slice(0, 5).join(',')) }
  for (const { file, name } of files) {
    if (!file || !/\.csv$/i.test(name)) continue
    const header = (await file.slice(0, 8192).text()).split(/\r?\n/).find((line) => line.trim()) ?? ''
    const columns = csvColumnCheck(header)
    if (columns.some(({ present }) => !present)) return { file: name, columns }
  }
  return null
}

export default function Upload() {
  const { dispatch, inventory, status, uploads } = useData()
  const classification = useClassificationProcess()
  const demo = useDemo()
  const { toast } = useToast()
  const navigate = useNavigate()
  const process = useSimulatedProcess({ steps: uploadSteps, durationMs: 4000 })
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState(0)
  const [files, setFiles] = useState<ChosenFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [formError, setFormError] = useState('')
  const [scenario, setScenario] = useState<UploadScenario>('normal')
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof checkColumns>>>(null)
  const [errorCode, setErrorCode] = useState('')
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateApproved, setDuplicateApproved] = useState(false)
  const [saveMode, setSaveMode] = useState<SaveMode>('june')
  const [savedAt, setSavedAt] = useState<Date>()
  const [saving, setSaving] = useState(false)
  const activeRun = useRef(0)
  useEffect(() => () => { activeRun.current += 1 }, [])

  const fileName = files.length === 1 ? files[0].name : `${files.length} file kartu stok (${files.map(({ name }) => name).join(', ')})`
  function recordProblem(type: 'ditolak' | 'gagal', name: string, reason: string) {
    const at = new Date()
    dispatch({ type: 'upload/recorded', record: { id: `upload-${at.getTime()}`, name, at, status: type, reason } })
    if (demo.scenario === 'normal') {
      void apiRecordUploadProblem(type, name, reason)
        .then(() => apiFetchState())
        .then((hydrated) => dispatch({ type: 'backend/hydrate', state: hydrated }))
        .catch(() => {})
    }
  }

  function chooseFiles(selected: ChosenFile[]) {
    setFormError('')
    setValidation(null)
    const invalid = selected.filter(({ name }) => !/\.(?:xlsx|csv)$/i.test(name))
    if (invalid.length || selected.length > 3) {
      const reason = invalid.length ? `Format tidak didukung: ${invalid.map(({ name }) => name).join(', ')}.` : 'Pilih paling banyak tiga file dalam satu unggahan.'
      setFiles([])
      setFormError(reason)
      recordProblem('ditolak', selected.map(({ name }) => name).join(', '), reason)
      return
    }
    setFiles(selected)
  }

  function startCheck() {
    if (!files.length) return
    const run = ++activeRun.current
    const checks = checkColumns(files, scenario).then((value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }))
    function fail(reason: string, backendCode?: string | null) {
      setErrorCode(backendCode || `UPL-${Date.now().toString(36).toUpperCase()}`)
      if (backendCode && demo.scenario === 'normal') {
        void apiFetchState()
          .then((hydrated) => dispatch({ type: 'backend/hydrate', state: hydrated }))
          .catch(() => {})
      } else {
        recordProblem('gagal', fileName, reason)
      }
    }
    setErrorCode('')
    setValidation(null)
    setSaveMode('june')
    setStage(1)
    const shouldFail = scenario === 'failure' || demo.consumeFailure()
    const useLiveBackend = demo.scenario === 'normal'

    process.start<UploadCheckJobResult>({
      forceFailure: shouldFail,
      backendJob: useLiveBackend
        ? () => apiStartUploadCheck({ files, scenario, forceFailure: shouldFail })
        : undefined,
      onFailure: (backendErrCode, backendReason) =>
        fail(backendReason || 'Koneksi terputus saat memeriksa file.', backendErrCode),
      onSuccess: (backendResult) => {
        if (backendResult) {
          if (run !== activeRun.current) return
          setStage(2)
          if (backendResult.validation) {
            setValidation(backendResult.validation)
            void apiFetchState()
              .then((hydrated) => dispatch({ type: 'backend/hydrate', state: hydrated }))
              .catch(() => {})
          } else if (backendResult.duplicate || scenario === 'duplicate') {
            setDuplicateApproved(false)
            setDuplicateOpen(true)
          }
          return
        }
        void checks.then((result) => {
          if (run !== activeRun.current) return
          if (!result.ok) {
            fail('File tidak dapat dibaca. Pilih ulang file dan coba lagi.')
            return
          }
          setStage(2)
          if (result.value) {
            setValidation(result.value)
            recordProblem('ditolak', result.value.file, 'Kolom wajib tidak lengkap.')
          } else if (scenario === 'duplicate') {
            setDuplicateApproved(false)
            setDuplicateOpen(true)
          }
        })
      },
    })
  }

  function cancelToFiles(title: string) {
    activeRun.current += 1
    process.cancel()
    setDuplicateOpen(false)
    setValidation(null)
    setErrorCode('')
    setStage(0)
    toast({ tone: 'info', title })
  }

  async function save() {
    if (status.classificationRunning || stage !== 3 || saving) return
    const at = new Date()
    if (demo.scenario === 'normal') {
      setSaving(true)
      try {
        const hydrated = await apiSaveUpload({
          fileName,
          saveMode,
          readyRows: uploadSummary.readyRows,
          discardedRows: uploadSummary.discardedRows,
        })
        dispatch({ type: 'backend/hydrate', state: hydrated })
        setSavedAt(hydrated.status.lastUpload)
        setStage(4)
        toast({ title: 'Kartu stok tersimpan', description: 'Data persediaan di MySQL sudah diperbarui.' })
        setSaving(false)
        return
      } catch {
        setSaving(false)
      }
    }
    const updated = applyDemoUpload(inventory, saveMode)
    dispatch({
      type: 'upload/saved', at, periodEnd: demoPeriodEnd, inventory: updated,
      record: {
        id: `upload-${at.getTime()}`, name: fileName, at, status: 'berhasil',
        readyRows: uploadSummary.readyRows, discardedRows: uploadSummary.discardedRows, skuCount: updated.skus.length,
      },
    })
    setSavedAt(at)
    setStage(4)
    toast({ title: 'Kartu stok tersimpan', description: 'Data persediaan sudah diperbarui.' })
  }

  function runClassification() {
    classification.start()
    navigate('/klasifikasi')
  }

  return (
    <>
      <PageHeader title="Upload Kartu Stok" description="Periksa kartu stok harian sebelum memperbarui data toko." />
      <div className="space-y-6">
        <Card><Stepper steps={stages} current={stage} /></Card>
        <input ref={inputRef} type="file" accept=".csv,.xlsx" multiple hidden onChange={(event) => {
          const selected = [...(event.currentTarget.files ?? [])].map((file) => ({ name: file.name, file }))
          event.currentTarget.value = ''
          if (selected.length) chooseFiles(selected)
        }} />

        {stage === 0 && (
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Pilih kartu stok" description="Tambahkan 1–3 file Excel (.xlsx) atau CSV." />
              {formError && <Banner className="mb-4" tone="danger" title="File ditolak" assertive>
                {formError} Gunakan format seperti <code>kartu-stok.xlsx</code> atau <code>kartu-stok.csv</code>.
              </Banner>}
              <div className={cn('grid justify-items-center gap-3 rounded-card border border-dashed px-4 py-7 text-center',
                dragging ? 'border-denim bg-denim-50' : 'border-border-strong bg-surface')}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles([...event.dataTransfer.files].map((file) => ({ name: file.name, file }))) }}>
                <UploadCloud className="h-8 w-8 text-denim" aria-hidden="true" />
                <p className="font-semibold">Seret file ke sini</p>
                <Button variant="secondary" leftIcon={<FolderOpen size={17} />} onClick={() => inputRef.current?.click()}>Pilih file</Button>
              </div>

              {!!files.length && <ul aria-label="File terpilih" className="mt-4 divide-y divide-border rounded-control border border-border">
                {files.map(({ name }, index) => <li key={`${name}-${index}`} className="flex items-center gap-2 px-3">
                  <FileSpreadsheet size={17} className="shrink-0 text-denim" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-all text-caption-lg font-semibold">{name}</span>
                  <Button size="icon" variant="ghost" aria-label={`Hapus ${name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))}><X size={18} /></Button>
                </li>)}
              </ul>}

              <div className="mt-4 rounded-control border border-border bg-surface p-3">
                <Select label="Skenario demo pemeriksaan" value={scenario} options={scenarioOptions} onChange={(event) => setScenario(event.target.value as UploadScenario)} />
                <Button className="mt-2 max-w-full !whitespace-normal text-left" variant="link"
                  onClick={() => chooseFiles(demoFiles.map((name) => ({ name })))}>Gunakan contoh 3 file toko</Button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button className="max-sm:w-full" disabledReason={!files.length ? 'Pilih satu sampai tiga file terlebih dahulu.' : undefined}
                  rightIcon={<ArrowRight size={17} />} onClick={startCheck}>Periksa file</Button>
              </div>
            </Card>

            <Card className="self-start">
              <CardHeader title="Format yang diterima" />
              <dl className="space-y-4">
                <div><dt className="font-semibold">A. Kartu stok asli toko</dt><dd className="text-caption-lg text-muted">File Excel dengan format melebar per jenis produk.</dd></div>
                <div><dt className="font-semibold">B. Format baris</dt><dd className="text-caption-lg text-muted">Satu baris per transaksi, dengan tujuh kolom berikut.</dd></div>
              </dl>
              <p className="my-4 text-caption-lg leading-6 text-muted">{stockColumns.join(' · ')}</p>
              <Button leftIcon={<Download size={17} />} variant="secondary" onClick={downloadTemplate}>Unduh template</Button>
              <p className="mt-3 text-caption-lg text-muted">Terhubung ke API FastAPI &amp; database MySQL Laragon.</p>
            </Card>
          </div>
        )}

        {stage === 1 && <Card>
          <CardHeader title="Memeriksa kartu stok" description={fileName} />
          {errorCode ? <Banner tone="danger" title="Pemeriksaan gagal" assertive
            actions={<>
              <Button variant="secondary" onClick={() => {
                setErrorCode('')
                if (process.status === 'failed') process.retry()
                else startCheck()
              }}>Coba lagi</Button>
              <Button variant="secondary" onClick={() => cancelToFiles('Kembali ke pilihan file')}>Pilih file lain</Button>
            </>}>
            Tidak ada data yang berubah. Kode kejadian <code>{errorCode}</code>.
          </Banner> : <ProcessProgress steps={uploadSteps} progress={process.progress} currentStep={process.currentStep}
            onCancel={() => cancelToFiles('Pemeriksaan dibatalkan')} />}
        </Card>}

        {stage === 2 && <Card>
          <CardHeader title="Hasil pemeriksaan" description={fileName} />
          {validation ? <div className="space-y-4">
            <Banner tone="danger" assertive title="Kolom wajib tidak lengkap">
              Periksa <strong className="break-all">{validation.file}</strong> dan lengkapi kolom yang belum ditemukan.
            </Banner>
            <ResponsiveTable columns={columnChecks} rows={validation.columns} getRowKey={(row) => row.name} caption="Pemeriksaan kolom wajib"
              renderCard={(row) => <p className="flex flex-wrap items-center justify-between gap-2"><strong>{row.name}</strong>
                <StatusChip kind="tone" tone={row.present ? 'success' : 'danger'} label={row.present ? 'Ada' : 'Tidak ditemukan'} /></p>} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setScenario('normal'); cancelToFiles('Pilih ulang file'); inputRef.current?.click() }}>Pilih file lain</Button>
              <Button variant="secondary" onClick={downloadTemplate}>Unduh template</Button>
            </div>
          </div> : <>
            <UploadReview />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => cancelToFiles('Kembali ke pilihan file')}>Pilih file lain</Button>
              <Button onClick={() => setStage(3)} rightIcon={<ArrowRight size={17} />}>Lanjut ke konfirmasi</Button>
            </div>
          </>}
        </Card>}

        {stage === 3 && <>
          <Card>
            <CardHeader title="Konfirmasi penyimpanan" description="Periksa pilihan penyimpanan sebelum memperbarui persediaan." />
            <dl className="grid gap-3 text-caption-lg sm:grid-cols-3">
              <div><dt className="text-muted">File</dt><dd className="break-words font-semibold">{fileName}</dd></div>
              <div><dt className="text-muted">Baris siap disimpan</dt><dd className="font-semibold">{formatNumber(uploadSummary.readyRows)}</dd></div>
              <div><dt className="text-muted">Data yang diperbarui</dt><dd className="font-semibold">{saveMode === 'replace' ? '25–31 Mei dan Juni 2026' : 'Juni 2026'}</dd></div>
            </dl>
          </Card>
          <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white p-4 shadow-pop sm:bottom-2" aria-label="Konfirmasi simpan kartu stok">
            <p className="font-bold">Simpan {formatNumber(uploadSummary.readyRows)} baris?</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => cancelToFiles('Penyimpanan dibatalkan')}>Batalkan &amp; perbaiki file</Button>
              <Button onClick={save} loading={saving} loadingText="Menyimpan…" disabledReason={status.classificationRunning ? 'Tunggu sampai klasifikasi selesai.' : undefined}>Simpan</Button>
            </div>
          </div>
        </>}

        {stage === 4 && <Banner tone="success" title="Kartu stok berhasil disimpan" actions={<>
          <Button onClick={runClassification} rightIcon={<ArrowRight size={17} />}>Jalankan klasifikasi</Button>
          <Button variant="secondary" onClick={() => { setStage(0); setFiles([]); setScenario('normal') }}>Unggah file lain</Button>
        </>}>
          <p>{formatNumber(uploadSummary.readyRows)} baris siap pakai · {formatNumber(inventory.skus.length)} SKU · {formatPeriod(status.periodStart, status.periodEnd)}.</p>
          {savedAt && <p className="mt-1">Disimpan {formatDateTime(savedAt)}.</p>}
        </Banner>}

        <UploadHistory uploads={uploads} />
      </div>

      <Modal open={duplicateOpen} onClose={() => cancelToFiles('Penyimpanan periode duplikat dibatalkan')} title="Periode data duplikat"
        description="Data untuk 25–31 Mei 2026 sudah tersimpan. Bandingkan sampel Kemeja Denim Hitam · L sebelum memilih." size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => cancelToFiles('Penyimpanan periode duplikat dibatalkan')}>Batalkan</Button>
          <Button variant="secondary" onClick={() => { setSaveMode('june'); setDuplicateOpen(false) }}>Simpan Juni saja</Button>
          <Button onClick={() => { setSaveMode('replace'); setDuplicateOpen(false) }}
            disabledReason={!duplicateApproved ? 'Setujui penggantian data tanggal yang sama terlebih dahulu.' : undefined}>Ganti tanggal yang sama</Button>
        </>}>
        <ResponsiveTable columns={duplicateColumns} rows={duplicatePreview(inventory)} getRowKey={(row) => row.label} caption="Perbandingan periode data duplikat"
          renderCard={(row) => <><p className="font-semibold">{row.label}</p><p>Masuk {row.incoming} · Keluar {row.outgoing} · Stok akhir {row.closingStock}</p></>} />
        <div className="mt-4">
          <Checkbox label="Saya setuju mengganti data untuk tanggal yang sama." checked={duplicateApproved} onChange={setDuplicateApproved} />
        </div>
      </Modal>
    </>
  )
}
