import { useState } from 'react'
import { SummaryCard } from './SummaryCard'
import { useForecast } from '../context/ForecastContext'
import {
  dateName,
  decimal1Fmt,
  formatMae,
  formatSignedDiff,
  formatWape,
  monthName,
  qty,
} from '../lib/planner'

type RowFilter = 'evaluated' | 'stockout' | 'excluded' | 'all'

export function MonthlyEvaluationSection() {
  const { evaluation } = useForecast()
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null)
  const [rowFilter, setRowFilter] = useState<RowFilter>('evaluated')
  const [showAllRows, setShowAllRows] = useState(false)

  if (!evaluation) return null

  const { research_reference: ref, overall, by_season: bySeason, months, has_evaluated_months: hasEval } = evaluation
  const defaultMonth = months.find((m) => m.has_actuals) ?? months[0] ?? null
  const activeMonth =
    (selectedSnapshotId !== null ? months.find((m) => m.snapshot_id === selectedSnapshotId) : null) ?? defaultMonth

  const filteredRows = activeMonth
    ? activeMonth.rows.filter((r) => {
        if (rowFilter === 'evaluated') return r.status === 'evaluated'
        if (rowFilter === 'stockout') return r.status === 'evaluated' && r.had_stockout
        if (rowFilter === 'excluded') return r.status !== 'evaluated'
        return true
      })
    : []
  const visibleRows = showAllRows ? filteredRows : filteredRows.slice(0, 15)

  return (
    <section
      id="evaluasi-prediksi"
      aria-label="Evaluasi prediksi bulanan"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 4px', color: '#5B6670', fontSize: '13px' }}>Pemantauan akurasi bulan baru</p>
          <h2 style={{ fontSize: '22px', margin: 0, fontWeight: 700, color: '#17212B' }}>
            Evaluasi Prediksi Bulanan (Random Forest vs Rata-rata 6 Bulan)
          </h2>
          <p style={{ margin: '6px 0 0', color: '#5B6670', fontSize: '14px', maxWidth: '760px', lineHeight: 1.55 }}>
            Membandingkan prediksi yang disimpan sebelum bulan target dimulai terhadap penjualan aktual (`Barang_Keluar`) setelah bulan tersebut selesai dan tercatat lengkap (cakupan ≥ 75%, jeda ≤ 7 hari).
          </p>
        </div>
      </div>

      {/* Blok 1: Evaluasi Bulan Baru (terpisah dari penelitian terdahulu) */}
      {!hasEval ? (
        <div
          className="dc-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            borderLeft: '4px solid #1D4ED8',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#17212B' }}>
            Evaluasi bulan baru masih menunggu data aktual
          </div>
          <p style={{ margin: 0, color: '#3F4A54', fontSize: '14px', lineHeight: 1.55 }}>
            Belum ada bulan pasca-rencana yang penjualan aktualnya selesai tercatat. Saat kartu stok untuk bulan target selesai diunggah di menu <strong>Unggah Data</strong>, selisih per SKU, MAE, dan WAPE akan otomatis dihitung di sini.
          </p>
          {months.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px', borderTop: '1px solid #EEF0F1' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#5B6670' }}>
                Prediksi tersimpan yang menunggu data aktual:
              </div>
              {months.slice(0, 4).map((m) => (
                <div key={m.snapshot_id} style={{ fontSize: '13.5px', color: '#17212B' }}>
                  <strong>{monthName(m.target_month)}</strong> ({m.season === 'lebaran' ? 'musim Ramadan/Lebaran' : 'musim biasa'}) ·{' '}
                  model <code>v{m.model_version}</code> · data s.d. {dateName(m.data_period_end)} · {m.total_snapshot_skus} SKU
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Ringkasan keseluruhan bulan baru */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
            <SummaryCard
              label="MAE Random Forest"
              value={formatMae(overall.rf.mae)}
              subtext={`WAPE ${formatWape(overall.rf.wape_pct)} · ${overall.rf.n} SKU dinilai (${overall.evaluated_months} bln)`}
            />
            <SummaryCard
              label="MAE Rata-rata 6 bulan"
              value={formatMae(overall.baseline_6m.mae)}
              subtext={`WAPE ${formatWape(overall.baseline_6m.wape_pct)} · ${overall.baseline_6m.n} SKU dinilai`}
            />
            <SummaryCard
              label="Perbandingan metode"
              value={
                overall.rf_beats_baseline === true
                  ? 'RF lebih akurat'
                  : overall.rf_beats_baseline === false
                    ? 'Rata 6 bln lebih akurat'
                    : 'Pembanding belum cukup'
              }
              subtext={
                overall.rf.wape_pct !== null && overall.baseline_6m.wape_pct !== null
                  ? `Selisih WAPE ${decimal1Fmt.format(Math.abs(overall.baseline_6m.wape_pct - overall.rf.wape_pct))} poin persen`
                  : 'Membandingkan MAE keseluruhan'
              }
            />
          </div>

          {/* Perbandingan per musim: Biasa vs Ramadan/Lebaran */}
          <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '17px', margin: 0, fontWeight: 700, color: '#17212B' }}>
              Ringkasan per musim (Biasa vs Ramadan/Lebaran)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="dc-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Musim</th>
                    <th className="num">Bulan dinilai</th>
                    <th className="num">SKU dinilai</th>
                    <th className="num">MAE RF</th>
                    <th className="num">WAPE RF</th>
                    <th className="num">MAE Rata 6 bln</th>
                    <th className="num">WAPE Rata 6 bln</th>
                    <th>Kesimpulan</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { key: 'biasa', label: 'Musim biasa', data: bySeason.biasa },
                    { key: 'lebaran', label: 'Musim Ramadan / Lebaran', data: bySeason.lebaran },
                  ] as const).map(({ key, label, data }) => (
                    <tr key={key}>
                      <td style={{ fontWeight: 600 }}>{label}</td>
                      <td className="num">{data.evaluated_months}</td>
                      <td className="num">{data.rf.n}</td>
                      <td className="num">{formatMae(data.rf.mae)}</td>
                      <td className="num">{data.rf.n > 0 ? formatWape(data.rf.wape_pct) : '—'}</td>
                      <td className="num">{formatMae(data.baseline_6m.mae)}</td>
                      <td className="num">{data.baseline_6m.n > 0 ? formatWape(data.baseline_6m.wape_pct) : '—'}</td>
                      <td>
                        {data.evaluated_months === 0 ? (
                          <span className="chip-n">Belum ada data</span>
                        ) : data.rf_beats_baseline === true ? (
                          <span className="chip-f">RF lebih baik</span>
                        ) : data.rf_beats_baseline === false ? (
                          <span className="chip-s">Rata 6 bln lebih baik</span>
                        ) : (
                          <span className="chip-n">Pembanding belum lengkap</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail bulan evaluasi terpilih & SKU dengan selisih terbesar */}
          {activeMonth && (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E3E6E8',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid #EEF0F1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: '#17212B' }}>
                      Rincian Evaluasi — {monthName(activeMonth.target_month)}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#5B6670', marginTop: '4px' }}>
                      Model <code>v{activeMonth.model_version}</code> · dibuat dari data s.d. {dateName(activeMonth.data_period_end)} ·{' '}
                      {activeMonth.season === 'lebaran' ? 'Musim Ramadan/Lebaran' : 'Musim biasa'} ·{' '}
                      <strong>{activeMonth.evaluated_count} SKU dinilai</strong>
                      {activeMonth.zero_sales_count > 0 ? ` (${activeMonth.zero_sales_count} SKU aktual 0 unit ikut dihitung)` : ''}
                      {activeMonth.stockout_count > 0 ? ` · ${activeMonth.stockout_count} SKU sempat kehabisan stok` : ''}
                      {activeMonth.excluded_missing_count + activeMonth.excluded_incomplete_count > 0
                        ? ` · ${activeMonth.excluded_missing_count} data hilang, ${activeMonth.excluded_incomplete_count} pencatatan <75% dikecualikan`
                        : ''}
                    </div>
                  </div>

                  {months.length > 1 && (
                    <select
                      aria-label="Pilih bulan evaluasi"
                      value={activeMonth.snapshot_id}
                      onChange={(e) => {
                        setSelectedSnapshotId(Number(e.target.value))
                        setShowAllRows(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D0D7DE',
                        background: '#FFFFFF',
                        fontSize: '13.5px',
                        color: '#17212B',
                      }}
                    >
                      {months.map((m) => (
                        <option key={m.snapshot_id} value={m.snapshot_id}>
                          {monthName(m.target_month)} · v{m.model_version} ({m.has_actuals ? `${m.evaluated_count} SKU` : 'menunggu aktual'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {([
                      { id: 'evaluated', label: `Dinilai (${activeMonth.evaluated_count})` },
                      { id: 'stockout', label: `Sempat habis stok (${activeMonth.stockout_count})` },
                      {
                        id: 'excluded',
                        label: `Dikecualikan (${activeMonth.excluded_missing_count + activeMonth.excluded_incomplete_count + activeMonth.excluded_no_prediction_count})`,
                      },
                      { id: 'all', label: `Semua (${activeMonth.total_snapshot_skus})` },
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={rowFilter === tab.id ? 'btn btn-p' : 'btn btn-s'}
                        onClick={() => {
                          setRowFilter(tab.id)
                          setShowAllRows(false)
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {filteredRows.length > 15 && (
                    <button type="button" className="dc-link" onClick={() => setShowAllRows((v) => !v)}>
                      {showAllRows ? 'Tampilkan 15 teratas' : `Lihat semua (${filteredRows.length} SKU)`}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="dc-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px' }}>Produk</th>
                      <th>Varian</th>
                      <th>Ukuran</th>
                      <th className="num">Prediksi RF</th>
                      <th className="num">Rata 6 bln</th>
                      <th className="num">Aktual</th>
                      <th className="num">Selisih RF</th>
                      <th className="num">Selisih 6 bln</th>
                      <th style={{ paddingRight: '24px' }}>Status & Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => (
                      <tr key={`${r.product}-${r.variant}-${r.size}`}>
                        <td style={{ paddingLeft: '24px' }}>{r.product}</td>
                        <td>{r.variant}</td>
                        <td>{r.size}</td>
                        <td className="num">{qty(r.rf_prediction)}</td>
                        <td className="num">
                          {r.baseline_6m === null ? '—' : decimal1Fmt.format(r.baseline_6m)}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {r.status === 'missing_data' ? '—' : qty(r.actual)}
                        </td>
                        <td
                          className="num"
                          style={{
                            fontWeight: 700,
                            color:
                              r.rf_diff === null
                                ? '#5B6670'
                                : Math.abs(r.rf_diff) >= 10
                                  ? '#C2410C'
                                  : '#17212B',
                          }}
                        >
                          {formatSignedDiff(r.rf_diff)}
                        </td>
                        <td className="num">{formatSignedDiff(r.baseline_diff)}</td>
                        <td style={{ paddingRight: '24px' }}>
                          {r.status === 'evaluated' ? (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {r.had_stockout && (
                                <span className="chip-s">
                                  Sempat habis stok ({r.stockout_days} hari · {decimal1Fmt.format(r.stockout_pct)}%)
                                </span>
                              )}
                              {r.actual === 0 && <span className="chip-n">Terjual 0 unit</span>}
                              {!r.had_stockout && r.actual !== 0 && <span className="chip-f">Tercatat lengkap</span>}
                            </div>
                          ) : (
                            <span className="chip-n">{r.reason ?? 'Dikecualikan'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleRows.length === 0 && (
                  <p className="fs-empty">Tidak ada SKU pada filter evaluasi ini.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Blok 2: Acuan Penelitian Terdahulu (dipisahkan secara eksplisit) */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '10px',
          background: '#F5F6F4',
          border: '1px solid #E3E6E8',
          fontSize: '13px',
          color: '#3F4A54',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#17212B' }}>
          Acuan penelitian terdahulu ({monthName(ref.period[0])} – {monthName(ref.period[1])} · terpisah dari evaluasi bulan baru):
        </strong>{' '}
        Random Forest mencatat WAPE <strong>{decimal1Fmt.format(ref.rf_wape_pct)}%</strong> (MAE {decimal1Fmt.format(ref.rf_mae)} unit) dibanding rata-rata 6 bulan{' '}
        <strong>{decimal1Fmt.format(ref.baseline_6m_wape_pct)}%</strong> (MAE {decimal1Fmt.format(ref.baseline_6m_mae)} unit). Untuk varian yang belum pernah terlihat model saat pelatihan, akurasi klasifikasi hanya{' '}
        <strong>{decimal1Fmt.format(ref.unseen_variant_accuracy_pct)}%</strong> (setara menebak). Selisih bertanda <strong>+</strong> berarti prediksi lebih tinggi dari aktual; tanda <strong>−</strong> berarti penjualan aktual melampaui prediksi.
      </div>
    </section>
  )
}
