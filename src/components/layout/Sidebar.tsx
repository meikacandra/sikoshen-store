import { NavLink } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen, UserCircle2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Tooltip } from '../ui/Tooltip'
import { useAuth } from '../../context/AuthContext'
import { NAV_ITEMS } from './nav'

interface SidebarProps {
  /** Mode ikon saja (tablet). */
  collapsed: boolean
  /** Tampilkan tombol bentang/ringkas (hanya tablet). */
  canToggle: boolean
  onToggle: () => void
  onNavigate?: () => void
  onLogout: () => void
}

export function Sidebar({ collapsed, canToggle, onToggle, onNavigate, onLogout }: SidebarProps) {
  const { user } = useAuth()

  return (
    <div className="flex h-full flex-col bg-charcoal text-white">
      {/* Merek */}
      <div className={cn('flex items-center gap-3 px-4 pb-4 pt-5', collapsed && 'justify-center px-0')}>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-white/10 text-section-title font-bold text-denim-200"
        >
          S
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-body-lg font-bold leading-5">Sikoshen Store</p>
            <p className="truncate text-caption text-white/65">Manajemen persediaan pakaian pria</p>
          </div>
        )}
      </div>

      {canToggle && (
        <div className={cn('px-3 pb-2', collapsed && 'flex justify-center px-0')}>
          <Tooltip content={collapsed ? 'Bentangkan menu' : 'Ringkas menu'} side="right">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Bentangkan menu' : 'Ringkas menu'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-control text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
            </button>
          </Tooltip>
        </div>
      )}

      {/* Menu */}
      <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const link = (
              <NavLink
                to={item.to}
                onClick={onNavigate}
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-3 rounded-control text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal',
                    collapsed ? 'w-11 justify-center' : 'px-3',
                    isActive ? 'bg-white text-charcoal' : 'text-white/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
            return (
              <li key={item.to} className={cn(collapsed && 'flex justify-center')}>
                {collapsed ? (
                  <Tooltip content={item.label} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Pengguna */}
      <div className={cn('border-t border-white/10 p-3', collapsed && 'flex flex-col items-center gap-2')}>
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-control px-2 py-2">
            <UserCircle2 className="h-9 w-9 shrink-0 text-white/60" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold">{user?.name ?? 'Owner'}</p>
              <p className="truncate text-caption text-white/65">Owner · {user?.email}</p>
            </div>
          </div>
        ) : (
          <Tooltip content={`${user?.name ?? 'Owner'} (Owner)`} side="right">
            <span tabIndex={0} className="inline-flex h-11 w-11 items-center justify-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <UserCircle2 className="h-7 w-7 text-white/60" aria-label={`Masuk sebagai ${user?.name ?? 'Owner'}`} />
            </span>
          </Tooltip>
        )}
        {collapsed ? (
          <Tooltip content="Keluar" side="right">
            <button
              type="button"
              onClick={onLogout}
              aria-label="Keluar"
              className="inline-flex h-11 w-11 items-center justify-center rounded-control text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 flex h-11 w-full items-center gap-3 rounded-control px-3 text-body font-semibold text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Keluar
          </button>
        )}
      </div>
    </div>
  )
}
