import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, LogOut, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/cn'
import { BottomSheet } from '../ui/Overlay'
import { navByPath } from './nav'

const PRIMARY = ['/dashboard', '/produk', '/klasifikasi', '/rekomendasi'].map(navByPath)
const MORE = ['/upload', '/laporan'].map(navByPath)

export function BottomNav({ onLogout }: { onLogout: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = MORE.some((m) => pathname.startsWith(m.to))

  const itemCls = (active: boolean) =>
    cn(
      'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-[11px] font-semibold leading-4 transition-colors focus-ring',
      active ? 'text-denim' : 'text-muted hover:text-charcoal',
    )

  return (
    <>
      <nav
        aria-label="Menu utama"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),4px)] pt-1 backdrop-blur"
      >
        <ul className="flex">
          {PRIMARY.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to} className="flex flex-1">
                <NavLink to={item.to} className={({ isActive }) => itemCls(isActive)}>
                  {({ isActive }) => (
                    <>
                      <span className={cn('flex h-7 w-12 items-center justify-center rounded-full', isActive && 'bg-denim-50')}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      {item.short}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={itemCls(moreActive)}
            >
              <span className={cn('flex h-7 w-12 items-center justify-center rounded-full', moreActive && 'bg-denim-50')}>
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              Lainnya
            </button>
          </li>
        </ul>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu lainnya">
        <ul className="divide-y divide-border">
          {MORE.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.to)
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[56px] items-center gap-3 rounded-control px-2 font-semibold focus-ring',
                    active ? 'text-denim' : 'text-charcoal',
                  )}
                >
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-control', active ? 'bg-denim-50' : 'bg-surface')}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false)
                onLogout()
              }}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-control px-2 text-left font-semibold text-danger-fg focus-ring"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-danger-bg">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </span>
              Keluar
            </button>
          </li>
        </ul>
      </BottomSheet>
    </>
  )
}
