import { useEffect, useState } from 'react'
import { useForecast } from '../context/ForecastContext'
import { decimal2Fmt, type PeluangFastResponse } from '../lib/planner'

const CUSTOM_VARIANT_VALUE = '__custom_variant__'

export default function CekKombinasi() {
  const { products, checkCombination } = useForecast()
  const [produk, setProduk] = useState<string>('')
  const [varianChoice, setVarianChoice] = useState<string>('')
  const [customVarian, setCustomVarian] = useState<string>('')
  const [ukuran, setUkuran] = useState<string>('')

  const [result, setResult] = useState<PeluangFastResponse | null>(null)
  const [checking, setChecking] = useState<boolean>(false)
  const [checkError, setCheckError] = useState<string>('')

  useEffect(() => {
    if (products.length > 0 && !produk) {
      const first = products[0]
      setProduk(first.name)
      setVarianChoice(first.variants[0] ?? '')
      setUkuran(first.sizes[2] ?? first.sizes[0] ?? '')
    }
  }, [products, produk])

  const activeProduct = products.find((p) => p.name === produk) ?? products[0]
  const varianList = activeProduct?.variants ?? []
  const ukuranList = activeProduct?.sizes ?? []
  const isCustomVariant = varianChoice === CUSTOM_VARIANT_VALUE
  const effectiveVarian = isCustomVariant ? customVarian.trim() : varianChoice

  function handleProdukChange(nextProduk: string) {
    const nextCfg = products.find((p) => p.name === nextProduk)
    setProduk(nextProduk)
    setVarianChoice(nextCfg?.variants[0] ?? '')
    setCustomVarian('')
    setUkuran(nextCfg?.sizes[2] ?? nextCfg?.sizes[0] ?? '')
  }

  useEffect(() => {
    if (!produk || !effectiveVarian || !ukuran) {
      setResult(null)
      setCheckError('')
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setChecking(true)
      setCheckError('')
      checkCombination(produk, effectiveVarian, ukuran)
        .then((res) => {
          if (!cancelled) setResult(res)
        })
        .catch((err) => {
          if (!cancelled) {
            setResult(null)
            setCheckError(err instanceof Error ? err.message : 'Gagal memeriksa kombinasi di backend.')
          }
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, isCustomVariant ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [produk, effectiveVarian, ukuran, isCustomVariant, checkCombination])

  const selectStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #D0D7DE',
    background: '#FFFFFF',
    fontSize: '14px',
    color: '#17212B',
  } as const

  if (products.length === 0) {
    return (
      <section className="dc-card">
        <h1 style={{ fontSize: '24px', margin: '0 0 8px', color: '#17212B' }}>Cek Kombinasi</h1>
        <p style={{ margin: 0, color: '#5B6670', fontSize: '14px' }}>
          Data katalog model belum siap. Pastikan backend aktif dan file model <code>rf_sikoshen.pkl</code> berhasil dimuat.
        </p>
      </section>
    )
  }

  const pVal = result?.probability ?? 0
  const warna = result && !result.known ? '#B45309' : pVal >= 0.5 ? '#1D4ED8' : '#C2410C'
  const pTxt = result ? decimal2Fmt.format(pVal) : '—'
  const kat =
    result && !result.known
      ? 'Tidak dapat diandalkan (varian baru)'
      : pVal >= 0.5
        ? 'Cenderung Fast-Moving'
        : 'Cenderung Slow-Moving'
  const bar = `${Math.round(pVal * 100)}%`
  const saran =
    result && !result.known
      ? 'Varian ini belum pernah terlihat saat pelatihan model. Lakukan uji pasar dalam jumlah kecil terlebih dahulu sebelum memesan stok besar.'
      : pVal >= 0.75
        ? 'Prioritaskan pengisian stok. Kombinasi varian dan ukuran ini sangat cepat terjual.'
        : pVal >= 0.5
          ? 'Pertahankan ketersediaan stok secukupnya dan pantau pergerakan bulanan.'
          : 'Beli secukupnya saja untuk pelengkap seri; hindari menumpuk stok pada kombinasi ini.'

  const avgVarian = result?.avg_variant !== null && result?.avg_variant !== undefined ? decimal2Fmt.format(result.avg_variant) : '—'
  const avgUkuran = result?.avg_size !== null && result?.avg_size !== undefined ? decimal2Fmt.format(result.avg_size) : '—'

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <p style={{ margin: '0 0 6px', color: '#5B6670', fontSize: '13px' }}>Analisis</p>
          <h1 style={{ fontSize: '30px', margin: 0, fontWeight: 700, color: '#17212B' }}>Cek Kombinasi</h1>
          <p style={{ margin: '8px 0 0', color: '#5B6670', fontSize: '15px', maxWidth: '720px', lineHeight: 1.5 }}>
            Hitung peluang sebuah kombinasi produk, varian, dan ukuran cenderung Fast-Moving langsung dari model klasifikasi backend.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}></div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', alignItems: 'start' }}>
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E3E6E8',
            borderRadius: '12px',
            padding: '20px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 700, color: '#17212B' }}>Pilih kombinasi</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="cp" style={{ fontSize: '13px', fontWeight: 600, color: '#3F4A54' }}>
              Jenis produk
            </label>
            <select id="cp" value={produk} onChange={(e) => handleProdukChange(e.target.value)} style={selectStyle}>
              {products.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="cv" style={{ fontSize: '13px', fontWeight: 600, color: '#3F4A54' }}>
              Varian
            </label>
            <select id="cv" value={varianChoice} onChange={(e) => setVarianChoice(e.target.value)} style={selectStyle}>
              {varianList.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={CUSTOM_VARIANT_VALUE}>+ Varian baru (uji nama varian lain)</option>
            </select>
            {isCustomVariant && (
              <input
                type="text"
                placeholder="Ketik nama varian baru, mis. HIJAU ARMY"
                value={customVarian}
                onChange={(e) => setCustomVarian(e.target.value)}
                style={{ ...selectStyle, marginTop: '4px', boxSizing: 'border-box' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="cu" style={{ fontSize: '13px', fontWeight: 600, color: '#3F4A54' }}>
              Ukuran
            </label>
            <select id="cu" value={ukuran} onChange={(e) => setUkuran(e.target.value)} style={selectStyle}>
              {ukuranList.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: '#FFF4EA',
              fontSize: '13px',
              lineHeight: 1.55,
              color: '#3F4A54',
            }}
          >
            <strong style={{ color: '#9A3412' }}>Berlaku andal hanya untuk varian yang pernah dijual.</strong> Pada hasil penelitian terdahulu, untuk varian yang benar-benar baru belum pernah dilihat model, akurasi hanya <strong>49,7%</strong> (setara menebak), sehingga tidak dapat diandalkan.
          </div>
        </form>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E3E6E8',
            borderRadius: '12px',
            padding: '20px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#5B6670', fontSize: '13px' }}>{produk}</p>
            <h2 style={{ fontSize: '22px', margin: '4px 0 0', fontWeight: 700, color: '#17212B' }}>
              {effectiveVarian || '—'} · ukuran {ukuran || '—'}
            </h2>
          </div>

          {checkError && (
            <div className="fs-error" role="alert">
              {checkError}
            </div>
          )}

          {!effectiveVarian ? (
            <div
              style={{
                padding: '18px',
                borderRadius: '10px',
                border: '1px dashed #B9C2C9',
                color: '#3F4A54',
                fontSize: '14px',
              }}
            >
              Ketik nama varian untuk mengecek peluangnya dari model backend.
            </div>
          ) : checking && !result ? (
            <p role="status" style={{ margin: 0, color: '#5B6670', fontSize: '14px' }}>
              Menghitung peluang dari model…
            </p>
          ) : result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!result.known && (
                <div
                  role="alert"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#FFF4EA',
                    border: '1px solid #FDBA74',
                    color: '#9A3412',
                    fontSize: '13.5px',
                    lineHeight: 1.55,
                  }}
                >
                  <strong>Peringatan varian belum dikenal:</strong>{' '}
                  {result.warning ?? 'Varian belum pernah terlihat saat pelatihan model; hasil tidak dapat diandalkan (~50%).'}
                </div>
              )}

              {result.known && !result.in_training_master && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#EFF4FF',
                    color: '#1E40AF',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  Kombinasi ukuran ini belum pernah dijual sebelumnya — peluang dihitung langsung oleh <code>ModelSikoshen.peluang_fast()</code> dari pola varian & ukuran.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '52px', lineHeight: 1, color: warna, fontVariantNumeric: 'tabular-nums' }}>
                  {pTxt}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 600, color: warna }}>{kat}</span>
              </div>

              <div>
                <div aria-hidden="true" style={{ height: '12px', borderRadius: '999px', background: '#ECEEF0', overflow: 'hidden' }}>
                  <div style={{ height: '12px', borderRadius: '999px', background: warna, width: bar }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5B6670', marginTop: '6px' }}>
                  <span>0 · cenderung lambat</span>
                  <span>0,5</span>
                  <span>1 · cenderung laku</span>
                </div>
              </div>

              <p style={{ margin: 0, padding: '14px', borderRadius: '10px', background: '#F5F6F4', fontSize: '15px', lineHeight: 1.55, color: '#17212B' }}>
                <strong>Saran:</strong> {saran}
              </p>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #E3E6E8' }}>
              <div style={{ color: '#5B6670', fontSize: '12px' }}>Rata-rata varian ini</div>
              <div style={{ fontWeight: 700, fontSize: '20px', color: '#17212B', marginTop: '2px' }}>{avgVarian}</div>
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #E3E6E8' }}>
              <div style={{ color: '#5B6670', fontSize: '12px' }}>Rata-rata ukuran ini</div>
              <div style={{ fontWeight: 700, fontSize: '20px', color: '#17212B', marginTop: '2px' }}>{avgUkuran}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
