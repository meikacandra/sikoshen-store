import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForecast } from '../context/ForecastContext'
import {
  dateName,
  monthName,
  numberFmt,
  qty,
  shortDateName,
  validateStockFileSelection,
  type ImportPreviewResponse,
  type ValidationReport,
} from '../lib/planner'

interface FindingItem {
  tone: 'ok' | 'warn'
  title: string
  detail: string
}

function buildFindings(validation: ValidationReport | null): FindingItem[] {
  if (!validation) return []
  return [
    validation.balance_checked
      ? {
          tone: 'ok',
          title: 'Rumus stok cocok',
          detail: `${numberFmt.format(validation.balance_match_count)} dari ${numberFmt.format(validation.balance_total_count)} baris memenuhi stok kemarin + masuk − keluar + opname.`,
        }
      : {
          tone: 'ok',
          title: 'Format tabel harian terbaca',
          detail: `${numberFmt.format(validation.total_rows)} baris harian dari ${validation.total_skus} SKU lolos validasi kolom wajib dan tanggal.`,
        },
    validation.negative_stock_rows > 0
      ? {
          tone: 'warn',
          title: 'Stok negatif ditemukan',
          detail: `${numberFmt.format(validation.negative_stock_rows)} baris pada ${validation.negative_stock_skus} SKU. Angka stok dipotong ke 0; penjualannya tetap dihitung.`,
        }
      : {
          tone: 'ok',
          title: 'Tidak ada stok negatif',
          detail: 'Seluruh baris Stok_Akhir bernilai >= 0.',
        },
    ...(validation.opname_events > 0
      ? [
          {
            tone: 'warn' as const,
            title: 'Koreksi stock opname',
            detail: `${numberFmt.format(validation.opname_events)} kejadian pada ${validation.opname_skus} SKU (+${numberFmt.format(validation.opname_plus)} / ${numberFmt.format(validation.opname_minus)} unit).`,
          },
        ]
      : []),
    {
      tone: validation.unrecorded_periods.length > 0 ? 'warn' : 'ok',
      title: 'Periode tidak dicatat',
      detail:
        validation.unrecorded_periods.length > 0
          ? `${validation.unrecorded_periods.length} jeda lebih dari 7 hari. Bulan dengan cakupan di bawah 75% tidak dipakai sebagai target.`
          : 'Tidak ada jeda pencatatan lebih dari 7 hari pada riwayat yang diunggah.',
    },
  ]
}

function formatProductCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts)
  if (entries.length === 0) return '—'
  return entries.map(([name, count]) => `${name} (${count} SKU)`).join(' · ')
}

export default function UnggahData() {
  const {
    data,
    validation,
    modelMeta,
    restoreInfo,
    ramadanMaxYear,
    busy,
    previewImport,
    commitImport,
    cancelImportPreview,
    restorePreviousForecast,
    setError,
    setNotice,
  } = useForecast()

  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [validating, setValidating] = useState(false)
  const [actionError, setActionError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [confirmReduction, setConfirmReduction] = useState(false)
  const [needsRePreview, setNeedsRePreview] = useState(false)
  const [justCommitted, setJustCommitted] = useState(false)
  const [showMissingSkus, setShowMissingSkus] = useState(false)

  const addMoreInputRef = useRef<HTMLInputElement | null>(null)
  const previewHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const shouldFocusPreviewRef = useRef(false)
  const dragDepthRef = useRef(0)
  const navigate = useNavigate()

  // Cegah browser membuka file yang dilepas di luar area unggah selama halaman aktif
  useEffect(() => {
    const preventWindowDrop = (event: globalThis.DragEvent) => {
      event.preventDefault()
    }
    window.addEventListener('dragover', preventWindowDrop)
    window.addEventListener('drop', preventWindowDrop)
    return () => {
      window.removeEventListener('dragover', preventWindowDrop)
      window.removeEventListener('drop', preventWindowDrop)
    }
  }, [])

  // Arahkan scroll dan fokus keyboard ke judul panel Pratinjau segera setelah pratinjau muncul
  useEffect(() => {
    if (preview && shouldFocusPreviewRef.current) {
      shouldFocusPreviewRef.current = false
      const frame = window.requestAnimationFrame(() => {
        const heading = previewHeadingRef.current
        if (!heading) return
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
        heading.focus({ preventScroll: true })
      })
      return () => window.cancelAnimationFrame(frame)
    }
  }, [preview])

  async function runPreview(nextFiles: File[]) {
    if (preview) {
      await cancelImportPreview(preview.preview_id)
      setPreview(null)
    }
    setConfirmReduction(false)
    setNeedsRePreview(false)
    setJustCommitted(false)
    setShowMissingSkus(false)
    setActionError('')
    setError('')
    setNotice('')

    if (nextFiles.length === 0) {
      return
    }

    setValidating(true)
    try {
      const { preview: res, error: errMsg } = await previewImport(nextFiles)
      setValidating(false)
      if (res) {
        shouldFocusPreviewRef.current = true
        setPreview(res)
        setActionError('')
      } else if (errMsg) {
        setActionError(errMsg)
      }
    } finally {
      setValidating(false)
    }
  }

  async function handleSelectedFiles(picked: File[], mode: 'replace' | 'append') {
    if (picked.length === 0) return
    const check = validateStockFileSelection(picked)
    if (check.errorMessage) {
      setActionError(check.errorMessage)
      setError('')
      setNotice('')
      return
    }

    const nextFiles =
      mode === 'append'
        ? Array.from(
            new Map<string, File>([
              ...files.map((f): [string, File] => [f.name, f]),
              ...check.valid.map((f): [string, File] => [f.name, f]),
            ]).values(),
          )
        : check.valid

    setFiles(nextFiles)
    await runPreview(nextFiles)
  }

  async function handleRemoveFile(name: string) {
    const remaining = files.filter((f) => f.name !== name)
    setFiles(remaining)
    await runPreview(remaining)
  }

  function handleDragEnter(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (busy || validating) return
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (busy || validating) return
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    if (!isDragging) setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragging(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)
    if (busy || validating) return
    const dropped = Array.from(e.dataTransfer?.files ?? [])
    if (dropped.length === 0) return
    void handleSelectedFiles(dropped, 'replace')
  }

  async function handleCancelPreview() {
    if (preview) {
      await cancelImportPreview(preview.preview_id)
    }
    setPreview(null)
    setFiles([])
    setActionError('')
    setConfirmReduction(false)
    setNeedsRePreview(false)
    setShowMissingSkus(false)
    setError('')
    setNotice('Pratinjau impor dibatalkan. Hasil aktif sebelumnya tetap dipertahankan.')
  }

  async function handleCommit() {
    if (!preview) return
    setActionError('')
    const res = await commitImport(preview.preview_id, confirmReduction)
    if (res.ok) {
      setPreview(null)
      setFiles([])
      setConfirmReduction(false)
      setNeedsRePreview(false)
      setShowMissingSkus(false)
      setJustCommitted(true)
    } else if (res.conflict) {
      setNeedsRePreview(true)
    }
  }

  async function handleRestore() {
    if (preview) {
      await cancelImportPreview(preview.preview_id)
      setPreview(null)
      setFiles([])
      setConfirmReduction(false)
      setNeedsRePreview(false)
    }
    setActionError('')
    const ok = await restorePreviousForecast()
    if (ok) {
      setJustCommitted(false)
    }
  }

  const displayedValidation = preview ? preview.validation : validation
  const findings = buildFindings(displayedValidation)

  const activeFiles =
    files.length > 0
      ? files.map((f) => ({
          name: f.name,
          meta: `Berkas dipilih · ${(f.size / 1024).toFixed(0)} KB`,
          status: validating ? 'Memvalidasi…' : preview ? 'Pratinjau siap' : actionError ? 'Perlu diperiksa' : 'Dipilih',
          removable: true,
        }))
      : validation && validation.files.length > 0
        ? validation.files.map((f) => ({
            name: f.name,
            meta: `${f.products.join(', ')} · ${f.sku_count} SKU · ${shortDateName(f.period_start)} – ${shortDateName(f.period_end)} (${numberFmt.format(f.rows)} baris)`,
            status: 'Aktif',
            removable: false,
          }))
        : data
          ? [
              {
                name: data.source,
                meta: `${data.rows.length} SKU aktif · data terakhir ${dateName(data.period_end)}${modelMeta?.periode_data ? ` (latih ${shortDateName(modelMeta.periode_data[0])} – ${shortDateName(modelMeta.periode_data[1])})` : ''}`,
                status: 'Aktif',
                removable: false,
              },
            ]
          : []

  const canCommit =
    Boolean(preview) &&
    !busy &&
    !validating &&
    !needsRePreview &&
    (!preview?.requires_extra_confirmation || confirmReduction)

  const affectedNames = preview?.affected_products.map((p) => `${p.product} (${p.missing_count} SKU)`).join(', ') ?? ''

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Data</p>
          <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>Unggah Data Kartu Stok</h1>
          <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '720px', lineHeight: 1.5 }}>
            Pilih atau seret berkas kartu stok (.xlsx atau .csv). Sistem memvalidasi dan menampilkan pratinjau perbandingan sebelum mengganti hasil aktif.
          </p>
        </div>
        {justCommitted && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-s" onClick={() => navigate('/beranda')}>
              Buka Beranda
            </button>
            <button type="button" className="btn btn-p" onClick={() => navigate('/saran-pemesanan')}>
              Lihat Saran Pemesanan
            </button>
          </div>
        )}
      </header>

      {/* Kartu pemulihan hasil sebelumnya */}
      {restoreInfo?.available && (
        <section
          aria-label="Pemulihan hasil sebelumnya"
          style={{
            background: '#FFFFFF',
            border: '1px solid #C7D7FE',
            borderLeft: '4px solid #1D4ED8',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#17212B' }}>
              Tersedia cadangan hasil aktif sebelumnya
            </div>
            <div style={{ color: '#3F4A54', fontSize: '13.5px', marginTop: '4px', lineHeight: 1.5 }}>
              <strong>{restoreInfo.total_skus} SKU</strong> ({formatProductCounts(restoreInfo.product_counts)}) · data s.d.{' '}
              <strong>{dateName(restoreInfo.period_end)}</strong> · prediksi{' '}
              <strong>{restoreInfo.prediction_month ? monthName(restoreInfo.prediction_month) : '—'}</strong> · sumber:{' '}
              {restoreInfo.source}
            </div>
          </div>
          <button type="button" className="btn btn-s" disabled={busy || validating} onClick={handleRestore}>
            {busy && !validating ? 'Memulihkan…' : 'Pulihkan Hasil Sebelumnya'}
          </button>
        </section>
      )}

      {/* Indikator langkah */}
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E3E6E8',
          borderRadius: '12px',
          padding: '20px 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {[
          { num: 1, label: 'Pilih file', active: true },
          { num: 2, label: 'Pratinjau & validasi', active: Boolean(preview) || files.length > 0 || justCommitted },
          { num: 3, label: 'Konfirmasi impor', active: Boolean(preview) || justCommitted },
          { num: 4, label: 'Selesai', active: justCommitted && !busy },
        ].map((step) => (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 160px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                background: step.active ? '#1D4ED8' : '#FFFFFF',
                color: step.active ? '#FFFFFF' : '#5B6670',
                border: step.active ? '2px solid #1D4ED8' : '2px solid #CDD3D8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              {step.num}
            </span>
            <span style={{ fontWeight: 600, fontSize: '14px', color: step.active ? '#17212B' : '#5B6670' }}>
              {step.label}
            </span>
          </div>
        ))}
      </section>

      {/* Panel Pratinjau Perbandingan Impor */}
      {preview && (
        <section
          aria-label="Pratinjau perbandingan impor"
          style={{
            background: '#FFFFFF',
            border: preview.has_scope_reduction ? '2px solid #D97706' : '2px solid #1D4ED8',
            borderRadius: '12px',
            padding: '22px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <span className={preview.has_scope_reduction ? 'chip-s' : 'chip-f'}>
                {preview.has_scope_reduction ? 'Perlu konfirmasi pengurangan cakupan' : 'Pratinjau siap diterapkan'}
              </span>
              <h2
                ref={previewHeadingRef}
                tabIndex={-1}
                className="preview-heading"
                style={{ fontSize: '20px', margin: '8px 0 4px', fontWeight: 700, color: '#17212B' }}
              >
                Pratinjau Perbandingan Impor
              </h2>
              <p style={{ margin: 0, color: '#5B6670', fontSize: '13.5px', lineHeight: 1.5 }}>
                Hasil belum diterapkan. Beranda dan Saran Pemesanan masih menggunakan hasil aktif hingga Anda menekan <strong>Terapkan Impor</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-s"
                disabled={busy || validating}
                onClick={() => addMoreInputRef.current?.click()}
              >
                + Tambah file lain
              </button>
              {needsRePreview && (
                <button
                  type="button"
                  className="btn btn-p"
                  disabled={busy || validating || files.length === 0}
                  onClick={() => void runPreview(files)}
                >
                  {validating ? 'Memvalidasi berkas…' : 'Buat pratinjau ulang'}
                </button>
              )}
            </div>
          </div>

          {preview.is_first_import ? (
            <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#EFF4FF', color: '#1E3A8A', fontSize: '14px', lineHeight: 1.55 }}>
              <strong>Impor pertama:</strong> Belum ada hasil aktif pembanding di penyimpanan. Impor ini akan mengaktifkan{' '}
              <strong>{preview.candidate.total_skus} SKU</strong> ({formatProductCounts(preview.candidate.product_counts)}) untuk prediksi{' '}
              <strong>{monthName(preview.candidate.prediction_month)}</strong>.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: '14px' }}>
              <div style={{ padding: '16px', borderRadius: '10px', background: '#F5F6F4', border: '1px solid #E3E6E8' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#5B6670', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Hasil Aktif Saat Ini
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#17212B', marginTop: '4px' }}>
                  {preview.current?.total_skus ?? 0} SKU
                </div>
                <div style={{ fontSize: '13px', color: '#3F4A54', marginTop: '8px', lineHeight: 1.6 }}>
                  <div>Sumber: <strong>{preview.current?.source}</strong></div>
                  <div>
                    Periode data:{' '}
                    <strong>
                      {preview.current?.period_start ? `${shortDateName(preview.current.period_start)} – ` : 's.d. '}
                      {preview.current ? shortDateName(preview.current.period_end) : '—'}
                    </strong>
                  </div>
                  <div>
                    Bulan prediksi:{' '}
                    <strong>{preview.current?.prediction_month ? monthName(preview.current.prediction_month) : '—'}</strong>
                  </div>
                  <div>Total saran pesan: <strong>{qty(preview.current?.total_order)} unit</strong></div>
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '10px', background: '#EFF4FF', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Calon Hasil Impor
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#17212B', marginTop: '4px' }}>
                  {preview.candidate.total_skus} SKU
                </div>
                <div style={{ fontSize: '13px', color: '#3F4A54', marginTop: '8px', lineHeight: 1.6 }}>
                  <div>Sumber: <strong>{preview.candidate.source}</strong></div>
                  <div>
                    Periode data:{' '}
                    <strong>
                      {preview.candidate.period_start ? `${shortDateName(preview.candidate.period_start)} – ` : ''}
                      {shortDateName(preview.candidate.period_end)}
                    </strong>
                  </div>
                  <div>
                    Bulan prediksi:{' '}
                    <strong>{monthName(preview.candidate.prediction_month)}</strong> ({preview.candidate.season === 'lebaran' ? 'musim Lebaran' : 'bulan biasa'})
                  </div>
                  <div>Total saran pesan: <strong>{qty(preview.candidate.total_order)} unit</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Tabel perbandingan per jenis produk */}
          <div style={{ overflowX: 'auto' }}>
            <table className="dc-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Jenis Produk</th>
                  <th className="num">SKU Aktif</th>
                  <th className="num">Calon Impor</th>
                  <th className="num">SKU Hilang</th>
                  <th className="num">SKU Baru</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.product_breakdown.map((row) => (
                  <tr key={row.product}>
                    <td style={{ fontWeight: 600 }}>{row.product}</td>
                    <td className="num">{row.current_count}</td>
                    <td className="num">{row.candidate_count}</td>
                    <td className="num" style={{ color: row.missing_count > 0 ? '#B45309' : undefined, fontWeight: row.missing_count > 0 ? 700 : undefined }}>
                      {row.missing_count}
                    </td>
                    <td className="num" style={{ color: row.added_count > 0 ? '#1D4ED8' : undefined }}>
                      {row.added_count}
                    </td>
                    <td>
                      {row.status === 'hilang' && <span className="chip-s">Produk akan hilang</span>}
                      {row.status === 'berkurang' && <span className="chip-s">Sebagian SKU hilang</span>}
                      {row.status === 'baru' && <span className="chip-f">Produk baru</span>}
                      {row.status === 'bertambah' && <span className="chip-f">SKU bertambah</span>}
                      {row.status === 'tetap' && <span className="chip-n">Identik</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Peringatan pengurangan cakupan + konfirmasi tambahan */}
          {preview.has_scope_reduction && (
            <div
              role="alert"
              style={{
                padding: '16px 18px',
                borderRadius: '10px',
                background: '#FFF4EA',
                border: '1px solid #FDBA74',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#9A3412' }}>
                Peringatan: {preview.missing_sku_count} SKU akan hilang dari rencana jika impor diterapkan
              </div>
              <div style={{ fontSize: '13.5px', color: '#3F4A54', lineHeight: 1.55 }}>
                {preview.missing_products.length > 0 && (
                  <div>
                    Produk yang hilang sepenuhnya ({preview.missing_products.length}):{' '}
                    <strong>{preview.missing_products.join(', ')}</strong>.
                  </div>
                )}
                <div>
                  Produk terdampak: <strong>{affectedNames}</strong>.
                </div>
                <div style={{ marginTop: '4px' }}>
                  Jika Anda ingin memperbarui semua produk sekaligus, klik <strong>+ Tambah file yang kurang</strong> untuk menambahkan berkas produk lain sebelum menerapkan impor.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-s"
                  disabled={busy || validating}
                  onClick={() => addMoreInputRef.current?.click()}
                >
                  + Tambah file yang kurang
                </button>
                <button
                  type="button"
                  className="dc-link"
                  onClick={() => setShowMissingSkus((v) => !v)}
                >
                  {showMissingSkus
                    ? 'Sembunyikan daftar SKU yang akan hilang'
                    : `Lihat ${preview.missing_sku_count} SKU yang akan hilang`}
                </button>
              </div>

              {showMissingSkus && (
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: '#FFFFFF',
                    border: '1px solid #FED7AA',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    color: '#3F4A54',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
                    gap: '4px 12px',
                  }}
                >
                  {preview.missing_skus.map((sku) => (
                    <div key={`${sku.product}-${sku.variant}-${sku.size}`}>
                      {sku.product} · {sku.variant} · {sku.size}
                    </div>
                  ))}
                </div>
              )}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid #FED7AA',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#17212B',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmReduction}
                  disabled={busy || validating}
                  onChange={(e) => setConfirmReduction(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Saya memahami bahwa {preview.missing_sku_count} SKU ({affectedNames}) akan hilang dari rencana aktif dan pengurangan cakupan ini memang disengaja.
                </span>
              </label>
            </div>
          )}

          {/* Tombol aksi konfirmasi */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-s" disabled={busy || validating} onClick={handleCancelPreview}>
              Batal
            </button>
            <button type="button" className="btn btn-p" disabled={!canCommit} onClick={handleCommit}>
              {busy && !validating ? 'Menerapkan impor…' : 'Terapkan Impor'}
            </button>
          </div>
        </section>
      )}

      {/* Input tersembunyi untuk menambah file ke seleksi saat ini */}
      <input
        ref={addMoreInputRef}
        type="file"
        accept=".xlsx,.csv"
        multiple
        disabled={busy || validating}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = ''
          void handleSelectedFiles(picked, 'append')
        }}
        style={{ display: 'none' }}
      />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '16px', alignItems: 'start' }}>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E3E6E8',
            borderRadius: '12px',
            padding: '20px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>File kartu stok</h2>
            {files.length > 0 && (
              <button
                type="button"
                className="dc-link"
                disabled={busy || validating}
                onClick={() => addMoreInputRef.current?.click()}
              >
                + Tambah file
              </button>
            )}
          </div>

          <label
            htmlFor="f"
            className={'upload-dropzone' + (isDragging ? ' dragging' : '')}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-busy={validating}
          >
            <span style={{ color: '#1D4ED8' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4"></path>
                <path d="M7 9l5-5 5 5"></path>
                <path d="M4 20h16"></path>
              </svg>
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#17212B' }}>
              {validating
                ? 'Memvalidasi berkas…'
                : isDragging
                  ? 'Lepaskan berkas .xlsx atau .csv di sini'
                  : 'Seret file Excel / CSV ke sini atau pilih file'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 400, color: '#5B6670' }}>
              Format .xlsx (kartu stok asli / tabel harian) atau .csv · bisa pilih atau seret beberapa file sekaligus
            </span>
            <input
              id="f"
              type="file"
              accept=".xlsx,.csv"
              multiple
              disabled={busy || validating}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (picked.length > 0) {
                  void handleSelectedFiles(picked, 'replace')
                }
              }}
              style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
            />
          </label>

          {/* Status validasi & pesan galat spesifik tepat di dekat area unggah */}
          {validating && (
            <div className="upload-status-inline" role="status" aria-live="polite">
              <span>Memvalidasi berkas…</span>
            </div>
          )}
          {actionError && !validating && (
            <div className="fs-error" role="alert">
              {actionError}
            </div>
          )}

          <div>
            {activeFiles.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 0',
                  borderBottom: '1px solid #EEF0F1',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: '#1D4ED8' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 3h8l4 4v14H6z"></path>
                    <path d="M14 3v4h4"></path>
                  </svg>
                </span>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#17212B' }}>{item.name}</div>
                  <div style={{ color: '#5B6670', fontSize: '13px' }}>{item.meta}</div>
                </div>
                <span className={item.status === 'Perlu diperiksa' ? 'chip-s' : 'chip-f'}>{item.status}</span>
                {item.removable && (
                  <button
                    type="button"
                    className="dc-link"
                    disabled={busy || validating}
                    onClick={() => void handleRemoveFile(item.name)}
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
          </div>

          {ramadanMaxYear && (
            <p style={{ margin: 0, color: '#5B6670', fontSize: '12.5px', lineHeight: 1.5 }}>
              Catatan kalender model: tabel Ramadan mencakup sampai tahun <strong>{ramadanMaxYear}</strong>. Riwayat yang meminta bulan prediksi di tahun {ramadanMaxYear + 1} akan ditolak dengan pesan pembaruan kalender.
            </p>
          )}
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E3E6E8',
            borderRadius: '12px',
            padding: '20px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>
              {preview ? 'Hasil validasi (pratinjau)' : 'Hasil validasi aktif'}
            </h2>
            <span style={{ color: '#5B6670', fontSize: '13px' }}>
              {displayedValidation
                ? `${numberFmt.format(displayedValidation.total_rows)} baris harian · ${displayedValidation.total_skus} SKU`
                : data
                  ? `${data.rows.length} SKU tersimpan`
                  : 'Menunggu unggahan'}
            </span>
          </div>

          {findings.length > 0 ? (
            findings.map((item) => (
              <div
                key={item.title}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: item.tone === 'ok' ? '#EFF4FF' : '#FFF4EA',
                }}
              >
                <span style={{ color: item.tone === 'ok' ? '#1D4ED8' : '#B45309', paddingTop: '2px' }}>
                  {item.tone === 'ok' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5 9-10"></path>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l10 18H2z"></path>
                      <path d="M12 10v5"></path>
                      <path d="M12 18v.5"></path>
                    </svg>
                  )}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#17212B' }}>{item.title}</div>
                  <div style={{ color: '#3F4A54', fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>
                    {item.detail}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '16px', borderRadius: '10px', background: '#F5F6F4', color: '#3F4A54', fontSize: '14px', lineHeight: 1.55 }}>
              Hasil aktif saat ini berasal dari <strong>{data?.source ?? 'belum ada data'}</strong>. Pilih atau seret berkas kartu stok (.xlsx / .csv) untuk melihat pratinjau perbandingan dan hasil validasi sebelum mengganti data aktif.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E3E6E8',
          borderRadius: '12px',
          padding: '20px 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>
          Periode tidak dicatat{preview ? ' (pratinjau)' : ''}
        </h2>
        <p style={{ margin: 0, color: '#5B6670', fontSize: '14px' }}>
          Jeda antar-tanggal lebih dari 7 hari dihitung otomatis oleh backend sesuai aturan <code>bangun_panel()</code> notebook. Bulan dengan cakupan &lt; 75% tidak dipakai sebagai target regresi.
        </p>
        {displayedValidation ? (
          displayedValidation.unrecorded_periods.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="dc-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Dari</th>
                    <th>Sampai</th>
                    <th className="num">Lama</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedValidation.unrecorded_periods.map((p, idx) => (
                    <tr key={`${p.produk}-${p.dari}-${idx}`}>
                      <td>{p.produk}</td>
                      <td>{shortDateName(p.dari)}</td>
                      <td>{shortDateName(p.sampai)}</td>
                      <td className="num">{p.lama_hari} hari</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fs-empty">Tidak ditemukan jeda pencatatan lebih dari 7 hari pada data ini.</p>
          )
        ) : (
          <p className="fs-empty">Daftar jeda pencatatan akan terisi otomatis setelah kartu stok harian dipilih.</p>
        )}
      </section>

      {!preview && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          {validating && (
            <div className="upload-status-inline" role="status" aria-live="polite" style={{ alignSelf: 'stretch' }}>
              <span>Memvalidasi berkas…</span>
            </div>
          )}
          {actionError && !validating && (
            <div className="fs-error" role="alert" style={{ alignSelf: 'stretch' }}>
              {actionError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-s"
              disabled={busy || validating}
              onClick={() => {
                setFiles([])
                setActionError('')
                setError('')
                navigate('/beranda')
              }}
            >
              Kembali ke Beranda
            </button>
            {files.length > 0 && (
              <button
                type="button"
                className="btn btn-p"
                disabled={busy || validating}
                onClick={() => void runPreview(files)}
              >
                {validating ? 'Memvalidasi berkas…' : 'Buat pratinjau impor'}
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
