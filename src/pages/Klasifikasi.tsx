import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useForecast } from '../context/ForecastContext'
import { dateName, decimal1Fmt, decimal2Fmt, qty, type KlasifikasiResponse } from '../lib/planner'

const card: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6E8',
  borderRadius: '12px',
  padding: '20px 24px',
  boxSizing: 'border-box',
  minWidth: 0,
}
const h2: CSSProperties = { fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }
const muted: CSSProperties = { margin: 0, color: '#5B6670', fontSize: '13.5px', lineHeight: 1.55 }
const grid = (min: number): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
  gap: '16px',
})
const pct = (v: number) => `${decimal1Fmt.format(v)}%`

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div style={{ ...card, padding: '16px 20px' }}>
      <div style={{ color: '#5B6670', fontSize: '13px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#17212B', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {note && <div style={{ color: '#5B6670', fontSize: '12.5px', marginTop: '4px' }}>{note}</div>}
    </div>
  )
}

export default function Klasifikasi() {
  const { data, fetchKlasifikasi } = useForecast()
  const [result, setResult] = useState<KlasifikasiResponse | null>(null)
  const [error, setError] = useState('')
  const [produk, setProduk] = useState('')
  const [label, setLabel] = useState<'' | 'fast' | 'slow'>('')
  const [cari, setCari] = useState('')

  // Muat ulang setiap kali hasil aktif berubah (mis. setelah impor kartu stok baru).
  useEffect(() => {
    let active = true
    fetchKlasifikasi()
      .then((r) => { if (active) { setResult(r); setError('') } })
      .catch((err: Error) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [fetchKlasifikasi, data])

  const rows = useMemo(() => {
    if (!result) return []
    const q = cari.trim().toLowerCase()
    return result.rows.filter((r) =>
      (!produk || r.product === produk) && (!label || r.label === label)
      && (!q || `${r.product} ${r.variant} ${r.size}`.toLowerCase().includes(q)))
  }, [result, produk, label, cari])

  if (error) return <div className="fs-error" role="alert">{error}</div>
  if (!result) return <p role="status">Memuat hasil klasifikasi…</p>

  const research = result.research.klasifikasi
  const rf = research.perbandingan.find((r) => r.jenis === 'dipilih')
  const cm = research.confusionMatrix
  const totalTebakan = cm.actualSlow.slow + cm.actualSlow.fast + cm.actualFast.slow + cm.actualFast.fast
  const maxImp = Math.max(...research.permutationImportance.map((r) => r.value))
  const products = Object.keys(result.thresholds)

  return (
    <>
      <header>
        <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Analisis</p>
        <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>Klasifikasi Pergerakan</h1>
        <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '760px', lineHeight: 1.5 }}>
          Setiap SKU diberi label <strong>Fast-Moving</strong> (laris) atau <strong>Slow-Moving</strong> (kurang laris) dari penjualan yang
          sudah terjadi. Label ini menjadi dasar model klasifikasi Random Forest dalam penelitian.
        </p>
      </header>

      <section style={grid(200)} aria-label="Ringkasan label">
        <Stat label="SKU Fast-Moving" value={result.fast} note={`dari ${result.fast + result.slow} SKU`} />
        <Stat label="SKU Slow-Moving" value={result.slow} note={`dari ${result.fast + result.slow} SKU`} />
        <Stat label="Akurasi model (penelitian)" value={rf ? `${pct(rf.akurasi)}` : '—'} note={rf ? `± ${pct(rf.sd)} · nested cross-validation` : undefined} />
        <Stat label="Data dasar label" value={<span style={{ fontSize: '17px' }}>{result.period_end ? dateName(result.period_end) : '—'}</span>} note={`${result.basis} · ${result.source}`} />
      </section>

      <section style={grid(340)}>
        <div style={card}>
          <h2 style={h2}>Bagaimana label ditentukan?</h2>
          <ol style={{ listStyleType: 'decimal', margin: '14px 0 0', paddingLeft: '20px', color: '#3F4A54', fontSize: '14px', lineHeight: 1.6, display: 'grid', gap: '8px' }}>
            <li><strong>Jumlahkan barang keluar</strong> setiap SKU sejak SKU itu pertama kali tersedia.</li>
            <li><strong>Cari median</strong> (nilai tengah) total keluar untuk setiap jenis produk.</li>
            <li>Di atas median → <span className="chip-f">Fast</span>. Sama dengan atau di bawah median → <span className="chip-s">Slow</span>.</li>
          </ol>
          <p style={{ ...muted, marginTop: '12px' }}>
            Ini <strong>aturan</strong>, bukan tebakan model, sehingga labelnya pasti sesuai definisi penelitian. Median dihitung per jenis produk karena
            lama penjualan tiap produk berbeda (Iron Head baru dijual sejak Mei 2025).
          </p>
        </div>
        <div style={card}>
          <h2 style={h2}>Batas median per jenis produk</h2>
          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            {products.map((p) => {
              const fast = result.rows.filter((r) => r.product === p && r.label === 'fast').length
              const total = result.rows.filter((r) => r.product === p).length
              return (
                <div key={p} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '10px 12px', background: '#F5F6F4', borderRadius: '8px' }}>
                  <span style={{ fontWeight: 600 }}>{p}</span>
                  <span style={{ color: '#3F4A54', fontSize: '14px' }}>median <strong>{qty(result.thresholds[p])}</strong> unit · {fast} Fast / {total - fast} Slow</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h2 style={h2}>Hasil per SKU</h2>
            <p style={{ ...muted, marginTop: '4px' }}>Menampilkan {rows.length} dari {result.rows.length} SKU.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input aria-label="Cari SKU" placeholder="Cari varian / ukuran" value={cari} onChange={(e) => setCari(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #CBD2D8', borderRadius: '8px', fontSize: '14px', minWidth: 0, width: '180px' }} />
            <select aria-label="Jenis produk" value={produk} onChange={(e) => setProduk(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #CBD2D8', borderRadius: '8px', fontSize: '14px' }}>
              <option value="">Semua produk</option>
              {products.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value as '' | 'fast' | 'slow')}
              style={{ padding: '8px 10px', border: '1px solid #CBD2D8', borderRadius: '8px', fontSize: '14px' }}>
              <option value="">Semua label</option>
              <option value="fast">Fast-Moving</option>
              <option value="slow">Slow-Moving</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
          <table className="dc-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Produk</th>
                <th>Varian</th>
                <th>Ukuran</th>
                <th className="num">Total keluar</th>
                <th className="num">Median</th>
                <th>Label</th>
                <th className="num" style={{ paddingRight: '24px' }}>Peluang laku (pola)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.product}-${r.variant}-${r.size}`}>
                  <td style={{ paddingLeft: '24px' }}>{r.product}</td>
                  <td>{r.variant}</td>
                  <td>{r.size}</td>
                  <td className="num">{qty(r.total_out)}</td>
                  <td className="num">{qty(r.median)}</td>
                  <td><span className={r.label === 'fast' ? 'chip-f' : 'chip-s'}>{r.label === 'fast' ? 'Fast' : 'Slow'}</span></td>
                  <td className="num" style={{ paddingRight: '24px' }}>{r.peluang_fast === null ? '—' : decimal2Fmt.format(r.peluang_fast)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="fs-empty">Tidak ada SKU yang cocok dengan filter.</p>}
        </div>
      </section>

      <section style={grid(340)}>
        <div style={card}>
          <h2 style={h2}>Seberapa tepat model klasifikasinya?</h2>
          <p style={{ ...muted, marginTop: '4px' }}>
            Random Forest menebak label hanya dari <strong>ciri produk</strong> (jenis, varian, ukuran), tanpa data penjualan atau stok agar tidak
            terjadi kebocoran label. Diuji dengan nested cross-validation: 15 pengujian pada 126 SKU.
          </p>
          {rf && (
            <dl style={{ ...grid(120), gap: '12px', margin: '16px 0' }}>
              {[
                ['Akurasi', `${pct(rf.akurasi)} ± ${pct(rf.sd)}`],
                ['ROC-AUC', decimal2Fmt.format(rf.rocAuc)],
                ['Precision · Recall', `${decimal2Fmt.format(rf.precision)} · ${decimal2Fmt.format(rf.recall)}`],
                ['F1-score', decimal2Fmt.format(rf.f1)],
              ].map(([k, v]) => (
                <div key={k}><dt style={{ color: '#5B6670', fontSize: '13px' }}>{k}</dt><dd style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '17px' }}>{v}</dd></div>
              ))}
            </dl>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="dc-table" style={{ width: '100%' }} aria-label="Confusion matrix gabungan">
              <thead><tr><th>Sebenarnya \ Tebakan model</th><th className="num">Slow</th><th className="num">Fast</th></tr></thead>
              <tbody>
                <tr><td>Slow</td><td className="num" style={{ background: '#E8F5EE', fontWeight: 700 }}>{cm.actualSlow.slow}</td><td className="num">{cm.actualSlow.fast}</td></tr>
                <tr><td>Fast</td><td className="num">{cm.actualFast.slow}</td><td className="num" style={{ background: '#E8F5EE', fontWeight: 700 }}>{cm.actualFast.fast}</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ ...muted, marginTop: '10px' }}>
            Gabungan 15 pengujian (5-fold × 3 ulangan): setiap SKU ditebak 3 kali, total {totalTebakan} tebakan, benar{' '}
            {cm.actualSlow.slow + cm.actualFast.fast} ({pct(((cm.actualSlow.slow + cm.actualFast.fast) / totalTebakan) * 100)} dari semua tebakan; rata-rata per
            pengujian {rf ? pct(rf.akurasi) : '—'}).
          </p>
        </div>

        <div style={card}>
          <h2 style={h2}>Ciri yang paling berpengaruh</h2>
          <p style={{ ...muted, marginTop: '4px' }}>Penurunan akurasi bila satu ciri diacak (permutation importance).</p>
          <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
            {research.permutationImportance.map((r) => (
              <div key={r.feature}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>{r.feature}</span><strong style={{ color: '#1D4ED8' }}>{decimal1Fmt.format(r.value)} poin</strong>
                </div>
                <div style={{ height: '8px', background: '#ECEEF0', borderRadius: '999px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ height: '8px', background: '#1D4ED8', width: `${(r.value / maxImp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px', background: '#FFF4EA', color: '#9A3412', fontSize: '13.5px', lineHeight: 1.55 }}>
            <strong>Keterbatasan:</strong> untuk varian warna yang belum pernah dijual, akurasi turun ke {pct(research.akurasiVarianBaru)} (setara menebak).
          </div>
        </div>
      </section>

      <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px' }}>
          <h2 style={h2}>Perbandingan algoritma</h2>
          <p style={{ ...muted, marginTop: '4px' }}>Semua algoritma di-tuning dan diuji dengan cara yang sama (rata-rata ± simpangan baku dari 15 pengujian).</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dc-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Model</th>
                <th className="num">Akurasi</th>
                <th className="num">Precision</th>
                <th className="num">Recall</th>
                <th className="num">F1</th>
                <th className="num" style={{ paddingRight: '24px' }}>ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {research.perbandingan.map((r) => (
                <tr key={r.model} style={r.jenis === 'dipilih' ? { background: '#EFF4FF', fontWeight: 700 } : r.jenis === 'pembanding' ? { color: '#5B6670' } : undefined}>
                  <td style={{ paddingLeft: '24px' }}>{r.model}{r.jenis === 'dipilih' ? ' (dipilih)' : r.jenis === 'pembanding' ? ' · pembanding' : ''}</td>
                  <td className="num">{pct(r.akurasi)} ± {decimal1Fmt.format(r.sd)}</td>
                  <td className="num">{decimal2Fmt.format(r.precision)}</td>
                  <td className="num">{decimal2Fmt.format(r.recall)}</td>
                  <td className="num">{decimal2Fmt.format(r.f1)}</td>
                  <td className="num" style={{ paddingRight: '24px' }}>{decimal2Fmt.format(r.rocAuc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...muted, padding: '14px 24px 18px' }}>
          Random Forest setara dengan algoritma terbaik lain dan dipilih karena ROC-AUC tertinggi, tidak peka terhadap setelan, dan mudah dijelaskan.
          Angka "out-of-fold {result.model.oof_accuracy ? pct(result.model.oof_accuracy * 100) : '—'}" pada model aktif sedikit lebih optimis karena setelannya
          dipilih memakai data yang sama; angka yang dilaporkan adalah hasil nested cross-validation di atas.
        </p>
      </section>
    </>
  )
}
