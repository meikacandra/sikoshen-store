import { useForecast } from '../context/ForecastContext'
import { decimal2Fmt, qty } from '../lib/planner'

export default function PerluPerhatian() {
  const { attention, master } = useForecast()

  const lebihLakuCount = attention.filter((r) => r.temuan === 'Lebih laku dari pola').length
  const kurangLakuCount = attention.filter((r) => r.temuan === 'Kurang laku dari pola').length

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Analisis</p>
          <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>SKU Perlu Perhatian</h1>
          <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '720px', lineHeight: 1.5 }}>
            SKU yang penjualannya berbeda dari pola kombinasi varian dan ukuran pada model aktif. Periksa penyebabnya sebelum belanja stok.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}></div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E3E6E8',
            borderRadius: '12px',
            padding: '20px 24px',
            boxSizing: 'border-box',
            borderTop: '4px solid #1D4ED8',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: '#17212B' }}>
            Lebih laku dari pola · {lebihLakuCount} SKU
          </h2>
          <p style={{ margin: 0, color: '#3F4A54', fontSize: '14px', lineHeight: 1.55 }}>
            Penjualannya tinggi walaupun kombinasi seperti ini biasanya lambat. Jangan ikut mengurangi stoknya.
          </p>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E3E6E8',
            borderRadius: '12px',
            padding: '20px 24px',
            boxSizing: 'border-box',
            borderTop: '4px solid #C2410C',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: '#17212B' }}>
            Kurang laku dari pola · {kurangLakuCount} SKU
          </h2>
          <p style={{ margin: 0, color: '#3F4A54', fontSize: '14px', lineHeight: 1.55 }}>
            Penjualannya rendah walaupun kombinasi seperti ini biasanya laku. Bisa jadi karena barangnya sering kosong.
          </p>
        </div>
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
        <div style={{ padding: '18px 24px' }}>
          <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>Daftar SKU</h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="dc-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Produk</th>
                <th>Varian</th>
                <th>Ukuran</th>
                <th className="num">Terjual</th>
                <th className="num">Median</th>
                <th>Label</th>
                <th className="num">Peluang model</th>
                <th>Temuan</th>
                <th style={{ paddingRight: '24px' }}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((r) => (
                <tr key={`${r.produk}-${r.varian}-${r.ukuran}`}>
                  <td style={{ paddingLeft: '24px' }}>{r.produk}</td>
                  <td>{r.varian}</td>
                  <td>{r.ukuran}</td>
                  <td className="num">{qty(r.terjual)}</td>
                  <td className="num">{qty(r.median)}</td>
                  <td>
                    <span className={r.label === 'Fast' ? 'chip-f' : 'chip-s'}>{r.label}</span>
                  </td>
                  <td className="num">{decimal2Fmt.format(r.peluang)}</td>
                  <td>
                    <span className={r.temuan === 'Lebih laku dari pola' ? 'chip-f' : 'chip-s'}>{r.temuan}</span>
                    {r.dekat_median && (
                      <>
                        {' '}
                        <span className="chip-n">Dekat median</span>
                      </>
                    )}
                  </td>
                  <td style={{ paddingRight: '24px' }}>{r.tindakan}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {attention.length === 0 && (
            <p className="fs-empty">
              {master.length === 0
                ? 'Data model belum siap. Pastikan backend terhubung.'
                : 'Tidak ada SKU yang menyimpang dari pola model saat ini.'}
            </p>
          )}
        </div>
      </section>

      <p style={{ margin: 0, color: '#5B6670', fontSize: '13px', lineHeight: 1.6 }}>
        Label dihitung dari total penjualan dibanding median produknya (aturan notebook). Peluang model berasal dari SKU lain dengan varian dan ukuran serupa. “Dekat median” berarti selisihnya kurang dari 10%, sehingga labelnya mudah berubah.
      </p>
    </>
  )
}
