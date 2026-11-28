import { useEffect, useState } from 'react'
import { useForecast } from '../context/ForecastContext'
import {
  POLA_INSIGHTS,
  buildLiveMasterMap,
  decimal1Fmt,
  decimal2Fmt,
  heatColor,
  qty,
} from '../lib/planner'

export default function PetaPola() {
  const { master, products, modelMeta } = useForecast()
  const [produk, setProduk] = useState<string>('')

  useEffect(() => {
    if (products.length > 0 && !produk) {
      setProduk(products[0].name)
    }
  }, [products, produk])

  if (products.length === 0 || master.length === 0) {
    return (
      <section className="dc-card">
        <h1 style={{ fontSize: '24px', margin: '0 0 8px', color: '#17212B' }}>Peta Pola Varian × Ukuran</h1>
        <p style={{ margin: 0, color: '#5B6670', fontSize: '14px' }}>
          Data peta pola dari model belum siap. Pastikan backend aktif dan file model <code>rf_sikoshen.pkl</code> berhasil dimuat.
        </p>
      </section>
    )
  }

  const activeConfig = products.find((p) => p.name === produk) ?? products[0]
  const activeName = activeConfig.name
  const { variants, sizes } = activeConfig
  const insights = POLA_INSIGHTS[activeName] ?? [
    'Sel berwarna biru menandakan peluang Fast-Moving tinggi menurut model out-of-fold; sel oranye cenderung Slow-Moving.',
  ]
  const liveMap = buildLiveMasterMap(master)
  const colsTemplate = `140px repeat(${sizes.length}, minmax(min(100%, 44px), 1fr))`
  const oofAcc = modelMeta?.evaluasi_klasifikasi?.akurasi_out_of_fold

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Analisis</p>
          <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>Peta Pola Varian × Ukuran</h1>
          <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '720px', lineHeight: 1.5 }}>
            Kombinasi biru cenderung laku, oranye cenderung lambat. Data berasal langsung dari model aktif di backend.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}></div>
      </header>

      <section style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label="Pilih produk">
        {products.map((p) => {
          const pressed = activeName === p.name
          return (
            <button
              key={p.name}
              type="button"
              className={pressed ? 'btn btn-p' : 'btn btn-s'}
              aria-pressed={pressed}
              onClick={() => setProduk(p.name)}
            >
              {p.name}
            </button>
          )
        })}
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
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
            flex: '999 1 640px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>{activeName}</h2>
            <span style={{ color: '#5B6670', fontSize: '13px' }}>Peluang Fast-Moving per varian dan ukuran</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colsTemplate, gap: '4px', minWidth: '640px' }}>
              <div></div>
              {sizes.map((s) => (
                <div key={s} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#4B5661', padding: '4px 0' }}>
                  {s}
                </div>
              ))}

              {variants.map((varian) => (
                <div key={varian} style={{ display: 'contents' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', paddingRight: '8px', color: '#17212B' }}>
                    {varian}
                  </div>
                  {sizes.map((s) => {
                    const entry = liveMap.get(`${activeName}|${varian}|${s}`) ?? null
                    if (!entry) {
                      return (
                        <div
                          key={s}
                          title={`${varian} · ${s} — belum pernah dijual`}
                          style={{
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            background: '#FFFFFF',
                            color: '#9FB0BC',
                            border: '1px dashed #CDD3D8',
                            boxSizing: 'border-box',
                          }}
                        >
                          —
                        </div>
                      )
                    }
                    const [prob, totalOut] = entry
                    const { bg, fg, bd } = heatColor(prob)
                    const txt = decimal2Fmt.format(prob)
                    return (
                      <div
                        key={s}
                        title={`${varian} · ${s} — Peluang Fast: ${txt} (Terjual ${qty(totalOut)} unit)`}
                        style={{
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          background: bg,
                          color: fg,
                          border: bd,
                          boxSizing: 'border-box',
                        }}
                      >
                        {txt}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#4B5661' }}>
            <span>0 · cenderung lambat</span>
            <div
              aria-hidden="true"
              style={{
                width: '220px',
                height: '10px',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #C2410C, #F3F1EC, #1D4ED8)',
              }}
            ></div>
            <span>1 · cenderung laku</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
              <span
                style={{
                  width: '18px',
                  height: '12px',
                  border: '1px dashed #CDD3D8',
                  borderRadius: '3px',
                  display: 'inline-block',
                }}
              ></span>
              belum pernah dijual
            </span>
          </div>
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
            flex: '1 1 300px',
          }}
        >
          <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>Yang perlu diketahui</h2>
          {insights.map((text, idx) => (
            <p
              key={idx}
              style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#F5F6F4',
                fontSize: '14px',
                lineHeight: 1.55,
                color: '#17212B',
              }}
            >
              {text}
            </p>
          ))}
          <p style={{ margin: 0, color: '#5B6670', fontSize: '13px', lineHeight: 1.55 }}>
            Setiap SKU dinilai oleh model yang tidak melihat SKU tersebut saat dilatih (out-of-fold). Akurasi model klasifikasi
            dalam penelitian:{' '}
            {modelMeta?.akurasi_penelitian
              ? `${decimal1Fmt.format(modelMeta.akurasi_penelitian.akurasi)}% ± ${decimal1Fmt.format(modelMeta.akurasi_penelitian.sd)}`
              : '—'}{' '}
            (nested cross-validation; out-of-fold model aktif {oofAcc !== undefined ? `${decimal1Fmt.format(oofAcc * 100)}%` : '—'}).
          </p>
        </div>
      </section>
    </>
  )
}
