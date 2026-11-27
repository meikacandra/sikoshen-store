# Website persediaan Sikoshen Store

Dashboard memakai model Random Forest dari `notebooks/01-website.ipynb`. Kartu stok terakhir saat pelatihan berakhir pada 30 Mei 2026. Saat pertama dibuka, dashboard menampilkan hasil notebook untuk Juni 2026. Setelah impor riwayat lengkap, periode prediksi mengikuti bulan setelah tanggal terakhir di berkas.

## Menjalankan di Windows

Dari folder proyek atau hasil ekstraksi ZIP, gunakan Python 3.13 dan PowerShell. Lakukan persiapan ini sekali untuk lingkungan baru.

```powershell
py -3.13 -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

ZIP sudah memuat antarmuka hasil build. Jalankan server dengan perintah berikut.

```powershell
.\backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Pada checkout Git dengan sumber React, perintah `npm ci` lalu `npm start` membangun antarmuka dan menjalankan server yang sama. Untuk pengembangan, jalankan `npm run dev:backend` dan `npm run dev` di dua terminal.

Buka [website lokal](http://127.0.0.1:8000). Akun lokal bawaan menggunakan email `owner@sikoshen.id` dan kata sandi `sikoshen123`.

## Memperbarui rencana pembelian (Unggah Data)

1. Buka menu **Unggah Data**. Pilih satu CSV gabungan atau pilih seluruh kartu stok Excel (`.xlsx`) yang ingin dihitung dalam satu impor. Format lebar ketiga produk asli dan format tabel harian didukung.
2. Untuk tabel harian, gunakan satu baris per produk, varian, ukuran, dan tanggal dengan kolom: `Jenis_Produk`, `Varian` (atau `Varian Warna`), `Ukuran`, `Tanggal` (atau `Tanggal_dt`), `Barang_Masuk`, `Barang_Keluar`, dan `Stok_Akhir`.
3. Setelah berkas dipilih, sistem otomatis menampilkan **Pratinjau Perbandingan Impor** (periode data, bulan prediksi, jumlah SKU per produk, serta produk/SKU yang akan hilang). Selama pratinjau, **Beranda** dan **Saran Pemesanan** tetap memakai hasil aktif.
4. Klik **Terapkan Impor** untuk mengganti hasil aktif (jika ada pengurangan cakupan produk/SKU, tambahkan berkas yang kurang atau centang konfirmasi tambahan) atau klik **Batal** untuk mempertahankan hasil aktif. Jika perlu kembali, gunakan tombol **Pulihkan Hasil Sebelumnya**. Database lokal `backend/website.sqlite3` menyimpan hasil aktif, metadata validasi, dan cadangan pemulihan.
5. Di **Saran Pemesanan** dan **Cek Kombinasi**, label Fast-Moving dihitung dengan aturan median total penjualan per produk, peluang Fast dihitung oleh `ModelSikoshen.peluang_fast()`, dan prediksi penjualan + stok pengaman dihitung oleh `ModelSikoshen.prediksi()`. Tanda `—` berarti riwayat SKU belum cukup.

## Model dan penyimpanan

`backend/main.py` dan `backend/sikoshen.py` membaca kartu stok dan menyimpan hasil model ke SQLite (`backend/website.sqlite3`). Website utama hanya menggunakan **satu file model aktif**:

- **Website utama (FastAPI/SQLite):** `backend/models/rf_sikoshen.pkl` (dipasangkan dengan `backend/models/prediksi_bulan_depan.csv` dan `backend/sikoshen_pipeline.py` dari eksekusi `notebooks/01-website.ipynb` yang sama).
- **Kalender Ramadan aktif:** mencakup tahun `2023–2027` (`2023–2026` ketetapan Sidang Isbat Kemenag RI; `2027` perkiraan hisab Kalender Hijriah Indonesia Kemenag RI / MABIMS: `2027-02-08` s.d. `2027-03-09`, menunggu Sidang Isbat).

### Langkah memperbarui model dari notebook

1. **Cadangkan artefak aktif terlebih dahulu** (agar mudah kembali jika model baru gagal dimuat):
   ```powershell
   Copy-Item backend\models\rf_sikoshen.pkl backend\models\rf_sikoshen.pkl.bak
   Copy-Item backend\models\prediksi_bulan_depan.csv backend\models\prediksi_bulan_depan.csv.bak
   Copy-Item backend\sikoshen_pipeline.py backend\sikoshen_pipeline.py.bak
   ```
2. **Jalankan notebook pelatihan** `notebooks/01-website.ipynb` dengan direktori kartu stok asli pada variabel lingkungan `SIKOSHEN_DIR`. Pastikan seluruh sel (sampai uji sambung sel 10) berhasil tanpa galat.
3. **Salin seluruh artefak dari eksekusi notebook yang sama** (`model_website/`):
   - `model_website/rf_sikoshen.pkl` → `backend/models/rf_sikoshen.pkl`
   - `model_website/prediksi_bulan_depan.csv` → `backend/models/prediksi_bulan_depan.csv`
   - `model_website/model_meta.json` → `backend/models/model_meta.json` (opsional, rujukan versi & metrik)
   - `model_website/sikoshen_pipeline.py` → `backend/sikoshen_pipeline.py`
4. **Samakan versi pustaka** di `backend/requirements.txt` dengan `versi_library` pada `model_meta.json` (terutama `scikit-learn`, `pandas`, `numpy`, dan `joblib`).
5. **Mulai ulang server backend**, lalu verifikasi pemuatan model lewat endpoint `/api/health`:
   ```powershell
   Invoke-RestMethod http://127.0.0.1:8000/api/health
   ```
   Pastikan `ok: True`, `model_loaded: True`, `model_error: null`, `model_version` cocok dengan `versi_model` di `model_meta.json`, dan `ramadan_max_year` sesuai kalender terbaru.
6. **Perbarui riwayat (jika memakai data kustom):** jika database sudah berisi unggahan pengguna sebelumnya, impor ulang kartu stok melalui menu **Unggah Data** agar prediksi dihitung dengan model baru.

### Kembali ke versi model sebelumnya (jika model baru gagal dimuat)

Jika `/api/health` melaporkan `ok: False`, `model_loaded: False`, atau `model_error` tidak kosong (atau server gagal memulai karena ketidakcocokan `prediksi_bulan_depan.csv`):

1. Hentikan server backend.
2. Kembalikan ketiga berkas cadangan:
   ```powershell
   Move-Item -Force backend\models\rf_sikoshen.pkl.bak backend\models\rf_sikoshen.pkl
   Move-Item -Force backend\models\prediksi_bulan_depan.csv.bak backend\models\prediksi_bulan_depan.csv
   Move-Item -Force backend\sikoshen_pipeline.py.bak backend\sikoshen_pipeline.py
   ```
3. Mulai ulang server backend dan pastikan `GET /api/health` kembali melaporkan `ok: True` dan `model_loaded: True`.

### Jalur MySQL lama (terpisah)

Implementasi MySQL dari branch sebelumnya tetap tersedia di checkout Git melalui `backend/mysql_app.py`, `backend/seed_and_ml.py`, `backend/requirements-mysql.txt`, `npm run seed:db`, `npm run dev:backend:mysql`, dan `npm run dev:mysql`.

- Jalur MySQL lama menggunakan file artefak terpisah: **`backend/models/rf_sikoshen_mysql.pkl`**, sehingga menjalankan `npm run seed:db` atau `backend/mysql_app.py` **tidak akan menimpa** `backend/models/rf_sikoshen.pkl` milik website utama.
- Jika instalasi MySQL lama sebelumnya memakai artefak `rf_sikoshen.pkl` versi MySQL, pindahkan file lama tersebut menjadi `backend/models/rf_sikoshen_mysql.pkl`, atau buat ulang artefak MySQL secara aman dengan menjalankan `npm run seed:db` (saat server MySQL aktif) tanpa memengaruhi model website SQLite.

## Deploy Online 24 Jam (Gratis via Docker)

Proyek sudah dilengkapi `Dockerfile`, `.dockerignore`, dan `render.yaml` agar frontend React (`dist/`) dan backend FastAPI (`backend/main.py` + `rf_sikoshen.pkl`) berjalan dalam **satu container Docker**.

### 1. Deploy ke Railway (Gratis Tanpa Kartu Kredit)
1. Buka [railway.com](https://railway.com) dan login dengan akun GitHub.
2. Klik **+ New Project → Deploy from GitHub repo** → pilih `sikoshen-store`.
3. Di tab **Settings → Source**, pastikan branch terhubung ke **`integrasi-model-website`**, dan di **Settings → Build** pastikan Builder adalah **`Dockerfile`**.
4. Di tab **Variables**, tambahkan `SIKOSHEN_COOKIE_SECURE=true` dan `PORT=8000` (serta opsional `SIKOSHEN_OWNER_PASSWORD=<sandi-anda>`).
5. Di tab **Settings → Networking → Public Networking**, klik **Generate Domain** dengan target port **`8000`**.
6. *(Opsional agar unggahan permanen)* Tambah **Volume** di `/data` dan set `SIKOSHEN_DB=/data/website.sqlite3`.

### 2. Alternatif: Render via GitHub + Docker
1. Buka [render.com](https://render.com) dan login dengan GitHub.
2. Klik **New + → Web Service** (atau **Blueprint** jika ingin otomatis membaca `render.yaml`).
3. Pilih repo GitHub `sikoshen-store` dan branch `integrasi-model-website`.
4. Setel **Language/Runtime: Docker**, **Instance Type: Free**, **Health Check Path: `/api/health`**.
5. Di tab **Environment Variables**, atur:
   - `SIKOSHEN_COOKIE_SECURE` = `true`
   - `SIKOSHEN_OWNER_EMAIL` = `owner@sikoshen.id` (opsional, bisa diganti)
   - `SIKOSHEN_OWNER_PASSWORD` = sandi pilihan Anda (disarankan ganti dari `sikoshen123`)
6. Klik **Deploy Web Service**. Setelah status **Live**, buka `https://<nama-service>.onrender.com/api/health` untuk memastikan `model_loaded: true`, lalu bagikan URL utama ke teman Anda.

*Catatan paket gratis Render:* akun baru dapat diminta verifikasi kartu, server *sleep* setelah ~15 menit tidak dipakai, dan filesystem reset saat restart.

