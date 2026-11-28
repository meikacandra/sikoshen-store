export interface MenuItem {
  id: 'beranda' | 'unggah-data' | 'klasifikasi' | 'saran-pemesanan' | 'peta-pola' | 'cek-kombinasi' | 'perlu-perhatian'
  label: string
  path: string
}

/**
 * Daftar menu utama sidebar disimpan di satu tempat
 * agar urutan dan labelnya mudah diubah.
 */
export const MENU_ITEMS: readonly MenuItem[] = [
  { id: 'beranda', label: 'Beranda', path: '/beranda' },
  { id: 'unggah-data', label: 'Unggah Data', path: '/unggah-data' },
  { id: 'klasifikasi', label: 'Klasifikasi', path: '/klasifikasi' },
  { id: 'saran-pemesanan', label: 'Saran Pemesanan', path: '/saran-pemesanan' },
  { id: 'peta-pola', label: 'Peta Pola', path: '/peta-pola' },
  { id: 'cek-kombinasi', label: 'Cek Kombinasi', path: '/cek-kombinasi' },
  { id: 'perlu-perhatian', label: 'Perlu Perhatian', path: '/perlu-perhatian' },
] as const
