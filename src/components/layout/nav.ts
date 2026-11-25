import {
  BarChart3,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Package,
  Upload,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  /** Label ringkas untuk bar navigasi bawah (ponsel). */
  short: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Beranda', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Kartu Stok', short: 'Upload', icon: Upload },
  { to: '/produk', label: 'Produk & Stok', short: 'Stok', icon: Package },
  { to: '/klasifikasi', label: 'Klasifikasi Pergerakan', short: 'Klasifikasi', icon: BarChart3 },
  { to: '/rekomendasi', label: 'Rekomendasi Persediaan', short: 'Saran', icon: ClipboardCheck },
  { to: '/laporan', label: 'Laporan', short: 'Laporan', icon: FileText },
]

export const navByPath = (to: string) => NAV_ITEMS.find((n) => n.to === to)!
