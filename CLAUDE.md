# Prompt Claude Code — Front-end Prototipe "Sikoshen Store"

## 1. Peran dan tujuan

Kamu adalah senior front-end engineer sekaligus UI engineer. Bangun **prototipe front-end** website **Sikoshen Store** dengan **React**. Sikoshen Store adalah sistem informasi manajemen persediaan untuk toko pakaian pria di Tanah Abang, Jakarta Pusat.

Prototipe ini dipakai untuk presentasi dan pengujian alur. **Belum ada backend.** Semua data adalah data tiruan (mock) yang disimpan di front-end. Meski statis, aplikasi harus **terasa benar-benar berfungsi**:
- Setiap tombol memberi respons yang masuk akal.
- Filter dan pencarian benar-benar menyaring data.
- Proses seperti unggah file dan menjalankan klasifikasi disimulasikan, lengkap dengan progres dan hasilnya.

Jangan membuat tombol mati, tombol yang dinonaktifkan tanpa alasan, atau tautan `#` yang tidak melakukan apa-apa.

## 2. Konteks produk (wajib dipatuhi)

- **Pengguna:** satu peran saja, yaitu **Owner**.
- **Sumber data:** file **kartu stok harian** (Excel/CSV) yang diunggah Owner. Isinya riwayat barang masuk, barang keluar, dan stok akhir.
- **Produk:** 3 jenis produk dengan total **126 SKU**.
  - **Kemeja Denim:** 6 varian warna, ukuran huruf M, L, XL, XXL, XXXL, XXXXL.
  - **Tony Jack Biasa:** 5 varian warna, ukuran angka 28–38.
  - **Iron Head Ultimate:** 4 varian warna, ukuran angka 28–38.
- **Definisi SKU:** 1 SKU = Jenis Produk + Varian Warna + Ukuran. Ukuran berbeda berarti SKU berbeda.
- **Periode data:** 1 Mei 2023 – 31 Mei 2026. Unggahan terakhir 3 Jun 2026, 14.05. Klasifikasi terakhir 3 Jun 2026, 14.20.
- **Keluaran model:** model machine learning **Random Forest Regressor** memperkirakan total barang keluar tiap SKU. Angka itu lalu dibandingkan dengan **median total keluar jenis produknya**:
  - di atas median → **Fast-Moving**
  - sama dengan atau di bawah median → **Slow-Moving**
  - Hasil saat ini: **61 Fast-Moving, 65 Slow-Moving**.
- **Belum ada prediksi penjualan bulan depan.** Jangan menampilkan angka prediksi unit, kisaran prediksi, safety stock, atau rumus jumlah restock. Label Fast/Slow juga tidak boleh dibahasakan sebagai ramalan.
- **Rekomendasi:** berupa tindakan, bukan jumlah unit. Isinya adalah bahan pertimbangan Owner, bukan pesanan pembelian otomatis.
- **Bukan aplikasi kasir.** Jangan menambahkan fitur kasir, pembayaran, karyawan, supplier lengkap, akuntansi, atau purchase order.

## 3. Teknologi

- **Dasar:** Vite + React 18 + TypeScript.
- **Routing:** React Router v6.
- **Styling:** Tailwind CSS v3. Semua token warna didefinisikan di `tailwind.config` dan sebagai CSS variables di `src/styles/tokens.css`. Jangan menulis hex langsung di komponen.
- **Grafik:** Recharts.
- **Ikon:** lucide-react. Gunakan ikon garis, jangan emoji.
- **Animasi:** Framer Motion, hanya untuk transisi halus.
- **Font:** Plus Jakarta Sans melalui `@fontsource/plus-jakarta-sans` (bobot 400, 500, 600, 700).
- **State:** React Context + `useReducer`. Sesi login dan pengaturan demo disimpan di `localStorage`, dibungkus try/catch.
- **Format angka dan tanggal:** `Intl.NumberFormat('id-ID')` dan `Intl.DateTimeFormat('id-ID')`.
- Jangan memasang library komponen besar seperti MUI atau Ant Design. Buat komponen sendiri yang kecil dan rapi.

## 4. Prinsip desain

### Clean
- Banyak ruang kosong. Satu fokus utama per bagian.
- Kartu putih di atas latar abu muda, garis tepi tipis, bayangan sangat halus.
- Hierarki tipografi tegas: judul halaman, judul bagian, isi, keterangan.
- Hindari gradien ramai, border kiri berwarna, ikon dekoratif berlebihan, dan emoji.

### Adaptif
- Desktop memakai sidebar. Tablet memakai sidebar ringkas ikon + tooltip. Ponsel memakai bar navigasi bawah.
- Tabel berubah menjadi daftar kartu di ponsel.
- Filter di ponsel dibuka sebagai *bottom sheet*.
- Konten mengikuti kondisi data: kosong, data belum cukup, proses berjalan, gagal, berhasil.

### Interaktif
- Setiap aksi punya umpan balik: hover/focus/active state, skeleton saat memuat, toast setelah aksi, konfirmasi sebelum aksi berisiko, progres untuk proses panjang.
- Tooltip pada grafik dan istilah teknis, misalnya ikon "?" di sebelah "Median".

### Responsif
- Breakpoint: `<640` ponsel, `640–1023` tablet, `≥1024` desktop, `≥1440` konten dibatasi `max-w-[1200px]`.
- Tidak boleh ada scroll horizontal di halaman. Tabel lebar diberi pembungkus `overflow-x-auto`.
- Target sentuh minimal 44×44 px.

## 5. Design tokens

### Palet utama (dari klien, wajib)

| Token | Hex | Penggunaan |
|---|---|---|
| `white` | `#FFFFFF` | Background utama: halaman login, isi kartu, modal |
| `surface` | `#F7F7F9` | Latar area konten di belakang kartu, baris tabel bergaris, panel filter |
| `charcoal` | `#2E2E2E` | Teks utama dan judul. Juga latar sidebar desktop dengan teks putih |
| `denim` | `#2A5C8D` | Aksen: tombol utama, tautan, item navigasi aktif, penanda kategori, label Fast-Moving |

### Turunan

| Token | Hex | Penggunaan |
|---|---|---|
| `denim-700` | `#1F4669` | Hover/pressed tombol utama |
| `denim-50` | `#E8EFF6` | Latar chip Fast-Moving, latar item navigasi aktif di ponsel |
| `denim-200` | `#B9CCE0` | Border chip Fast, batang "Barang masuk" di grafik |
| `muted` | `#5F6470` | Teks sekunder dan keterangan |
| `border` | `#E4E6EA` | Garis tepi kartu, input, dan pemisah |
| `border-strong` | `#C9CDD4` | Border input dan tombol sekunder |

### Warna status (selalu bersama ikon dan teks)

| Status | Teks | Latar | Border | Ikon |
|---|---|---|---|---|
| Habis / Prioritaskan restock / Error | `#B42318` | `#FEF3F2` | `#FECDCA` | `XCircle` / `AlertTriangle` |
| Di bawah rata-rata / Peringatan | `#B54708` | `#FFFAEB` | `#FEDF89` | `AlertTriangle` |
| Normal / Pantau / Berhasil | `#067647` | `#ECFDF3` | `#ABEFC6` | `CheckCircle2` |
| Menumpuk / Evaluasi stok | `#5925DC` | `#F4F3FF` | `#D9D6FE` | `Layers` |
| Tahan pembelian / Netral | `#475467` | `#F2F4F7` | `#D0D5DD` | `PauseCircle` |
| Slow-Moving | `#8A3B0C` | `#FDF1E7` | `#F2C49E` | `TrendingDown` |
| Fast-Moving | `#2A5C8D` | `#E8EFF6` | `#B9CCE0` | `TrendingUp` |

### Tipografi, ruang, dan bentuk

- Judul halaman 28/36 bold. Judul bagian 18/26 bold. Isi 14–15/22. Keterangan 12–13/18. Angka KPI 28–32 bold `tabular-nums`.
- Spasi kelipatan 4 px. Padding kartu 24 px desktop, 16 px ponsel. Jarak antar-bagian 24 px.
- Radius: input/tombol 10 px, kartu 14 px, modal 16 px, chip `rounded-full`.
- Bayangan: kartu `0 1px 2px rgba(46,46,46,.04)`, modal/popover `0 12px 32px rgba(46,46,46,.12)`.
- Grafik: keluar `denim`, masuk `denim-200`, grid `border`, sumbu `muted`. Jangan dua sumbu Y. Legenda bila >1 seri, tooltip saat hover.

## 6. Struktur proyek

```
src/
  main.tsx, App.tsx, router.tsx
  styles/tokens.css, index.css
  data/            products.ts, skus.ts, movements.ts, classification.ts, uploads.ts, model.ts
  context/         AuthContext, DataContext, ToastContext, DemoContext
  hooks/           useMediaQuery, useSimulatedProcess, useFilters, useCountUp
  lib/             format.ts, rules.ts, exportCsv.ts
  components/
    layout/        AppShell, Sidebar, BottomNav, Topbar, PageHeader
    ui/            Button, Card, Chip, StatusChip, LabelChip, Input, Select, SearchInput,
                   Tabs, SegmentedControl, Table, ResponsiveTable, Modal,
                   BottomSheet, Toast, Tooltip, ProgressBar, Stepper, Skeleton, EmptyState, Banner
    charts/        MovementBarChart, CompositionBar, FeatureImportance, ConfusionMatrix
  pages/           Login, Dashboard, Upload, Products, SkuDetail, Classification, Recommendations, Reports, NotFound
```

Komponen kecil, reusable, bertipe. Logika aturan bisnis di `lib/rules.ts`, bukan di JSX.

## 7. Mock data

Generator dengan **seed tetap** (mulberry32).

### Ringkasan yang harus konsisten
- 3 jenis produk, 126 SKU: Kemeja Denim 36, Tony Jack Biasa 52, Iron Head Ultimate 38.
- Fast/Slow per jenis: Kemeja Denim 17/19, Tony Jack Biasa 26/26, Iron Head Ultimate 18/20. Total 61/65.
- Median total keluar per jenis: Kemeja Denim 610, Tony Jack Biasa 480, Iron Head Ultimate 300 unit.
- Total stok per 31 Mei 2026: 2.430 unit (Kemeja Denim 760, Tony Jack Biasa 1.100, Iron Head Ultimate 570).
- Masuk/keluar bulanan semua SKU:

  | Bulan | Masuk | Keluar |
  |---|---|---|
  | Des 2025 | 520 | 610 |
  | Jan 2026 | 480 | 540 |
  | Feb 2026 | 690 | 820 |
  | Mar 2026 | 560 | 650 |
  | Apr 2026 | 640 | 680 |
  | Mei 2026 | 610 | 702 |

  Data bulanan Mei 2023–Nov 2025 dengan pola musiman wajar (naik menjelang Lebaran).
- Jumlah tindakan: Prioritaskan restock 9, Pantau stok 52, Tahan pembelian 51, Evaluasi stok menumpuk 14.

### SKU contoh (harus ada persis)

| Produk | Varian | Ukuran | Label | Stok | Rata-rata stok | Rata-rata keluar/bln | Estimasi total keluar |
|---|---|---|---|---|---|---|---|
| Kemeja Denim | Hitam | L | Fast | 20 | 38 | 41 | 1.480 |
| Kemeja Denim | Hitam | XL | Fast | 0 | 22 | 28 | 1.010 |
| Tony Jack Biasa | Hitam | 32 | Fast | 14 | 30 | 35 | 1.260 |
| Iron Head Ultimate | Navy | 31 | Fast | 26 | 24 | 18 | 650 |
| Tony Jack Biasa | Krem | 36 | Slow | 9 | 12 | 3 | 110 |
| Kemeja Denim | Biru Muda | XXXXL | Slow | 34 | 18 | 2 | 75 |
| Iron Head Ultimate | Abu | 38 | Slow | 15 | 14 | 1 | 40 |

### Detail SKU Kemeja Denim / Hitam / L (kode `KMJDENIM-HITAM-L`)

| Bulan | Stok awal | Masuk | Keluar | Stok akhir |
|---|---|---|---|---|
| Des 2025 | 54 | 40 | 42 | 52 |
| Jan 2026 | 52 | 30 | 36 | 46 |
| Feb 2026 | 46 | 60 | 52 | 54 |
| Mar 2026 | 54 | 40 | 58 | 36 |
| Apr 2026 | 36 | 40 | 44 | 32 |
| Mei 2026 | 32 | 30 | 42 | 20 |

Rincian transaksi Mei 2026:

| Tanggal | Masuk | Keluar | Stok |
|---|---|---|---|
| 02/05 | 0 | 3 | 29 |
| 06/05 | 30 | 5 | 54 |
| 12/05 | 0 | 9 | 45 |
| 18/05 | 0 | 11 | 34 |
| 24/05 | 0 | 8 | 26 |
| 31/05 | 0 | 6 | 20 |

Total keluar aktual Mei 2023–Mei 2026: 1.452 unit.

### Model (`data/model.ts`)
- Random Forest Regressor, 150 pohon, kedalaman maksimum 5.
- 100 SKU latih, 26 SKU uji.
- Akurasi label 96,15% (25 dari 26). Recall Fast 1,00, recall Slow 0,92. Validasi silang berulang 90,79% ± 5,79%.
- Confusion matrix: Sebenarnya Slow → 12 Slow / 1 Fast; Sebenarnya Fast → 0 Slow / 13 Fast.
- Pengaruh fitur: Total barang masuk 0,27 · Naik-turun stok 0,19 · Stok tertinggi 0,18 · Rata-rata stok 0,17 · Varian warna 0,13 · Jenis produk 0,05 · Jenis ukuran 0,01 · Stok terendah 0,01.
- MAE: teks `[isi dari notebook]`.

### Riwayat unggahan
1. "3 file kartu stok (Denim, TJ Biasa, Iron Head)", 3 Jun 2026 14.05, Berhasil: 93.977 baris, 126 SKU, 702 dibuang.
2. "STOK TJ BIASA-50.pdf", 3 Jun 2026 13.52, Ditolak: format .pdf tidak didukung.

### Riwayat klasifikasi
1. 3 Jun 2026 14.20, data Mei 2023–Mei 2026: 61 Fast / 65 Slow, 3 SKU berubah label.
2. 2 Mei 2026 10.30, data Mei 2023–Apr 2026: 60 Fast / 66 Slow.

### Aturan bisnis (`lib/rules.ts`)
- Kondisi stok: Habis = 0; Di bawah rata-rata = stok < rata-rata stok historis; Menumpuk = stok ≥ 1,5 × rata-rata; selain itu Normal.
- Tindakan: Fast + (Habis/Di bawah) → Prioritaskan restock; Fast + (Normal/Menumpuk) → Pantau stok; Slow + Menumpuk → Evaluasi stok menumpuk; Slow + lainnya → Tahan pembelian.
- Cukup untuk = stok ÷ rata-rata keluar/bulan (12 bulan terakhir), 1 desimal ("0,5 bulan"), selalu dengan keterangan "data historis, bukan prediksi".
- SKU belum diklasifikasikan: riwayat < 3 bulan, atau varian/jenis belum dikenal model.

## 8. Halaman, komponen, dan interaksi

### Navigasi global (AppShell)
- Menu: Dashboard · Upload Kartu Stok · Produk & Stok · Klasifikasi Pergerakan · Rekomendasi Persediaan · Laporan.
- Desktop: sidebar charcoal, logo teks "Sikoshen Store", subjudul "Manajemen persediaan pakaian pria". Item aktif latar putih teks charcoal + `aria-current="page"`. Di bawah: nama Owner + tombol Keluar.
- Tablet: sidebar ikon + tooltip, bisa dibentangkan.
- Ponsel: bottom nav 5 item: Beranda, Stok, Klasifikasi, Saran, Lainnya ("Lainnya" → bottom sheet Upload, Laporan, Keluar).
- Topbar: bilah status data (periode, unggah terakhir, klasifikasi, tautan "Unggah kartu stok baru").
- Keluar → modal konfirmasi → /login dengan banner hijau "Anda sudah keluar dengan aman."
- Route terlindungi → /login bila belum masuk.

### 1. Login (`/login`)
- Dua kolom: kiri panel charcoal 3 manfaat, kanan form putih. Ponsel: panel kiri jadi header ringkas.
- Email, kata sandi dengan "Tampilkan", tombol Masuk. Demo: `owner@sikoshen.id` / `sikoshen123` (petunjuk kecil).
- "Memeriksa…" + spinner 800 ms. Salah → banner merah "Email atau kata sandi salah", sandi dikosongkan & difokus. 5 gagal → kunci 30 detik dengan hitung mundur.
- Berhasil → /dashboard + toast "Selamat datang kembali".

### 2. Dashboard (`/dashboard`)
- Pemilih periode bulan → memperbarui KPI masuk/keluar & menyorot bulan di grafik.
- 5 KPI klikable (Jenis produk, Jumlah SKU, Total stok, Barang masuk, Barang keluar), count-up, indikator "−4,7% vs Apr". KPI masuk/keluar → Laporan dengan filter.
- Grafik batang masuk/keluar, toggle 6 bulan / 12 bulan / semua, "Lihat sebagai tabel".
- Kartu komposisi Fast/Slow + rincian per jenis + tautan Klasifikasi.
- 4 kartu tindakan → Rekomendasi dengan filter.
- Tabel "Perlu segera diperhatikan" (Prioritaskan restock + Evaluasi stok menumpuk), klik → Detail SKU.

### 3. Upload Kartu Stok (`/upload`)
- Stepper 5 langkah: Pilih file → Periksa → Hasil pemeriksaan → Konfirmasi → Selesai.
- L1: drag-drop + "Pilih file", 1–3 file .xlsx/.csv; .pdf/lainnya ditolak banner merah + contoh format. Panel petunjuk format A (kartu stok asli) & B (7 kolom: Tanggal, Jenis_Produk, Varian Warna, Ukuran, Barang_Masuk, Barang_Keluar, Stok_Akhir). "Unduh template" CSV. "Gunakan contoh 3 file toko": `STOK KMJ DENIM-40.xlsx`, `STOK TJ BIASA-50.xlsx`, `iron head ultimate.xlsx`.
- L2: progres ±4 detik, checklist: format dikenali, dikonversi ke format baris, memeriksa tanggal, memeriksa stok negatif, mendeteksi jenis ukuran. Batalkan → L1 + toast.
- L3: 94.679 baris setelah konversi · 93.977 siap · 702 dibuang · 1.642 diperbaiki otomatis. Accordion 4 grup: Dibuang (tanggal tidak valid "12/9/923"); Diperbaiki otomatis (stok negatif → 0: Denim 964, TJ 550, IH 128); Diabaikan (21 Stok_Akhir kosong); Normal (sel kosong = 0). Tabel contoh baris bermasalah + pagination. "Unduh daftar lengkap" CSV. Pratinjau konversi.
- L4: bilah konfirmasi sticky bawah "Simpan 93.977 baris?" — Simpan / Batalkan & perbaiki file.
- L5: banner berhasil + ringkasan, tombol "Jalankan klasifikasi" → /klasifikasi dan langsung mulai.
- Mode demo L2: *Unggah gagal* (koneksi terputus, "Tidak ada data yang berubah", Coba lagi); *Periode duplikat* (modal perbandingan 25–31 Mei 2026, checkbox persetujuan, Ganti tanggal yang sama / Simpan Juni saja / Batalkan).
- Riwayat unggahan: tabel + filter status, "Detail" → drawer.

### 4. Produk & Stok (`/produk`)
- Callout "Jenis produk ≠ SKU" + diagram chip.
- Pencarian debounce 200 ms; filter jenis, varian, ukuran (huruf/angka), kondisi, label. Tab: Semua 126 · Fast 61 · Slow 65 · Habis · Menumpuk. Chip filter aktif + "Hapus semua filter". Sinkron ke query string.
- Segmented: Per SKU (tabel dikelompokkan per jenis) / Per jenis produk (3 baris bisa dibentangkan).
- Kolom: Produk, Varian, Ukuran, Stok terakhir, Total masuk, Total keluar, Kondisi stok, Label. Sort (aria-sort). Pagination 20. Ponsel → kartu.
- Kosong: "Tidak ada SKU yang cocok dengan '…'" + Hapus filter. "Unduh" CSV hasil filter.

### 5. Detail SKU (`/produk/:skuId`)
- Breadcrumb Produk & Stok › Kemeja Denim › Hitam · L.
- Identitas + kode SKU tombol salin (toast "Kode disalin").
- Dua kotak: stok/kondisi/rata-rata; label + alasan (estimasi 1.480 vs median 610).
- Banner tindakan + "Lihat rekomendasi", "Lihat klasifikasi".
- Riwayat: grafik + pemilih rentang, tabel per bulan, rincian kartu stok per bulan (hanya hari bertransaksi).
- Chip SKU lain dalam jenis yang sama.

### 6. Klasifikasi Pergerakan (`/klasifikasi`)
- Panel kesiapan: periode, SKU dianalisis, "126 dari 126 dikenali model", klasifikasi terakhir.
- "Jalankan ulang klasifikasi": modal konfirmasi → progres ±5 detik 4 tahap (meringkas kartu stok → estimasi total keluar (RFR) → membandingkan dengan median → memperbarui rekomendasi). Bisa pindah halaman; indikator "Klasifikasi berjalan…" di topbar. Selesai → toast, riwayat +1 baris waktu sekarang, badge "3 SKU berubah label".
- Kartu "Bagaimana label ditentukan?" 3 langkah + banner "Ini bukan prediksi penjualan bulan depan".
- Kartu "Seberapa tepat modelnya?": 25 dari 26, matriks 2×2, catatan data uji kecil; tooltip "?" akurasi, recall, validasi silang.
- Tabel hasil: SKU, Jenis ukuran, Estimasi total keluar, Batas median, Label, Stok sekarang + cari/filter/sort/CSV.
- Grafik pengaruh fitur horizontal.
- Riwayat klasifikasi: klik → drawer perbandingan SKU yang berubah label.

### 7. Rekomendasi Persediaan (`/rekomendasi`)
- 4 kartu tindakan sebagai filter toggle.
- Matriks label × kondisi stok, jumlah per sel, klik → filter.
- Tabel: SKU, Label, Stok, Rata-rata stok, Kondisi stok, Rata-rata keluar/bln*, Cukup untuk*, Tindakan. Baris bisa dibentangkan (alasan). Urut dari paling mendesak.
- Checkbox + "Tandai sudah ditinjau" → redup + chip "Ditinjau"; toggle "Sembunyikan yang sudah ditinjau"; undo via toast "Batalkan".
- "Unduh daftar" CSV. Bagian "Belum ada rekomendasi" untuk SKU tanpa label.
- Catatan kaki: *data historis, bukan prediksi* · "Rekomendasi adalah bahan pertimbangan, bukan pesanan pembelian otomatis."

### 8. Laporan (`/laporan`)
- Tab (sinkron URL): Pergerakan stok · Barang masuk · Barang keluar · Riwayat klasifikasi · Riwayat rekomendasi.
- Filter dari–sampai bulan (validasi), produk, SKU, pengelompokan; Terapkan / Atur ulang.
- Ringkasan stok awal, masuk, keluar, stok akhir; tabel per jenis + baris total + kolom Fast/Slow. Dihitung dari mock sesuai filter.
- "Unduh Excel" → CSV; "Unduh PDF" → `window.print()` dengan stylesheet cetak.
- Format: "3 Jun 2026", "Des 2025–Mei 2026", "unit", label + tanggal klasifikasinya.

### 404
"Halaman tidak ditemukan" + tombol kembali ke Dashboard.

## 9. "Statis tapi terasa hidup": aturan wajib
1. Tidak ada tombol mati (navigasi / state / simulasi / unduhan / modal-drawer / toast).
2. Fitur di luar prototipe ("Lupa kata sandi", "Tambah akun") → modal penjelasan, bukan disabled.
3. Tombol nonaktif harus memberi alasan (tooltip/teks bantu).
4. `useSimulatedProcess({ steps, durationMs, failRate })` → `status, progress, currentStep, start, cancel, retry`.
5. Mode Demo: tombol melayang kanan bawah "Mode demo"; kondisi data Normal / Belum ada data / SKU baru belum diklasifikasikan / Varian baru belum dikenali model / Data lebih baru dari hasil klasifikasi; paksa proses gagal; reset. Disembunyikan saat cetak.
6. Skeleton 300–500 ms saat pindah halaman.
7. Perubahan dari proses simulasi memengaruhi tampilan (topbar, riwayat).

## 10. Kondisi khusus

| Kondisi | Di mana | Isi |
|---|---|---|
| Belum ada data | Dashboard, Produk, Klasifikasi, Rekomendasi, Laporan | Empty state, CTA "Unggah kartu stok", 3 langkah memulai |
| Data belum cukup | Klasifikasi, Rekomendasi, Produk (chip "Belum ada label") | Banner kuning "3 SKU belum diklasifikasikan", tabel SKU + riwayat |
| Varian baru belum dikenali model | Klasifikasi, Detail SKU | Model perlu dilatih ulang tim pengembang; SKU lain tetap berjalan |
| Hasil belum terbaru | Rekomendasi, Dashboard | Banner "Data stok lebih baru dari hasil klasifikasi" + Jalankan klasifikasi |
| Proses berjalan | Upload, Klasifikasi | Progres, tahapan, Batalkan |
| Gagal | Upload, Klasifikasi | Banner merah, "Tidak ada data yang berubah", Coba lagi, kode kejadian |
| Validasi gagal | Upload | Tabel kolom wajib ada/tidak ditemukan; Pilih file lain + Unduh template |
| Berhasil | Upload, Klasifikasi, Rekomendasi | Banner/toast hijau + langkah berikutnya |
| Pencarian tanpa hasil | Semua tabel | Pesan + Hapus filter |
| Login gagal / logout | Login | Banner merah / hijau |

## 11. Aksesibilitas
- Elemen semantik; `<label>` terhubung; `<table>` dengan `<th scope>`.
- Fokus: ring 2 px denim dengan offset.
- Modal/drawer/bottom sheet: focus trap, Esc, kembalikan fokus, `aria-modal`.
- `aria-live="polite"` untuk toast & progres; `role="progressbar"` bernilai.
- Tombol ikon wajib `aria-label`. Grafik `role="img"` + `aria-label` + alternatif tabel.
- Hormati `prefers-reduced-motion`.

## 12. Bahasa
Bahasa Indonesia jelas untuk pemilik UMKM, hindari jargon; istilah teknis diberi tooltip.
Contoh: "Stok sekarang cukup ±0,5 bulan bila penjualan seperti biasa", "Label ini bukan prediksi penjualan bulan depan".

## 13. Tahapan kerja
Di akhir setiap fase: `npm run build` dan `npm run lint` bersih, ringkas yang selesai dan yang perlu dicek.
1. Fase 1 — Fondasi: setup, tokens, komponen `ui/`, AppShell responsif, router, Auth, Login.
2. Fase 2 — Data: mock data berseed, `rules.ts`, `format.ts`, DataContext, unit test Vitest `rules.ts` (7 SKU contoh).
3. Fase 3 — Halaman inti: Dashboard, Produk & Stok, Detail SKU.
4. Fase 4 — Proses: Upload & Klasifikasi, `useSimulatedProcess`.
5. Fase 5 — Rekomendasi, Laporan, ekspor CSV, stylesheet cetak.
6. Fase 6 — Mode Demo, kondisi khusus, skeleton, aksesibilitas, uji 360/768/1024/1440, 404.

## 14. Definisi selesai
- [ ] `npm run dev`, `npm run build`, `npm run lint` bersih.
- [ ] 8 halaman + 404; alur login → dashboard → upload → klasifikasi → rekomendasi jalan.
- [ ] Angka konsisten: 126 SKU, 61/65, 9/52/51/14, 2.430 unit.
- [ ] Tidak ada prediksi bulan depan, safety stock, atau jumlah unit restock.
- [ ] Tidak ada tombol tanpa respons; tombol nonaktif punya alasan terlihat.
- [ ] Status teks + ikon; kontras ≥ 4,5:1.
- [ ] Rapi di 360 px; tabel jadi kartu di ponsel.
- [ ] Mode Demo menampilkan setiap kondisi di bagian 10.
- [ ] CSV dan cetak PDF rapi.
