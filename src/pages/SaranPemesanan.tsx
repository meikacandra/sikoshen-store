import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MonthlyEvaluationSection } from '../components/MonthlyEvaluationSection'
import { SummaryCard } from '../components/SummaryCard'
import { useForecast } from '../context/ForecastContext'
import {
  DEFAULT_Z_INDEX,
  Z_OPTIONS,
  dateName,
  filterForecastRows,
  monthName,
  qty,
  shortMonthOnly,
  summarizeForecastRows,
  type Forecast,
} from '../lib/planner'

export default function SaranPemesanan() {
  const { data, fetchForecast } = useForecast()
  const location = useLocation()
  const [productFilter, setProductFilter] = useState<string>('Semua')
  const [zIndex, setZIndex] = useState<number>(DEFAULT_Z_INDEX)
  const [capInput, setCapInput] = useState<string>('')
  const [appliedCap, setAppliedCap] = useState<number | null>(null)
  const [showAll, setShowAll] = useState<boolean>(false)
  const [overrideForecast, setOverrideForecast] = useState<Forecast | null>(null)
  const [recalcBusy, setRecalcBusy] = useState<boolean>(false)
  const [recalcError, setRecalcError] = useState<string>('')

  const selectedZ = Z_OPTIONS[zIndex]
  const isDefaultParams = zIndex === DEFAULT_Z_INDEX && appliedCap === null

  useEffect(() => {
    if (location.hash === '#evaluasi-prediksi') {
      const el = document.getElementById('evaluasi-prediksi')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  useEffect(() => {
    if (!data || isDefaultParams) {
      setOverrideForecast(null)
      setRecalcError('')
      return
    }
    let cancelled = false
    setRecalcBusy(true)
    setRecalcError('')
    fetchForecast({ z: selectedZ.z, cap: appliedCap })
      .then((res) => {
        if (!cancelled) setOverrideForecast(res)
      })
      .catch((err) => {
        if (!cancelled) {
          setRecalcError(err instanceof Error ? err.message : 'Gagal menghitung ulang saran pemesanan di backend.')
        }
      })
      .finally(() => {
        if (!cancelled) setRecalcBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [data, isDefaultParams, selectedZ.z, appliedCap, fetchForecast])

  if (!data) return null

  const activeForecast = isDefaultParams ? data : (overrideForecast ?? data)
  const productFilterList = ['Semua', ...Array.from(new Set(activeForecast.rows.map((r) => r.product))).sort()]
  const activeFilter = productFilterList.includes(productFilter) ? productFilter : 'Semua'

  const filteredRows = filterForecastRows(activeForecast.rows, activeFilter)
  const summary = summarizeForecastRows(filteredRows)

  const predMonth = activeForecast.rows[0]?.prediction_month ?? '2026-06'
  const predMonthLong = monthName(predMonth)
  const predMonthShort = shortMonthOnly(predMonth)

  const activeOrderRows = filteredRows.filter((r) => (r.suggested_order ?? 0) > 0)
  const visibleRows = showAll ? activeOrderRows : activeOrderRows.slice(0, 15)

  function handleApplyCap() {
    const val = Number(capInput.trim())
    if (!capInput.trim() || Number.isNaN(val) || val <= 0) {
      setAppliedCap(null)
    } else {
      setAppliedCap(Math.floor(val))
    }
  }

  function handleExportCsv() {
    const headers = ['Produk', 'Varian', 'Ukuran', 'Label', `Prediksi ${predMonthShort}`, 'Stok saat ini', 'Stok pengaman', 'Saran pesan']
    const csvLines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          `"${r.product}"`,
          `"${r.variant}"`,
          `"${r.size}"`,
          r.label === 'fast' ? 'Fast-Moving' : 'Slow-Moving',
          r.predicted_next_month ?? '',
          r.stock,
          r.safety_stock ?? '',
          r.suggested_order ?? '',
        ].join(','),
      ),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `saran-pemesanan-${predMonth}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Perencanaan</p>
          <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>Saran Pemesanan — {predMonthLong}</h1>
          <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '720px', lineHeight: 1.5 }}>
            Berapa unit yang perlu dipesan per SKU, dihitung langsung oleh model Random Forest dan rumus stok pengaman backend.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-s"
            onClick={() => document.getElementById('evaluasi-prediksi')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Tinjau Evaluasi Prediksi
          </button>
          <button type="button" className="btn btn-s" onClick={handleExportCsv}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v12"></path>
              <path d="M7 11l5 5 5-5"></path>
              <path d="M4 20h16"></path>
            </svg>
            Unduh CSV
          </button>
        </div>
      </header>

      {recalcError && (
        <div className="fs-error" role="alert">
          {recalcError}
        </div>
      )}

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E3E6E8',
          borderRadius: '12px',
          padding: '20px 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#3F4A54' }}>Produk</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {productFilterList.map((name) => {
              const pressed = activeFilter === name
              return (
                <button
                  key={name}
                  type="button"
                  className={pressed ? 'btn btn-p' : 'btn btn-s'}
                  aria-pressed={pressed}
                  onClick={() => setProductFilter(name)}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#3F4A54' }}>Target tidak kehabisan stok</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {Z_OPTIONS.map((zOpt, idx) => {
              const pressed = zIndex === idx
              return (
                <button
                  key={zOpt.label}
                  type="button"
                  className={pressed ? 'btn btn-p' : 'btn btn-s'}
                  aria-pressed={pressed}
                  disabled={recalcBusy}
                  onClick={() => setZIndex(idx)}
                >
                  {zOpt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 220px', maxWidth: '320px' }}>
          <label htmlFor="cap" style={{ fontSize: '13px', fontWeight: 600, color: '#3F4A54' }}>
            Batas jumlah unit (opsional)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="cap"
              type="number"
              placeholder="mis. 1500"
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyCap()
              }}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #D0D7DE',
                fontSize: '14px',
              }}
            />
            <button type="button" className="btn btn-s" disabled={recalcBusy} onClick={handleApplyCap}>
              {recalcBusy ? 'Menghitung…' : 'Prioritaskan'}
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <SummaryCard
          label={`Prediksi penjualan ${predMonthLong}`}
          value={`${qty(summary.totalPred)} unit`}
          subtext={
            summary.unpredictedCount > 0
              ? `${summary.unpredictedCount} SKU belum cukup riwayat lag`
              : 'hasil Random Forest Regression'
          }
        />
        <SummaryCard
          label="Stok saat ini"
          value={`${qty(summary.totalStock)} unit`}
          subtext={`per ${dateName(activeForecast.period_end)}`}
        />
        <SummaryCard
          label="Total saran pesan"
          value={`${qty(summary.totalOrder)} unit`}
          subtext={appliedCap !== null ? `dibatasi maks. ${qty(appliedCap)} unit` : 'prediksi + stok pengaman − stok'}
        />
      </section>

      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E3E6E8',
          borderRadius: '12px',
          boxSizing: 'border-box',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '8px',
            padding: '18px 24px',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>SKU dengan saran pemesanan terbanyak</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#5B6670', fontSize: '13px' }}>
              Menampilkan {visibleRows.length} dari {activeOrderRows.length} SKU perlu pesan
            </span>
            {activeOrderRows.length > 15 && (
              <button type="button" className="dc-link" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Tampilkan 15 teratas' : `Lihat semua (${activeOrderRows.length} SKU)`}
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
                <th>Label</th>
                <th className="num">Prediksi {predMonthShort}</th>
                <th className="num">Stok saat ini</th>
                <th className="num">Stok pengaman</th>
                <th className="num" style={{ paddingRight: '24px' }}>Saran pesan</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={`${r.product}-${r.variant}-${r.size}`}>
                  <td style={{ paddingLeft: '24px' }}>{r.product}</td>
                  <td>{r.variant}</td>
                  <td>{r.size}</td>
                  <td>
                    <span className={r.label === 'fast' ? 'chip-f' : 'chip-n'}>
                      {r.label === 'fast' ? 'Fast' : 'Slow'}
                    </span>
                  </td>
                  <td className="num">{qty(r.predicted_next_month)}</td>
                  <td className="num">{qty(r.stock)}</td>
                  <td className="num">{qty(r.safety_stock)}</td>
                  <td className="num" style={{ fontWeight: 700, color: '#1D4ED8', paddingRight: '24px' }}>
                    {qty(r.suggested_order)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRows.length && <p className="fs-empty">Tidak ada SKU yang perlu dipesan pada filter ini.</p>}
        </div>
      </section>

      <p style={{ margin: 0, color: '#5B6670', fontSize: '13px', lineHeight: 1.6 }}>
        Saran pesan = ceil(max(0, prediksi penjualan + stok pengaman − stok saat ini)). Stok pengaman = ceil(Z × RMSE SKU) memakai RMSE{' '}
        {activeForecast.season === 'lebaran' ? 'musim Lebaran' : 'bulan non-Lebaran'}; target saat ini {selectedZ.label} (Z = {selectedZ.zText}). Waktu tunggu pemasok dan minimum order belum diperhitungkan.
      </p>

      <MonthlyEvaluationSection />
    </>
  )
}
