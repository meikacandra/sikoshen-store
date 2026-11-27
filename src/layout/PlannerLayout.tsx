import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useForecast } from '../context/ForecastContext'
import { dateName, monthName } from '../lib/planner'
import { MENU_ITEMS, type MenuItem } from './menu'

function MenuIcon({ id }: { id: MenuItem['id'] }) {
  switch (id) {
    case 'beranda':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11l9-8 9 8"></path>
          <path d="M5 10v10h14V10"></path>
        </svg>
      )
    case 'unggah-data':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4"></path>
          <path d="M7 9l5-5 5 5"></path>
          <path d="M4 20h16"></path>
        </svg>
      )
    case 'saran-pemesanan':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 4h2l2.4 11h11.2L21 8H6.2"></path>
          <circle cx="9" cy="20" r="1.5"></circle>
          <circle cx="18" cy="20" r="1.5"></circle>
        </svg>
      )
    case 'peta-pola':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
        </svg>
      )
    case 'cek-kombinasi':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M20 20l-4-4"></path>
        </svg>
      )
    case 'perlu-perhatian':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l10 18H2z"></path>
          <path d="M12 10v5"></path>
          <path d="M12 18v.5"></path>
        </svg>
      )
  }
}

export function PlannerLayout() {
  const { user, logout } = useAuth()
  const { data, loading, error, notice, busy, load, setError, setNotice } = useForecast()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  const currentMonth = data?.rows[0]?.prediction_month ?? null
  const activePath = location.pathname === '/dashboard' || location.pathname === '/' ? '/beranda' : location.pathname

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: '#F5F6F4' }}>
      <aside
        style={{
          flex: '1 1 220px',
          maxWidth: '250px',
          background: '#12212B',
          padding: '24px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#1D4ED8',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '17px',
            }}
          >
            S
          </div>
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '16px' }}>Sikoshen</div>
            <div style={{ color: '#9FB0BC', fontSize: '12px' }}>Stock Planner</div>
          </div>
        </div>

        <nav aria-label="Menu utama" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {MENU_ITEMS.map((item) => {
            const isActive = activePath === item.path
            return (
              <button
                key={item.id}
                type="button"
                className={'dc-nav' + (isActive ? ' on' : '')}
                aria-current={isActive ? 'page' : undefined}
                disabled={busy}
                onClick={() => {
                  if (data) setError('')
                  setNotice('')
                  navigate(item.path)
                }}
              >
                <MenuIcon id={item.id} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: '#1A2D3A',
              color: '#9FB0BC',
              fontSize: '12px',
              lineHeight: 1.6,
            }}
          >
            Data terakhir
            <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '14px' }}>
              {data ? dateName(data.period_end) : 'Belum tersedia'}
            </div>
            {currentMonth ? `Prediksi untuk ${monthName(currentMonth)}` : 'Menunggu data stok'}
          </div>
          <button
            type="button"
            className="dc-nav"
            onClick={async () => {
              try {
                const r = await fetch('/api/auth/logout', { method: 'POST' })
                if (!r.ok) throw Error()
                logout()
                navigate('/login', { state: { loggedOut: true }, replace: true })
              } catch {
                setError('Gagal keluar. Coba lagi.')
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4h4v16h-4"></path>
              <path d="M10 8l-4 4 4 4"></path>
              <path d="M6 12h10"></path>
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <main
        style={{
          flex: '999 1 560px',
          minWidth: 0,
          padding: '32px 40px 56px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {error && (
          <div className="fs-error" role="alert">
            {error}{' '}
            {!data && (
              <button type="button" className="btn btn-s" onClick={load}>
                Coba lagi
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="fs-notice" role="status">
            {notice}
          </div>
        )}
        {loading && !data && !error && <p role="status">Memuat hasil model…</p>}
        <Outlet />
      </main>
    </div>
  )
}
