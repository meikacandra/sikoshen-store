import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { useIsDesktop, useIsMobile, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { useAuth } from '../../context/AuthContext'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { PageSkeleton } from '../ui/Feedback'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Topbar } from './Topbar'
import { DemoPanel } from '../demo/DemoPanel'

/** Durasi skeleton saat berpindah halaman (rasa "memuat data"). */
const ROUTE_SKELETON_MS = 380

export function AppShell() {
  const isDesktop = useIsDesktop()
  const isMobile = useIsMobile()
  const reduce = usePrefersReducedMotion()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [tabletExpanded, setTabletExpanded] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Skeleton singkat setiap kali path berubah (bukan saat query string berubah).
  useEffect(() => {
    setLoading(true)
    const t = window.setTimeout(() => setLoading(false), ROUTE_SKELETON_MS)
    window.scrollTo({ top: 0 })
    return () => window.clearTimeout(t)
  }, [pathname])

  // Tutup sidebar tablet yang dibentangkan dengan Esc.
  useEffect(() => {
    if (!tabletExpanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTabletExpanded(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tabletExpanded])

  const isTablet = !isDesktop && !isMobile
  const collapsed = isTablet && !tabletExpanded

  const confirmLogout = () => {
    setLogoutOpen(false)
    logout()
    navigate('/login', { replace: true, state: { loggedOut: true } })
  }

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#konten"
        className="sr-only z-[100] rounded-control bg-white px-4 py-2 font-semibold text-denim shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Lewati ke konten
      </a>

      {/* Sidebar: desktop (lebar) & tablet (ikon, bisa dibentangkan sebagai lapisan) */}
      {!isMobile && (
        <>
          <aside
            className={cn(
              'no-print fixed inset-y-0 left-0 z-50 transition-[width] duration-200',
              collapsed ? 'w-[72px]' : 'w-64',
              isTablet && tabletExpanded && 'shadow-pop',
            )}
          >
            <Sidebar
              collapsed={collapsed}
              canToggle={isTablet}
              onToggle={() => setTabletExpanded((v) => !v)}
              onNavigate={() => isTablet && setTabletExpanded(false)}
              onLogout={() => setLogoutOpen(true)}
            />
          </aside>
          {isTablet && tabletExpanded && (
            <div className="no-print fixed inset-0 z-40 bg-charcoal/30" aria-hidden="true" onClick={() => setTabletExpanded(false)} />
          )}
        </>
      )}

      <div className={cn('flex min-h-dvh flex-col', isDesktop ? 'pl-64' : !isMobile && 'pl-[72px]', 'print:pl-0')}>
        <Topbar />
        <main id="konten" tabIndex={-1} className="flex-1 focus:outline-none">
          <div className="mx-auto w-full max-w-content px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8 lg:pt-8">
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                  <PageSkeleton />
                </motion.div>
              ) : (
                <motion.div
                  key={pathname}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <Outlet />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {isMobile && <BottomNav onLogout={() => setLogoutOpen(true)} />}

      <DemoPanel />

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
        title="Keluar dari Sikoshen Store?"
        description="Anda perlu masuk lagi dengan email dan kata sandi untuk membuka data toko."
        confirmLabel="Keluar"
        cancelLabel="Tetap di sini"
        tone="danger"
      />
    </div>
  )
}
