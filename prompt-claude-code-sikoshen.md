# Prompt Claude Code — Front-end Prototipe "Sikoshen Store"

> Salin seluruh isi file ini ke Claude Code (atau simpan sebagai `CLAUDE.md` di root proyek kosong), lalu minta: **"Bangun aplikasi sesuai CLAUDE.md, mulai dari Fase 1."**

---

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
- Tata letak menyesuaikan konteks, tidak sekadar mengecil:
  - Desktop memakai sidebar.
  - Tablet memakai sidebar ringkas yang hanya berisi ikon dengan tooltip.
  - Ponsel memakai bar navigasi bawah.
- Tabel berubah menjadi daftar kartu di ponsel.
- Filter di ponsel dibuka sebagai *bottom sheet*.
- Konten mengikuti kondisi data: kosong, data belum cukup, proses berjalan, gagal, berhasil.

### Interaktif
- Setiap aksi punya umpan balik:
  - hover/focus/active state
  - skeleton saat memuat
  - toast setelah aksi
  - konfirmasi sebelum aksi berisiko
  - progres untuk proses panjang
- Tooltip pada grafik dan istilah teknis, misalnya ikon "?" di sebelah "Median".

### Responsif
- Breakpoint Tailwind:
  - `<640` ponsel
  - `640–1023` tablet
  - `≥1024` desktop
  - `≥1440` konten dibatasi `max-w-[1200px]`
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

### Turunan (boleh ditambah, harus tetap senada)

| Token | Hex | Penggunaan |
|---|---|---|
| `denim-700` | `#1F4669` | Hover/pressed tombol utama |
| `denim-50` | `#E8EFF6` | Latar chip Fast-Moving, latar item navigasi aktif di ponsel |
| `denim-200` | `#B9CCE0` | Border chip Fast, batang "Barang masuk" di grafik |
| `muted` | `#5F6470` | Teks sekunder dan keterangan (kontras 5,5:1 di atas `surface`) |
| `border` | `#E4E6EA` | Garis tepi kartu, input, dan pemisah |
| `border-strong` | `#C9CDD4` | Border input dan tombol sekunder |

### Warna status

Selalu tampil bersama ikon dan teks. Jangan hanya warna.

| Status | Teks | Latar | Border | Ikon |
|---|---|---|---|---|
| Habis / Prioritaskan restock / Error | `#B42318` | `#FEF3F2` | `#FECDCA` | `XCircle` / `AlertTriangle` |
| Di bawah rata-rata / Peringatan | `#B54708` | `#FFFAEB` | `#FEDF89` | `AlertTriangle` |
| Normal / Pantau / Berhasil | `#067647` | `#ECFDF3` | `#ABEFC6` | `CheckCircle2` |
| Menumpuk / Evaluasi stok | `#5925DC` | `#F4F3FF` | `#D9D6FE` | `Layers` |
| Tahan pembelian / Netral | `#475467` | `#F2F4F7` | `#D0D5DD` | `PauseCircle` |
| Slow-Moving | `#8A3B0C` | `#FDF1E7` | `#F2C49E` | `TrendingDown` |
| Fast-Moving | `#2A5C8D` | `#E8EFF6` | `#B9CCE0` | `TrendingUp` |

Semua pasangan teks/latar di atas sudah memenuhi kontras ≥ 4,5:1. Jangan menurunkannya.

### Tipografi, ruang, dan bentuk

- **Tipografi:**
  - Judul halaman 28/36 bold.
  - Judul bagian 18/26 bold.
  - Isi 14–15/22.
  - Keterangan 12–13/18.
  - Angka besar KPI 28–32 bold dengan `tabular-nums`.
- **Spasi:** kelipatan 4 px. Padding kartu 24 px di desktop dan 16 px di ponsel. Jarak antar-bagian 24 px.
- **Radius:**
  - input/tombol 10 px
  - kartu 14 px
  - modal 16 px
  - chip `rounded-full`
- **Bayangan:** kartu `0 1px 2px rgba(46,46,46,.04)`, modal/popover `0 12px 32px rgba(46,46,46,.12)`.
- **Grafik:**
  - Barang keluar memakai `denim`, barang masuk memakai `denim-200`. Grid `border`, sumbu `muted`.
  - Jangan pakai dua sumbu Y.
  - Selalu ada legenda bila lebih dari satu seri, dan tooltip saat hover.

## 6. Struktur proyek

```
src/
  main.tsx, App.tsx, router.tsx
  styles/tokens.css, index.css
  data/            # semua mock data + generator berseed
    products.ts, skus.ts, movements.ts, classification.ts, uploads.ts, model.ts
  context/         # AuthContext, DataContext (store + reducer), ToastContext, DemoContext
  hooks/           # useMediaQuery, useSimulatedProcess, useFilters, useCountUp
  lib/             # format.ts (angka, tanggal, periode), rules.ts (kondisi stok & tindakan), exportCsv.ts
  components/
    layout/        # AppShell, Sidebar, BottomNav, Topbar, PageHeader
    ui/            # Button, Card, Chip, StatusChip, LabelChip, Input, Select, SearchInput,
                   # Tabs, SegmentedControl, Table, ResponsiveTable (tabel↔kartu), Modal,
                   # BottomSheet, Toast, Tooltip, ProgressBar, Stepper, Skeleton, EmptyState, Banner
    charts/        # MovementBarChart, CompositionBar, FeatureImportance, ConfusionMatrix
  pages/
    Login, Dashboard, Upload, Products, SkuDetail, Classification, Recommendations, Reports, NotFound
```

Komponen harus kecil, bisa dipakai ulang, dan diberi tipe. Logika aturan bisnis diletakkan di `lib/rules.ts` dan tidak ditulis di dalam JSX.

## 7. Mock data

Gunakan generator dengan **seed tetap** (misalnya mulberry32), supaya angka selalu sama di setiap muat ulang.

### Ringkasan yang harus konsisten di semua halaman
- 3 jenis produk dan 126 SKU: Kemeja Denim 36, Tony Jack Biasa 52, Iron Head Ultimate 38.
- **Fast/Slow per jenis:** Kemeja Denim 17/19, Tony Jack Biasa 26/26, Iron Head Ultimate 18/20. Totalnya 61/65.
- **Median total keluar per jenis:** Kemeja Denim 610, Tony Jack Biasa 480, Iron Head Ultimate 300 unit.
- **Total stok per 31 Mei 2026:** 2.430 unit (Kemeja Denim 760, Tony Jack Biasa 1.100, Iron Head Ultimate 570).
- **Masuk/keluar bulanan semua SKU:**

  | Bulan | Masuk | Keluar |
  |---|---|---|
  | Des 2025 | 520 | 610 |
  | Jan 2026 | 480 | 540 |
  | Feb 2026 | 690 | 820 |
  | Mar 2026 | 560 | 650 |
  | Apr 2026 | 640 | 680 |
  | Mei 2026 | 610 | 702 |

  Buat juga data bulanan Mei 2023–Nov 2025 dengan pola musiman yang wajar, yaitu naik menjelang Lebaran.
- **Jumlah tindakan:** Prioritaskan restock 9, Pantau stok 52, Tahan pembelian 51, Evaluasi stok menumpuk 14.

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

Ringkasan per bulan:

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
- **Algoritma:** Random Forest Regressor, 150 pohon, kedalaman maksimum 5.
- **Pembagian data:** 100 SKU latih dan 26 SKU uji.
- **Hasil uji:** akurasi label 96,15% (25 dari 26 SKU tepat). Recall Fast 1,00, recall Slow 0,92. Validasi silang berulang 90,79% ± 5,79%.
- **Confusion matrix:**

  | | Model: Slow | Model: Fast |
  |---|---|---|
  | Sebenarnya Slow | 12 | 1 |
  | Sebenarnya Fast | 0 | 13 |

- **Pengaruh fitur (perkiraan):**

  | Fitur | Nilai |
  |---|---|
  | Total barang masuk | 0,27 |
  | Naik-turun stok | 0,19 |
  | Stok tertinggi | 0,18 |
  | Rata-rata stok | 0,17 |
  | Varian warna | 0,13 |
  | Jenis produk | 0,05 |
  | Jenis ukuran | 0,01 |
  | Stok terendah | 0,01 |

- **MAE:** tampilkan sebagai teks `[isi dari notebook]`.

### Riwayat unggahan
1. "3 file kartu stok (Denim, TJ Biasa, Iron Head)", 3 Jun 2026 14.05, status Berhasil: 93.977 baris, 126 SKU, 702 dibuang.
2. "STOK TJ BIASA-50.pdf", 3 Jun 2026 13.52, status Ditolak: format .pdf tidak didukung.

### Riwayat klasifikasi
1. 3 Jun 2026 14.20, data Mei 2023–Mei 2026: 61 Fast / 65 Slow, 3 SKU berubah label.
2. 2 Mei 2026 10.30, data Mei 2023–Apr 2026: 60 Fast / 66 Slow.

### Aturan bisnis (`lib/rules.ts`)

**Kondisi stok:**
- Habis = stok 0.
- Di bawah rata-rata = stok lebih kecil dari rata-rata stok historis SKU itu.
- Menumpuk = stok ≥ 1,5 × rata-rata stok historis.
- Selain itu Normal.

**Tindakan:**
- Fast + (Habis atau Di bawah rata-rata) → **Prioritaskan restock**
- Fast + (Normal atau Menumpuk) → **Pantau stok**
- Slow + Menumpuk → **Evaluasi stok menumpuk**
- Slow + selain itu → **Tahan pembelian**

**Lain-lain:**
- **Cukup untuk** = stok ÷ rata-rata keluar per bulan (12 bulan terakhir). Tampilkan dengan satu desimal, misalnya "0,5 bulan". Selalu beri keterangan "data historis, bukan prediksi".
- **SKU belum diklasifikasikan:** riwayat kurang dari 3 bulan, atau varian/jenis produk belum dikenal model.

## 8. Halaman, komponen, dan interaksi

### Navigasi global (AppShell)
- **Menu:** Dashboard · Upload Kartu Stok · Produk & Stok · Klasifikasi Pergerakan · Rekomendasi Persediaan · Laporan.
- **Desktop:** sidebar charcoal dengan logo teks "Sikoshen Store" dan subjudul "Manajemen persediaan pakaian pria".
  - Item aktif berlatar putih dengan teks charcoal, ditambah `aria-current="page"`.
  - Di bawah sidebar ada nama Owner dan tombol **Keluar**.
- **Tablet:** sidebar hanya berisi ikon dengan tooltip, dan bisa dibentangkan.
- **Ponsel:** bar navigasi bawah dengan 5 item: Beranda, Stok, Klasifikasi, Saran, Lainnya. "Lainnya" membuka bottom sheet berisi Upload, Laporan, dan Keluar.
- **Topbar:** di semua halaman ada bilah status data, berisi periode data, tanggal unggah terakhir, tanggal klasifikasi, dan tautan "Unggah kartu stok baru".
- Klik **Keluar** membuka modal konfirmasi. Setelah dikonfirmasi, pengguna diarahkan ke /login dengan banner hijau "Anda sudah keluar dengan aman."
- Route yang dilindungi akan mengarahkan ke /login bila belum masuk.

### 1. Login (`/login`)
- **Tata letak:** dua kolom. Kiri panel charcoal berisi 3 manfaat. Kanan form putih. Di ponsel, panel kiri menjadi header ringkas.
- **Form:** email, kata sandi dengan tombol "Tampilkan", dan tombol **Masuk**.
- **Kredensial demo:** `owner@sikoshen.id` / `sikoshen123`. Tampilkan sebagai petunjuk kecil di bawah form.
- **Saat masuk:** tombol berubah menjadi "Memeriksa…" dengan spinner selama 800 ms.
  - Bila salah: banner merah "Email atau kata sandi salah", field sandi dikosongkan dan diberi fokus.
  - Setelah 5 kali gagal: tampil hitung mundur kunci 5 menit. Untuk keperluan demo, cukup 30 detik.
- **Bila berhasil:** arahkan ke /dashboard dan tampilkan toast "Selamat datang kembali".

### 2. Dashboard (`/dashboard`)
- **Pemilih periode:** dropdown bulan. Mengubahnya akan memperbarui angka KPI masuk/keluar dan menyorot bulan di grafik.
- **Kartu KPI:** 5 kartu (Jenis produk, Jumlah SKU, Total stok, Barang masuk, Barang keluar), masing-masing bisa diklik.
  - Angka muncul dengan animasi hitung naik.
  - Ada indikator perubahan dibanding bulan lalu, misalnya "−4,7% vs Apr".
  - KPI masuk/keluar diklik → halaman Laporan dengan filter terisi.
- **Grafik:**
  - Batang masuk/keluar untuk 6 bulan terakhir, dengan toggle 6 bulan / 12 bulan / semua.
  - Tersedia tombol "Lihat sebagai tabel".
- **Kartu komposisi Fast/Slow:** bar proporsi, rincian per jenis produk, dan tautan ke Klasifikasi.
- **Empat kartu tindakan:** klik → halaman Rekomendasi dengan filter tindakan terpasang.
- **Tabel "Perlu segera diperhatikan":** berisi SKU dengan tindakan Prioritaskan restock dan Evaluasi stok menumpuk. Klik baris → Detail SKU.

### 3. Upload Kartu Stok (`/upload`)
- **Stepper 5 langkah:** Pilih file → Periksa → Hasil pemeriksaan → Konfirmasi → Selesai. Stepper selalu terlihat.
- **Langkah 1:**
  - Area seret-lepas, dengan state aktif saat file diseret di atasnya, ditambah tombol "Pilih file".
  - Menerima 1–3 file `.xlsx`/`.csv`.
  - File `.pdf` atau berkas lain langsung ditolak dengan banner merah dan contoh format.
  - Panel samping berisi petunjuk format:
    - **A.** Kartu stok asli toko (format melebar per produk).
    - **B.** Format baris dengan 7 kolom: Tanggal, Jenis_Produk, Varian Warna, Ukuran, Barang_Masuk, Barang_Keluar, Stok_Akhir.
  - Tombol "Unduh template" menghasilkan file CSV contoh yang benar-benar terunduh.
  - Untuk demo, sediakan tombol "Gunakan contoh 3 file toko" yang mengisi 3 file tiruan: `STOK KMJ DENIM-40.xlsx`, `STOK TJ BIASA-50.xlsx`, dan `iron head ultimate.xlsx`.
- **Langkah 2:** progres simulasi sekitar 4 detik dengan teks berganti dan checklist yang tercentang satu per satu:
  - format dikenali
  - dikonversi ke format baris
  - memeriksa tanggal
  - memeriksa stok negatif
  - mendeteksi jenis ukuran

  Tersedia tombol **Batalkan** yang kembali ke langkah 1 dengan toast.
- **Langkah 3:**
  - Kartu ringkasan: 94.679 baris setelah konversi · 93.977 siap · 702 dibuang · 1.642 diperbaiki otomatis.
  - Rincian dibagi 4 grup, masing-masing bisa dibuka-tutup (accordion):
    - **Dibuang:** tanggal tidak valid, contoh "12/9/923".
    - **Diperbaiki otomatis, perlu dicek ke toko:** stok negatif menjadi 0. Kemeja Denim 964, Tony Jack Biasa 550, Iron Head Ultimate 128.
    - **Diabaikan:** 21 Stok_Akhir kosong.
    - **Normal:** sel Masuk/Keluar kosong dibaca sebagai 0.
  - Tabel contoh baris bermasalah dengan pagination.
  - Tombol "Unduh daftar lengkap" menghasilkan CSV.
  - Pratinjau hasil konversi.
- **Langkah 4:** bilah konfirmasi yang menempel di bawah layar: "Simpan 93.977 baris?" dengan tombol **Simpan** dan **Batalkan & perbaiki file**.
- **Langkah 5:** banner berhasil dan ringkasan, dengan tombol utama **Jalankan klasifikasi** yang mengarah ke /klasifikasi dan langsung memulai proses.
- **Mode demo di langkah 2:**
  - Ada opsi untuk mensimulasikan *Unggah gagal* (koneksi terputus, "Tidak ada data yang berubah", tombol Coba lagi).
  - Ada opsi untuk mensimulasikan *Periode duplikat*. Modal menampilkan perbandingan data tersimpan vs file baru untuk 25–31 Mei 2026, sebuah checkbox persetujuan, dan pilihan: Ganti tanggal yang sama / Simpan Juni saja / Batalkan.
- **Riwayat unggahan:** tabel dengan filter status. Klik "Detail" membuka drawer berisi ringkasan hasil unggahan itu.

### 4. Produk & Stok (`/produk`)
- **Callout penjelas:** "Jenis produk ≠ SKU", disertai diagram chip kecil.
- **Pencarian dan filter yang benar-benar berfungsi:**
  - Pencarian teks dengan debounce 200 ms.
  - Filter jenis produk, varian, ukuran (dikelompokkan huruf/angka), kondisi stok, dan label.
  - Tab cepat dengan jumlah: Semua 126 · Fast 61 · Slow 65 · Habis · Menumpuk.
  - Chip filter aktif bisa dihapus satu per satu, ditambah "Hapus semua filter".
  - Filter disinkronkan ke query string URL.
- **Segmented control:** Per SKU / Per jenis produk.
  - Mode jenis produk menampilkan 3 baris ringkasan yang bisa dibentangkan.
  - Mode SKU menampilkan tabel yang dikelompokkan per jenis produk.
- **Tabel:**
  - Kolom: Produk, Varian, Ukuran, Stok terakhir, Total masuk, Total keluar, Kondisi stok, Label.
  - Kolom bisa diurutkan dengan klik header (ikon panah, `aria-sort`).
  - Pagination 20 baris.
  - Di ponsel tabel berubah menjadi kartu.
- **Hasil kosong:** "Tidak ada SKU yang cocok dengan '…'" dan tombol Hapus filter.
- **Tombol "Unduh":** menghasilkan CSV dari hasil yang sedang difilter.

### 5. Detail SKU (`/produk/:skuId`)
- **Navigasi:** breadcrumb Produk & Stok › Kemeja Denim (jenis produk) › Hitam · L.
- **Identitas:** jenis produk, varian, ukuran, jenis ukuran, dan kode SKU dengan tombol salin (toast "Kode disalin").
- **Dua kotak ringkasan:**
  - Stok saat ini, kondisi stok, dan rata-rata stok.
  - Label pergerakan, disertai alasannya: estimasi 1.480 unit vs median 610 unit.
- **Banner tindakan:** kalimat alasan, tombol "Lihat rekomendasi", dan "Lihat klasifikasi".
- **Riwayat:** grafik masuk/keluar dengan pemilih rentang, tabel ringkasan per bulan, dan rincian kartu stok per bulan yang bisa dipilih. Hanya hari dengan transaksi yang ditampilkan.
- **SKU lain dalam jenis yang sama:** chip yang bisa diklik untuk berpindah SKU.

### 6. Klasifikasi Pergerakan (`/klasifikasi`)
- **Panel kesiapan:** periode data, jumlah SKU dianalisis, "126 dari 126 dikenali model", klasifikasi terakhir.
- **Tombol "Jalankan ulang klasifikasi":**
  1. Membuka modal konfirmasi.
  2. Lalu progres sekitar 5 detik dengan 4 tahap: meringkas kartu stok → estimasi total keluar (Random Forest Regressor) → membandingkan dengan median → memperbarui rekomendasi.
  3. Selama proses, pengguna boleh berpindah halaman. Indikator kecil "Klasifikasi berjalan…" tetap tampil di topbar.
  4. Selesai → toast, riwayat bertambah satu baris baru dengan waktu saat ini, dan badge "3 SKU berubah label".
- **Kartu "Bagaimana label ditentukan?":** 3 langkah bernomor dan banner info "Ini bukan prediksi penjualan bulan depan".
- **Kartu "Seberapa tepat modelnya?":**
  - Isi: 25 dari 26 SKU tepat, matriks tepat/salah 2×2, dan catatan bahwa data uji kecil.
  - Ikon "?" di samping istilah *akurasi*, *recall*, dan *validasi silang* membuka tooltip berbahasa sederhana.
- **Tabel hasil per SKU:**
  - Kolom: SKU, Jenis ukuran, Estimasi total keluar, Batas median, Label, Stok sekarang.
  - Dilengkapi pencarian, filter, sorting, dan unduh CSV.
- **Grafik pengaruh fitur:** batang horizontal dengan nama fitur dalam bahasa awam.
- **Riwayat klasifikasi:** klik baris membuka drawer perbandingan dengan klasifikasi sebelumnya, yaitu daftar SKU yang berubah label.

### 7. Rekomendasi Persediaan (`/rekomendasi`)
- **Kartu ringkasan:** 4 kartu tindakan yang juga berfungsi sebagai filter (toggle).
- **Matriks penjelasan:** label (Fast/Slow) × kondisi stok, dengan jumlah SKU di tiap sel. Klik sel → tabel difilter.
- **Tabel:**
  - Kolom: SKU, Label, Stok, Rata-rata stok, Kondisi stok, Rata-rata keluar/bln*, Cukup untuk*, Tindakan.
  - Setiap baris bisa dibentangkan untuk menampilkan alasan dalam kalimat biasa.
  - Diurutkan dari tindakan paling mendesak.
- **Checkbox per baris dan "Tandai sudah ditinjau":**
  - Baris yang ditandai menjadi redup dan diberi chip "Ditinjau".
  - Tersedia toggle "Sembunyikan yang sudah ditinjau".
  - Status ini disimpan di state lokal dan bisa dibatalkan lewat toast "Batalkan".
- **Tombol "Unduh daftar":** menghasilkan CSV.
- **Bagian "Belum ada rekomendasi":** untuk SKU tanpa label.
- **Catatan kaki:** *data historis, bukan prediksi* · "Rekomendasi adalah bahan pertimbangan, bukan pesanan pembelian otomatis."

### 8. Laporan (`/laporan`)
- **Tab:** Pergerakan stok · Barang masuk · Barang keluar · Riwayat klasifikasi · Riwayat rekomendasi. Tab disinkronkan ke URL.
- **Filter:** dari bulan – sampai bulan (validasi: "sampai" tidak boleh lebih awal dari "dari"), produk, SKU, dan pengelompokan. Ada tombol **Terapkan** dan **Atur ulang**.
- **Isi:**
  - Kartu ringkasan: stok awal, masuk, keluar, stok akhir.
  - Tabel per jenis produk dengan baris total dan kolom Fast/Slow.
  - Semua angka dihitung dari mock data sesuai filter.
- **Unduh:**
  - "Unduh Excel" menghasilkan CSV.
  - "Unduh PDF" memanggil `window.print()` dengan stylesheet cetak yang rapi: sidebar disembunyikan, ada judul laporan dan periode.
- **Konsistensi format:**
  - tanggal "3 Jun 2026"
  - periode "Des 2025–Mei 2026"
  - satuan "unit"
  - label selalu disertai tanggal klasifikasinya

### 404
Halaman "Halaman tidak ditemukan" dengan tombol kembali ke Dashboard.

## 9. "Statis tapi terasa hidup": aturan wajib

1. **Tidak ada tombol mati.** Setiap kontrol menjalankan salah satu dari:
   - navigasi
   - perubahan state lokal
   - proses simulasi dengan progres
   - unduhan file sungguhan dari mock data (CSV/print)
   - modal atau drawer
   - toast informatif
2. **Fitur yang memang di luar prototipe** (misalnya "Lupa kata sandi", "Tambah akun") tetap bisa diklik. Tampilkan modal penjelasan singkat, misalnya "Hubungi pengelola sistem toko untuk mengatur ulang kata sandi". Jangan sekadar diberi `disabled`.
3. **Tombol yang memang harus nonaktif** harus memberi alasan, lewat tooltip atau teks bantu. Contoh: "Jalankan klasifikasi (belum tersedia — riwayat baru 2 dari minimal 3 bulan)".
4. **Proses simulasi** memakai satu hook `useSimulatedProcess({ steps, durationMs, failRate })`. Hook ini mengembalikan `status`, `progress`, `currentStep`, `start`, `cancel`, `retry`. Prosesnya bisa dibatalkan dan bisa dibuat gagal lewat Mode Demo.
5. **Mode Demo** berupa tombol kecil melayang di kanan bawah, berlabel "Mode demo", yang membuka panel untuk:
   - Mengganti kondisi data: *Normal* / *Belum ada data* / *SKU baru belum diklasifikasikan* / *Varian baru belum dikenali model* / *Data lebih baru dari hasil klasifikasi*.
   - Memaksa proses berikutnya gagal.
   - Mengatur ulang semua data demo.

   Semua halaman harus menampilkan kondisi khusus yang sesuai dengan pilihan ini (lihat bagian 10). Panel ini disembunyikan saat dicetak.
6. **Loading:** saat berpindah halaman, tampilkan skeleton selama 300–500 ms agar terasa memuat data. Jangan dibuat berlebihan.
7. **Perubahan data dari proses simulasi** harus benar-benar memengaruhi tampilan. Contoh: setelah upload simulasi berhasil, tanggal "Terakhir diunggah" di topbar ikut berubah. Setelah klasifikasi, riwayat bertambah.

## 10. Kondisi khusus yang harus dirancang

| Kondisi | Di mana | Isi |
|---|---|---|
| Belum ada data | Dashboard, Produk, Klasifikasi, Rekomendasi, Laporan | Empty state, CTA "Unggah kartu stok", 3 langkah memulai |
| Data belum cukup | Klasifikasi, Rekomendasi, Produk (chip "Belum ada label") | Banner kuning "3 SKU belum diklasifikasikan", tabel SKU dengan riwayatnya |
| Varian baru belum dikenali model | Klasifikasi, Detail SKU | Penjelasan bahwa model perlu dilatih ulang oleh tim pengembang; SKU lain tetap berjalan |
| Hasil belum terbaru | Rekomendasi, Dashboard | Banner "Data stok lebih baru dari hasil klasifikasi" + tombol Jalankan klasifikasi |
| Proses berjalan | Upload, Klasifikasi | Progres, tahapan, tombol Batalkan |
| Gagal | Upload, Klasifikasi | Banner merah, "Tidak ada data yang berubah", Coba lagi, kode kejadian |
| Validasi gagal | Upload | Tabel kolom wajib: ada / tidak ditemukan; tombol Pilih file lain + Unduh template |
| Berhasil | Upload, Klasifikasi, Rekomendasi (tandai ditinjau) | Banner/toast hijau + langkah berikutnya |
| Pencarian tanpa hasil | Semua tabel | Pesan + Hapus filter |
| Login gagal / logout | Login | Banner merah / hijau |

## 11. Aksesibilitas

- Gunakan elemen semantik: `<button>`, `<a>`, `<label>` yang terhubung ke input, `<table>` dengan `<th scope>`.
- Fokus terlihat jelas: ring 2 px warna `denim` dengan offset.
- Semua modal, drawer, dan bottom sheet:
  - menjebak fokus di dalamnya
  - bisa ditutup dengan Esc
  - mengembalikan fokus ke pemicunya
  - memakai `aria-modal`
- Gunakan `aria-live="polite"` untuk toast dan progres. `role="progressbar"` diberi nilai.
- Tombol yang hanya berisi ikon wajib diberi `aria-label`. Grafik diberi `role="img"` + `aria-label` dan alternatif tabel.
- Hormati `prefers-reduced-motion`: matikan animasi hitung naik dan transisi.

## 12. Bahasa

Gunakan bahasa Indonesia yang jelas untuk pemilik UMKM. Hindari jargon. Bila istilah teknis terpaksa dipakai (median, akurasi, recall, Random Forest Regressor), sertakan penjelasan singkat di tooltip.

Contoh nada penulisan:
- "Stok sekarang cukup ±0,5 bulan bila penjualan seperti biasa"
- "Label ini bukan prediksi penjualan bulan depan"

## 13. Tahapan kerja

Kerjakan bertahap. Di akhir setiap fase:
- Jalankan `npm run build` dan `npm run lint`, lalu perbaiki semua error.
- Ringkas apa yang selesai, dan apa yang perlu saya cek.

1. **Fase 1 — Fondasi:**
   - setup Vite, React, TypeScript, Tailwind, dan font
   - tokens
   - komponen `ui/`
   - AppShell responsif (sidebar / sidebar ikon / bottom nav)
   - router, Auth, dan Login
2. **Fase 2 — Data:**
   - mock data dengan generator berseed
   - `rules.ts`
   - `format.ts`
   - DataContext
   - unit test sederhana untuk `rules.ts` dengan Vitest, termasuk 7 SKU contoh beserta tindakannya
3. **Fase 3 — Halaman inti:** Dashboard, Produk & Stok, Detail SKU.
4. **Fase 4 — Proses:** Upload (seluruh langkah dan state) dan Klasifikasi, termasuk `useSimulatedProcess`.
5. **Fase 5 — Halaman lain:** Rekomendasi, Laporan, ekspor CSV, dan stylesheet cetak.
6. **Fase 6 — Penyempurnaan:**
   - Mode Demo dan semua kondisi khusus
   - skeleton
   - aksesibilitas
   - uji tampilan di lebar 360, 768, 1024, dan 1440 px
   - halaman 404

## 14. Definisi selesai

- [ ] `npm run dev` berjalan tanpa error. `npm run build` dan `npm run lint` bersih.
- [ ] Semua 8 halaman dan 404 bisa diakses, dan alur login → dashboard → upload → klasifikasi → rekomendasi bisa dijalankan dari awal sampai akhir.
- [ ] Angka konsisten di semua halaman, termasuk 126 SKU, 61/65, 9/52/51/14, dan 2.430 unit.
- [ ] Tidak ada satu pun angka prediksi bulan depan, safety stock, atau jumlah unit restock.
- [ ] Tidak ada tombol tanpa respons. Setiap tombol nonaktif punya alasan yang terlihat.
- [ ] Semua status memakai teks + ikon, tidak hanya warna. Kontras teks ≥ 4,5:1.
- [ ] Tampilan rapi di 360 px tanpa scroll horizontal halaman. Tabel menjadi kartu di ponsel.
- [ ] Mode Demo bisa menampilkan setiap kondisi khusus di bagian 10.
- [ ] Unduhan CSV dan cetak PDF menghasilkan file atau tampilan yang rapi.
