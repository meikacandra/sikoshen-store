import { useNavigate } from 'react-router-dom'
import { SummaryCard } from '../components/SummaryCard'
import { useForecast } from '../context/ForecastContext'
import {
  dateName,
  decimal1Fmt,
  decimal2Fmt,
  filterForecastRows,
  formatMae,
  formatWape,
  monthName,
  numberFmt,
  qty,
  shortMonthOnly,
  shortProduct,
  summarizeForecastRows,
  summarizeProductCards,
  type MonthlySalesPoint,
} from '../lib/planner'

function MonthlySalesSvg({ series }: { series: MonthlySalesPoint[] }) {
  const width = 920
  const height = 270
  const padL = 48
  const padR = 20
  const padT = 22
  const padB = 36
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const rawMax = Math.max(
    100,
    ...series.flatMap((d) => [d.ihu, d.denim, d.tjb]),
  )
  const step = rawMax <= 500 ? 100 : rawMax <= 1500 ? 500 : 1000
  const maxY = Math.ceil(rawMax / step) * step
  const n = series.length
  const xAt = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW)
  const yAt = (v: number) => padT + plotH - (Math.min(maxY, v) / maxY) * plotH

  const buildPath = (key: 'tjb' | 'denim' | 'ihu') =>
    series.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ')

  const ramadanBands: Array<{ start: number; end: number }> = []
  series.forEach((d, idx) => {
    if (!d.ramadan) return
    const prev = ramadanBands[ramadanBands.length - 1]
    if (prev && prev.end === idx - 1) {
      prev.end = idx
    } else {
      ramadanBands.push({ start: idx, end: idx })
    }
  })

  const yTicks: number[] = []
  for (let v = 0; v <= maxY; v += step) yTicks.push(v)

  const maxTicks = 7
  const xTickIndices: number[] = []
  if (n <= maxTicks) {
    for (let i = 0; i < n; i++) xTickIndices.push(i)
  } else {
    for (let k = 0; k < maxTicks; k++) {
      xTickIndices.push(Math.round((k * (n - 1)) / (maxTicks - 1)))
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Grafik total penjualan per bulan untuk Iron Head Ultimate, Kemeja Denim, dan Tony Jack Biasa (${series[0].ym} sampai ${series[n - 1].ym}), dengan bulan Ramadan ditandai`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {ramadanBands.map((b, idx) => {
        const halfSlot = n > 1 ? plotW / (n * 2) : 24
        const x1 = Math.max(padL, xAt(b.start) - halfSlot)
        const x2 = Math.min(padL + plotW, xAt(b.end) + halfSlot)
        return <rect key={idx} x={x1} y={padT} width={Math.max(8, x2 - x1)} height={plotH} fill="#FDBA74" fillOpacity="0.32" />
      })}

      {yTicks.map((val) => (
        <g key={val}>
          <line x1={padL} y1={yAt(val)} x2={padL + plotW} y2={yAt(val)} stroke="#E3E6E8" strokeDasharray="3 3" />
          <text x={padL - 8} y={yAt(val) + 4} textAnchor="end" fontSize="11" fill="#5B6670">
            {numberFmt.format(val)}
          </text>
        </g>
      ))}

      {xTickIndices.map((idx) => (
        <text key={idx} x={xAt(idx)} y={height - 10} fontSize="11" fill="#5B6670"
          textAnchor={idx === series.length - 1 ? 'end' : idx === 0 ? 'start' : 'middle'}>
          {series[idx].ym}
        </text>
      ))}

      <path d={buildPath('tjb')} fill="none" stroke="#1D4ED8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={buildPath('denim')} fill="none" stroke="#0F766E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={buildPath('ihu')} fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

      <g transform={`translate(${padL + 12}, ${padT + 8})`}>
        <rect x="0" y="-8" width="420" height="22" rx="6" fill="#FFFFFF" fillOpacity="0.88" />
        <line x1="8" y1="3" x2="26" y2="3" stroke="#1D4ED8" strokeWidth="2.5" />
        <text x="32" y="7" fontSize="11.5" fill="#17212B" fontWeight="600">Tony Jack Biasa</text>
        <line x1="145" y1="3" x2="163" y2="3" stroke="#0F766E" strokeWidth="2.5" />
        <text x="169" y="7" fontSize="11.5" fill="#17212B" fontWeight="600">Kemeja Denim</text>
        <line x1="272" y1="3" x2="290" y2="3" stroke="#D97706" strokeWidth="2.5" />
        <text x="296" y="7" fontSize="11.5" fill="#17212B" fontWeight="600">Iron Head Ultimate</text>
      </g>
    </svg>
  )
}

export default function Beranda() {
  const { data, attention, monthlySales, modelMeta, evaluation, ramadanMaxYear } = useForecast()
  const navigate = useNavigate()

  if (!data) return null

  const sortedRows = filterForecastRows(data.rows)
  const predMonth = sortedRows[0]?.prediction_month ?? '2026-06'
  const predMonthLong = monthName(predMonth)
  const predMonthShort = shortMonthOnly(predMonth)

  const summary = summarizeForecastRows(sortedRows)
  const productCards = summarizeProductCards(sortedRows)
  const topOrders = sortedRows.filter((r) => (r.suggested_order ?? 0) > 0).slice(0, 5)

  const highlightFast = attention.find((a) => a.label === 'Fast')
  const highlightSlow = attention.find((a) => a.label === 'Slow')

  const akurasi = modelMeta?.akurasi_penelitian
  const rfWape = modelMeta?.evaluasi_regresi_bergulir?.['Random Forest']?.WAPE
  const baseWape = modelMeta?.evaluasi_regresi_bergulir?.['Baseline rata 6 bln']?.WAPE

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Sikoshen Stock Planner</p>
          <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>Beranda</h1>
          <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '720px', lineHeight: 1.5 }}>
            Ringkasan stok dan prediksi penjualan untuk {predMonthLong} ({data.season === 'lebaran' ? 'musim Lebaran' : 'bulan biasa'}).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-s" onClick={() => navigate('/unggah-data')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4"></path>
              <path d="M7 9l5-5 5 5"></path>
              <path d="M4 20h16"></path>
            </svg>
            Unggah data terbaru
          </button>
          <button type="button" className="btn btn-p" onClick={() => navigate('/saran-pemesanan')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h2l2.4 11h11.2L21 8H6.2"></path>
              <circle cx="9" cy="20" r="1.5"></circle>
              <circle cx="18" cy="20" r="1.5"></circle>
            </svg>
            Lihat saran pemesanan
          </button>
        </div>
      </header>

      <section aria-label="Ringkasan" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '16px' }}>
        <SummaryCard
          label="SKU Fast-Moving"
          value={qty(summary.fastCount)}
          subtext={`dari ${summary.totalSkus} SKU · ${qty(summary.slowCount)} Slow-Moving`}
        />
        <SummaryCard
          label={`Prediksi penjualan ${predMonthLong}`}
          value={`${qty(summary.totalPred)} unit`}
          subtext={summary.unpredictedCount > 0 ? `${summary.unpredictedCount} SKU belum cukup riwayat` : 'semua produk'}
        />
        <SummaryCard
          label="Stok saat ini"
          value={`${qty(summary.totalStock)} unit`}
          subtext={`per ${dateName(data.period_end)}`}
        />
        <SummaryCard
          label="Total saran pesan"
          value={`${qty(summary.totalOrder)} unit`}
          subtext="termasuk stok pengaman 95%"
        />
      </section>

      <section aria-label="Per produk" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px' }}>
        {productCards.map(({ name, chip, chipClass, totalPred, totalStock, totalOrder }) => (
          <div key={name} className="dc-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '17px', margin: 0, fontWeight: 700, color: '#17212B' }}>{name}</h3>
              <span className={chipClass}>{chip}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ color: '#5B6670', fontSize: '12px' }}>Prediksi {predMonthShort}</div>
                <div style={{ fontWeight: 700, fontSize: '20px', color: '#17212B' }}>{qty(totalPred)}</div>
              </div>
              <div>
                <div style={{ color: '#5B6670', fontSize: '12px' }}>Stok saat ini</div>
                <div style={{ fontWeight: 700, fontSize: '20px', color: '#17212B' }}>{qty(totalStock)}</div>
              </div>
              <div>
                <div style={{ color: '#5B6670', fontSize: '12px' }}>Saran pesan</div>
                <div style={{ fontWeight: 700, fontSize: '20px', color: '#1D4ED8' }}>{qty(totalOrder)}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="dc-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>Penjualan per bulan</h2>
          <span style={{ color: '#5B6670', fontSize: '13px' }}>Area oranye = bulan Ramadan</span>
        </div>
        {monthlySales && monthlySales.length > 0 ? (
          <MonthlySalesSvg series={monthlySales} />
        ) : (
          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#F5F6F4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <p style={{ margin: 0, color: '#3F4A54', fontSize: '14px', lineHeight: 1.55 }}>
              Grafik tren bulanan dihitung langsung dari riwayat harian yang diunggah. Unggah kartu stok (.xlsx / .csv) untuk menampilkan tren penjualan per bulan.
            </p>
            <button type="button" className="btn btn-s" onClick={() => navigate('/unggah-data')}>
              Unggah kartu stok
            </button>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '16px' }}>
        <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>Prioritas pemesanan</h2>
            <button type="button" className="dc-link" onClick={() => navigate('/saran-pemesanan')}>
              Lihat semua
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="dc-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Label</th>
                  <th className="num">Saran pesan</th>
                </tr>
              </thead>
              <tbody>
                {topOrders.map((r) => (
                  <tr key={`${r.product}-${r.variant}-${r.size}`}>
                    <td>{shortProduct(r.product)} · {r.variant} · {r.size}</td>
                    <td>
                      <span className={r.label === 'fast' ? 'chip-f' : 'chip-n'}>
                        {r.label === 'fast' ? 'Fast' : 'Slow'}
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{qty(r.suggested_order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topOrders.length === 0 && <p className="fs-empty">Tidak ada SKU yang perlu dipesan pada periode ini.</p>}
          </div>
        </div>

        <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>Perlu perhatian</h2>
            <button type="button" className="dc-link" onClick={() => navigate('/perlu-perhatian')}>
              Lihat {attention.length} SKU
            </button>
          </div>
          <p style={{ margin: 0, color: '#3F4A54', fontSize: '14px', lineHeight: 1.6 }}>
            {attention.length} SKU penjualannya tidak sesuai dengan pola kombinasi varian dan ukuran pada model aktif.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {highlightFast && (
              <div style={{ padding: '14px', borderRadius: '10px', background: '#EFF4FF' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#17212B' }}>
                  {shortProduct(highlightFast.produk)} · {highlightFast.varian} · {highlightFast.ukuran}
                </div>
                <div style={{ color: '#3F4A54', fontSize: '13px', marginTop: '4px' }}>
                  Terjual {qty(highlightFast.terjual)} unit (median {qty(highlightFast.median)}), peluang model {decimal2Fmt.format(highlightFast.peluang)}. {highlightFast.tindakan}
                </div>
              </div>
            )}
            {highlightSlow && (
              <div style={{ padding: '14px', borderRadius: '10px', background: '#FFF4EA' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#17212B' }}>
                  {shortProduct(highlightSlow.produk)} · {highlightSlow.varian} · {highlightSlow.ukuran}
                </div>
                <div style={{ color: '#3F4A54', fontSize: '13px', marginTop: '4px' }}>
                  Terjual {qty(highlightSlow.terjual)} unit (median {qty(highlightSlow.median)}), peluang model {decimal2Fmt.format(highlightSlow.peluang)}. {highlightSlow.tindakan}
                </div>
              </div>
            )}
            {!highlightFast && !highlightSlow && (
              <p className="fs-empty">Semua SKU selaras dengan pola model saat ini.</p>
            )}
          </div>
        </div>
      </section>

      {evaluation && (
        <section className="dc-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>
              Evaluasi Prediksi Bulan Baru
            </h2>
            <button
              type="button"
              className="dc-link"
              onClick={() => navigate('/saran-pemesanan#evaluasi-prediksi')}
            >
              Lihat rincian evaluasi
            </button>
          </div>
          {evaluation.has_evaluated_months ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#EFF4FF' }}>
                <div style={{ fontSize: '12px', color: '#5B6670' }}>Random Forest ({evaluation.overall.evaluated_months} bln · {evaluation.overall.rf.n} SKU)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#17212B', marginTop: '2px' }}>
                  WAPE {formatWape(evaluation.overall.rf.wape_pct)} · MAE {formatMae(evaluation.overall.rf.mae)}
                </div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F5F6F4' }}>
                <div style={{ fontSize: '12px', color: '#5B6670' }}>Pembanding Rata-rata 6 bulan</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#17212B', marginTop: '2px' }}>
                  WAPE {formatWape(evaluation.overall.baseline_6m.wape_pct)} · MAE {formatMae(evaluation.overall.baseline_6m.mae)}
                </div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F5F6F4' }}>
                <div style={{ fontSize: '12px', color: '#5B6670' }}>Per musim (WAPE RF)</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#17212B', marginTop: '4px' }}>
                  Biasa: {evaluation.by_season.biasa.rf.n > 0 ? formatWape(evaluation.by_season.biasa.rf.wape_pct) : '—'} · Lebaran:{' '}
                  {evaluation.by_season.lebaran.rf.n > 0 ? formatWape(evaluation.by_season.lebaran.rf.wape_pct) : '—'}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: '#3F4A54', fontSize: '14px', lineHeight: 1.55 }}>
              Evaluasi bulan baru masih menunggu penjualan aktual pasca-rencana. Angka WAPE ~{decimal1Fmt.format(evaluation.research_reference.rf_wape_pct)}% di bawah adalah acuan penelitian terdahulu ({monthName(evaluation.research_reference.period[0])} – {monthName(evaluation.research_reference.period[1])}), ditampilkan terpisah dari evaluasi bulan baru.
            </p>
          )}
        </section>
      )}

      <p style={{ margin: 0, color: '#5B6670', fontSize: '13px' }}>
        {modelMeta ? (
          <>
            Model aktif v{modelMeta.versi_model} · hasil penelitian: akurasi klasifikasi{' '}
            {akurasi ? `${decimal1Fmt.format(akurasi.akurasi)}% ± ${decimal1Fmt.format(akurasi.sd)}` : '—'} (nested CV) · WAPE RF{' '}
            {rfWape !== undefined ? decimal2Fmt.format(rfWape) : '—'} (rata 6 bulan:{' '}
            {baseWape !== undefined ? decimal2Fmt.format(baseWape) : '—'})
            {ramadanMaxYear ? ` · kalender Ramadan s.d. ${ramadanMaxYear}` : ''}
          </>
        ) : (
          'Metadata evaluasi model akan muncul setelah backend terhubung.'
        )}
      </p>
    </>
  )
}
