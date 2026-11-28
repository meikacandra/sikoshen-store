# Catatan Revisi — branch `integrasi-model-website`

## Perbaikan (sebelumnya keliru)

| No | Masalah | Perbaikan |
|---|---|---|
| 1 | **Cek Kombinasi** memakai model akhir yang sudah dilatih dengan SKU tersebut, sehingga angkanya bias dan berbeda dari Peta Pola (mis. Iron Head ash gray 34: 0,73 vs 0,20) | SKU yang sudah dijual memakai peluang **out-of-fold** (sama dengan Peta Pola). Model akhir hanya untuk kombinasi yang belum pernah dijual. Saran juga menyesuaikan SKU yang menyimpang dari pola |
| 2 | `backend/sample_files/` berisi **Excel tiruan** (warna Hitam/Krem) yang tetap diterima saat diunggah | Diganti 3 kartu stok asli. Data tiruan dipindah ke `backend/test_fixtures/` khusus tes |
| 3 | Login menerima nama pengguna `admin`, `owner`, `sikoshen`; kata sandi tertulis di `render.yaml` | Hanya satu akun pemilik; `render.yaml` meminta sandi diisi di dashboard; server memberi peringatan bila website online masih memakai sandi bawaan |
| 4 | Akurasi ditampilkan 93,7% (out-of-fold, terlalu optimis), berbeda dengan laporan | Ditampilkan **88,0% ± 7,0** (nested cross-validation, sesuai laporan); 93,7% diberi keterangan |

## Tambahan

* **Halaman Klasifikasi**: aturan label (median per produk), hasil Fast/Slow per SKU dari riwayat aktif,
  akurasi penelitian, confusion matrix (378 tebakan), perbandingan 10 model, permutation importance, keterbatasan.
  Backend: `GET /api/klasifikasi`, angka penelitian di `backend/research_metrics.py`.
* **Tampilan ponsel**: menu ☰ berupa laci, tidak ada lagi halaman yang melebar ke samping.
* **Data awal otomatis** dari `sample_files/`: grafik Penjualan per Bulan dan evaluasi langsung terisi tanpa unggah dulu.
  Database lama otomatis dilengkapi saat server dinyalakan.

## Dirapikan

* File sisa versi MySQL dihapus: `mysql_app.py`, `seed_and_ml.py`, `db.py`, `schema.sql`, `test_api.py`,
  `requirements-mysql.txt`, skrip `npm run seed:db / dev:mysql / dev:backend:mysql`, dan tes MySQL.
* Tes 3 kartu stok asli tidak lagi bergantung pada `C:\Users\ASUS\Downloads` (memakai `sample_files/`).
* Plugin Vite yang menyalakan backend otomatis tidak lagi berjalan saat `npm test`, dan dilewati bila venv belum ada.
* `backend/requirements-dev.txt` untuk menjalankan tes; README diperbarui (halaman, data awal, keterbatasan, tes).

## Hasil uji

* Backend: 17 tes lolos (termasuk 3 kartu stok asli = ekspor notebook, dan pengisian data awal).
* Frontend: 6 tes lolos, TypeScript dan ESLint bersih, build berhasil.
* Browser: 7 halaman di desktop (1366 px) dan ponsel (390 px) tanpa galat dan tanpa scroll ke samping;
  unggah 3 kartu stok asli lewat halaman berhasil; angka tetap 62 Fast / 64 Slow, prediksi Juni 2026 = 1.829 unit.
