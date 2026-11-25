/**
 * Format angka & tanggal Indonesia. Contoh keluaran:
 *   formatNumber(2430)          → "2.430"
 *   formatDate(new Date(2026,5,3)) → "3 Jun 2026"
 *   formatDateTime(...)         → "3 Jun 2026, 14.05"
 *   formatPeriod(des25, mei26)  → "Des 2025–Mei 2026"
 */
const num = new Intl.NumberFormat('id-ID')
const dec1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' })
const monthOnlyFmt = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const monthLongFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

/** Beberapa runtime menulis "Agu." / "Sep." dengan titik; kita buang agar konsisten. */
const clean = (s: string) => s.replace(/\./g, '').replace(/\s+/g, ' ').trim()

export const formatNumber = (n: number) => num.format(n)
export const formatDecimal1 = (n: number) => dec1.format(n)
export const formatUnit = (n: number) => `${num.format(n)} unit`

export const formatDate = (d: Date) => clean(dateFmt.format(d))
export const formatTime = (d: Date) => timeFmt.format(d).replace(':', '.')
export const formatDateTime = (d: Date) => `${formatDate(d)}, ${formatTime(d)}`

/** "Mei 2026" */
export const formatMonth = (d: Date) => clean(monthFmt.format(d))
/** "Mei" */
export const formatMonthShort = (d: Date) => clean(monthOnlyFmt.format(d))
/** "Mei 2026" (panjang: "Desember 2025") */
export const formatMonthLong = (d: Date) => monthLongFmt.format(d)

/** "Des 2025–Mei 2026" (en dash, tanpa spasi). */
export const formatPeriod = (from: Date, to: Date) => `${formatMonth(from)}–${formatMonth(to)}`

/** Persentase bertanda: "+4,7%" / "−4,7%" (memakai tanda minus asli). */
export function formatSignedPercent(value: number): string {
  const s = dec1.format(Math.abs(value))
  if (Math.abs(value) < 0.05) return '0,0%'
  return `${value > 0 ? '+' : '−'}${s}%`
}
