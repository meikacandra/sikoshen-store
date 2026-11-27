"""
sikoshen_pipeline.py
====================
Pipeline + pembungkus model untuk website Sikoshen Store.

Dipakai di DUA tempat supaya hasilnya identik:
  1. Notebook 01_Model_Website_Sikoshen.ipynb (saat melatih model)
  2. Backend website (FastAPI) saat memuat model dan memprediksi

Masukan (data harian dari kartu stok / tabel MySQL) harus berupa DataFrame dengan kolom:
    Jenis_Produk, Varian, Ukuran, Tanggal_dt (datetime), Barang_Masuk, Barang_Keluar, Stok_Akhir
Satu baris = satu SKU pada satu tanggal pencatatan. Ukuran ditulis sebagai teks ("28", "XL").

Model disimpan dalam SATU file (backend/models/rf_sikoshen.pkl), dibuka sekali saat server menyala:

    from pathlib import Path
    from sikoshen_pipeline import muat_model

    MODEL_PATH = Path(__file__).parent / "models" / "rf_sikoshen.pkl"
    model = muat_model(MODEL_PATH)                       # = joblib.load + pembungkus
    hasil = model.prediksi(df_harian)                    # DataFrame prediksi bulan depan per SKU
    p = model.peluang_fast("Tony Jack Biasa", "HITAM", "30")   # peluang Fast-Moving satu kombinasi

Isi dictionary di dalam rf_sikoshen.pkl (hanya tipe dasar + model scikit-learn, tanpa kelas buatan sendiri):
    clf_model, clf_feature_cols   -> Random Forest Classifier (ciri produk) dan urutan fiturnya
    reg_model, reg_feature_cols   -> Random Forest Regression bulanan dan urutan fiturnya
    ramadan_dates, z_layanan      -> tabel Ramadan dan faktor stok pengaman
    rmse_per_sku, threshold_median, sku_master, mae, meta   -> tambahan agar backend bisa menghitung stok pengaman
"""
import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

KUNCI_SKU = ['Jenis_Produk', 'Varian', 'Ukuran']
KOLOM_WAJIB = KUNCI_SKU + ['Tanggal_dt', 'Barang_Masuk', 'Barang_Keluar', 'Stok_Akhir']
URUT_HURUF = {'M': 1, 'L': 2, 'XL': 3, 'XXL': 4, 'XXXL': 5, 'XXXXL': 6}
FITUR_KALENDER = ['Porsi_Ramadan', 'Porsi_H14_Lebaran', 'Porsi_Pasca_Lebaran', 'Porsi_Ramadan_lalu']
FITUR_ANGKA = ['lag_1', 'lag_2', 'lag_3', 'rata_3', 'rata_6'] + FITUR_KALENDER + ['Ukuran_Urut']
MIN_CAKUPAN = 0.75       # bulan dengan < 75% hari tercatat tidak dipakai sebagai target
JEDA_MAKS_HARI = 7       # jeda antar-tanggal > 7 hari dianggap periode tidak dicatat
NAMA_BULAN_ID = (
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
)

# Awal Ramadan dan hari terakhir Ramadan (sehari sebelum Idul Fitri), versi Pemerintah RI (Kemenag / MABIMS).
# 2023-2026: ketetapan Sidang Isbat Pemerintah RI.
# 2027 (1448 H): perkiraan hisab Kalender Hijriah Indonesia Kemenag RI (MABIMS):
#   1 Ramadan 1448 H = Senin 8 Feb 2027, 1 Syawal 1448 H = Rabu 10 Mar 2027 (hari terakhir Ramadan = 9 Mar 2027).
#   Catatan: status masih perkiraan hisab sebelum Sidang Isbat Kemenag RI (KHGT Muhammadiyah: 1 Syawal 9 Mar 2027).
# WAJIB ditambah setiap tahun (lihat periksa_kalender di bawah).
RAMADAN_DEFAULT = {
    2023: ('2023-03-23', '2023-04-21'),
    2024: ('2024-03-12', '2024-04-09'),
    2025: ('2025-03-01', '2025-03-30'),
    2026: ('2026-02-19', '2026-03-20'),
    2027: ('2027-02-08', '2027-03-09'),
}


# ---------------------------------------------------------------- ukuran & kalender
def urut_ukuran(u):
    """M=1 ... XXXXL=6; celana 28=1 ... 38=11 (urutan ukuran bermakna)."""
    u = str(u).strip()
    return URUT_HURUF[u] if u in URUT_HURUF else int(float(u)) - 27


def porsi_hari(bulan, awal, akhir):
    """Jumlah hari dalam 'bulan' (pd.Period) yang jatuh di rentang [awal, akhir]."""
    s = max(bulan.start_time, pd.Timestamp(awal))
    e = min(bulan.end_time.normalize(), pd.Timestamp(akhir))
    return max(0, (e - s).days + 1)


def _rentang(ramadan):
    return list(ramadan.values()) if isinstance(ramadan, dict) else [tuple(r) for r in ramadan]


def format_bulan_id(bulan):
    """Format pd.Period bulanan menjadi teks Indonesia + YYYY-MM (mis. 'Januari 2027 (2027-01)')."""
    return f'{NAMA_BULAN_ID[bulan.month]} {bulan.year} ({bulan})'


def hitung_kalender(semua_bulan, ramadan):
    """Fitur kalender Ramadan/Lebaran per bulan. Kalender Islam diketahui jauh hari, jadi aman dipakai."""
    rentang = _rentang(ramadan)
    kal = pd.DataFrame({'Bulan': list(semua_bulan)})
    kal['Porsi_Ramadan'] = [sum(porsi_hari(b, a, z) for a, z in rentang) / b.days_in_month for b in semua_bulan]
    kal['Porsi_H14_Lebaran'] = [sum(porsi_hari(b, pd.Timestamp(z) - pd.Timedelta(days=13), z) for a, z in rentang) / 14
                                for b in semua_bulan]
    kal['Porsi_Pasca_Lebaran'] = [sum(porsi_hari(b, pd.Timestamp(z) + pd.Timedelta(days=1),
                                                 pd.Timestamp(z) + pd.Timedelta(days=30)) for a, z in rentang)
                                  / b.days_in_month for b in semua_bulan]
    kal['Porsi_Ramadan_lalu'] = [sum(porsi_hari(b - 1, a, z) for a, z in rentang) / (b - 1).days_in_month
                                 for b in semua_bulan]
    return kal


def bulan_musim_lebaran(kalender):
    """Series bool per bulan: True jika bulan itu Ramadan atau 30 hari setelah Lebaran."""
    k = kalender.set_index('Bulan')
    return (k['Porsi_Ramadan'] + k['Porsi_Pasca_Lebaran']) > 0


def periksa_kalender(ramadan, bulan_prediksi):
    """Hentikan proses jika bulan yang diprediksi melewati tahun terakhir pada tabel Ramadan.
    Kalau tidak dihentikan, fitur kalender akan bernilai 0 secara diam-diam dan prediksi musim Lebaran salah."""
    tahun_terakhir = max(int(pd.Timestamp(z).year) for _, z in _rentang(ramadan))
    if bulan_prediksi.year > tahun_terakhir:
        raise ValueError(
            f'Tabel Ramadan hanya sampai tahun {tahun_terakhir}, padahal bulan yang diprediksi '
            f'{format_bulan_id(bulan_prediksi)}. '
            f'Tambahkan tanggal Ramadan tahun {bulan_prediksi.year} ke RAMADAN lalu latih ulang model.')


# ---------------------------------------------------------------- persiapan data harian
def siapkan_harian(df):
    """Bersihkan data harian: stok negatif -> 0, tentukan tanggal mulai tiap SKU, tambah Ukuran_Urut."""
    kurang = [c for c in KOLOM_WAJIB if c not in df.columns]
    if kurang:
        raise ValueError(f'Kolom wajib tidak ada: {kurang}')
    df = df.copy()
    df['Ukuran'] = df['Ukuran'].astype(str).str.strip()
    df['Tanggal_dt'] = pd.to_datetime(df['Tanggal_dt'])
    df[['Barang_Masuk', 'Barang_Keluar']] = df[['Barang_Masuk', 'Barang_Keluar']].fillna(0).astype(float)
    df = df.sort_values(KUNCI_SKU + ['Tanggal_dt']).reset_index(drop=True)
    df['Stok'] = df['Stok_Akhir'].clip(lower=0)               # stok fisik minimal 0; baris penjualan tetap dipakai
    aktif = (df['Stok_Akhir'] != 0) | (df['Barang_Masuk'] > 0) | (df['Barang_Keluar'] > 0)
    mulai = df[aktif].groupby(KUNCI_SKU)['Tanggal_dt'].min().rename('Tanggal_Mulai').reset_index()
    df = df.merge(mulai, on=KUNCI_SKU, how='left')
    df['Sudah_Dijual'] = df['Tanggal_dt'] >= df['Tanggal_Mulai']   # sebelum SKU ada = "belum dijual", bukan "habis"
    df['Ukuran_Urut'] = df['Ukuran'].map(urut_ukuran)
    return df


def bangun_label_sku(df):
    """Satu baris per SKU + label Fast/Slow (aturan median Total_Keluar per jenis produk)."""
    d = df[df['Sudah_Dijual']]
    sku = d.groupby(KUNCI_SKU).agg(
        Total_Keluar=('Barang_Keluar', 'sum'), Total_Masuk=('Barang_Masuk', 'sum'),
        Tanggal_Mulai=('Tanggal_dt', 'min'), Tanggal_Akhir=('Tanggal_dt', 'max'),
        Rata_Stok=('Stok', 'mean'), Max_Stok=('Stok', 'max'),
        Persen_Hari_Stok_Habis=('Stok', lambda x: (x <= 0).mean() * 100)).reset_index()
    sku['Ukuran_Urut'] = sku['Ukuran'].map(urut_ukuran)
    sku['Threshold_Median'] = sku.groupby('Jenis_Produk')['Total_Keluar'].transform('median')
    sku['Label_enc'] = (sku['Total_Keluar'] > sku['Threshold_Median']).astype(int)
    sku['Label'] = sku['Label_enc'].map({1: 'Fast-Moving', 0: 'Slow-Moving'})
    return sku


# ---------------------------------------------------------------- panel bulanan & fitur regresi
def bangun_panel(df, ramadan):
    """Penjualan per SKU per bulan + kalender + fitur lag. Mengembalikan (panel, kalender, bulan_akhir_data)."""
    bulan_akhir = df['Tanggal_dt'].max().to_period('M')
    semua_bulan = pd.period_range(df['Tanggal_dt'].min().to_period('M'), bulan_akhir + 1, freq='M')
    kalender = hitung_kalender(semua_bulan, ramadan)

    # Cakupan pencatatan per produk per bulan (jeda > JEDA_MAKS_HARI dianggap tidak tercatat)
    cakupan = []
    for produk, g in df.groupby('Jenis_Produk'):
        tgl = pd.Series(sorted(g['Tanggal_dt'].unique()))
        awal, akhir = tgl.min(), tgl.max()
        jeda = [(tgl[i - 1] + pd.Timedelta(days=1), tgl[i] - pd.Timedelta(days=1))
                for i in range(1, len(tgl)) if (tgl[i] - tgl[i - 1]).days > JEDA_MAKS_HARI]
        for b in semua_bulan[:-1]:
            hari = porsi_hari(b, awal, akhir) - sum(porsi_hari(b, a, z) for a, z in jeda)
            cakupan.append({'Jenis_Produk': produk, 'Bulan': b, 'Cakupan': hari / b.days_in_month})
    cakupan = pd.DataFrame(cakupan)

    # Panel SKU x bulan, dimulai dari bulan SKU pertama kali tersedia
    harian = df[df['Sudah_Dijual']].assign(Bulan=lambda t: t['Tanggal_dt'].dt.to_period('M'))
    bulanan = harian.groupby(KUNCI_SKU + ['Bulan'])['Barang_Keluar'].sum().rename('Keluar').reset_index()
    bagian = []
    for kunci, g in bulanan.groupby(KUNCI_SKU):
        penuh = pd.DataFrame({'Bulan': pd.period_range(g['Bulan'].min(), bulan_akhir, freq='M')})
        penuh = penuh.merge(g[['Bulan', 'Keluar']], on='Bulan', how='left')
        for k, v in zip(KUNCI_SKU, kunci):
            penuh[k] = v
        penuh['Keluar'] = penuh['Keluar'].fillna(0).astype(float)
        bagian.append(penuh)
    ukuran = df[KUNCI_SKU + ['Ukuran_Urut']].drop_duplicates()
    panel = (pd.concat(bagian, ignore_index=True)
             .merge(cakupan, on=['Jenis_Produk', 'Bulan'], how='left')
             .merge(kalender, on='Bulan', how='left')
             .merge(ukuran, on=KUNCI_SKU, how='left')
             .sort_values(KUNCI_SKU + ['Bulan']).reset_index(drop=True))
    bulan_pertama = panel.groupby(KUNCI_SKU)['Bulan'].transform('min')
    panel['Valid'] = (panel['Cakupan'] >= MIN_CAKUPAN) & (panel['Bulan'] > bulan_pertama)
    panel['Target'] = pd.to_numeric(panel['Keluar'].where(panel['Valid']), errors='coerce').astype(float)

    # Fitur lag: hanya memakai bulan SEBELUM bulan yang ditebak (float64 agar menampung pecahan & NaN)
    grup = panel.groupby(KUNCI_SKU)['Target']
    for k in [1, 2, 3]:
        panel[f'lag_{k}'] = grup.shift(k).astype(float)
    panel['rata_3'] = pd.to_numeric(
        grup.transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean()), errors='coerce'
    ).astype(float)
    panel['rata_6'] = pd.to_numeric(
        grup.transform(lambda s: s.shift(1).rolling(6, min_periods=2).mean()), errors='coerce'
    ).astype(float)
    for k in [1, 2, 3]:
        panel[f'lag_{k}'] = panel[f'lag_{k}'].fillna(panel['rata_6']).fillna(panel['rata_3'])
    return panel, kalender, bulan_akhir


def matriks_regresi(frame, kolom_acuan=None):
    """Fitur regresi: one-hot Varian + FITUR_ANGKA. Jika kolom_acuan diberikan, kolom disamakan dengan saat latih."""
    X = pd.concat([pd.get_dummies(frame['Varian'], prefix='Varian').astype(int), frame[FITUR_ANGKA]], axis=1)
    if kolom_acuan is not None:
        X = X.reindex(columns=kolom_acuan, fill_value=0)
    return X


def matriks_klasifikasi(frame, kolom_acuan=None):
    """Fitur klasifikasi: one-hot Jenis_Produk + one-hot Varian + Ukuran_Urut (hanya ciri produk)."""
    X = pd.get_dummies(frame[['Jenis_Produk', 'Varian']], prefix=['Produk', 'Varian']).astype(int)
    X['Ukuran_Urut'] = frame['Ukuran_Urut'].values
    if kolom_acuan is not None:
        X = X.reindex(columns=kolom_acuan, fill_value=0)
    return X


def fitur_bulan_depan(panel, kalender, bulan_prediksi):
    """Fitur untuk bulan yang akan diprediksi, dihitung dari penjualan bulan-bulan terakhir tiap SKU."""
    baris = []
    for kunci, g in panel.groupby(KUNCI_SKU):
        g = g.sort_values('Bulan')
        riwayat = g['Target']
        lag = [riwayat.iloc[-k] if len(riwayat) >= k else np.nan for k in [1, 2, 3]]
        rata_3 = riwayat.iloc[-3:].mean()
        rata_6 = riwayat.iloc[-6:].mean() if riwayat.iloc[-6:].notna().sum() >= 2 else np.nan
        lag = [v if pd.notna(v) else (rata_6 if pd.notna(rata_6) else rata_3) for v in lag]
        b = dict(zip(KUNCI_SKU, kunci))
        b.update({'Bulan': bulan_prediksi, 'lag_1': lag[0], 'lag_2': lag[1], 'lag_3': lag[2],
                  'rata_3': rata_3, 'rata_6': rata_6, 'Ukuran_Urut': g['Ukuran_Urut'].iloc[-1]})
        baris.append(b)
    return pd.DataFrame(baris).merge(kalender, on='Bulan', how='left')


def buat_rf_regresi():
    """Setelan Random Forest Regression yang dipakai di penelitian dan di website."""
    from sklearn.ensemble import RandomForestRegressor
    return RandomForestRegressor(n_estimators=300, min_samples_leaf=3, random_state=42, n_jobs=-1)


# ---------------------------------------------------------------- pembungkus model untuk backend
def muat_model(path):
    """Buka rf_sikoshen.pkl satu kali (seperti joblib.load(MODEL_PATH) pada contoh Flask) dan bungkus."""
    return ModelSikoshen(path)


class ModelSikoshen:
    """Menjalankan prediksi dari isi rf_sikoshen.pkl. 'sumber' = path file .pkl atau dictionary hasil joblib.load."""

    KUNCI_WAJIB = ['clf_model', 'clf_feature_cols', 'reg_model', 'reg_feature_cols', 'ramadan_dates',
                   'z_layanan', 'rmse_per_sku', 'meta']

    def __init__(self, sumber):
        bundle = joblib.load(sumber) if isinstance(sumber, (str, Path)) else sumber
        kurang = [k for k in self.KUNCI_WAJIB if k not in bundle]
        if kurang:
            raise ValueError(f'File model tidak lengkap, kunci hilang: {kurang}. '
                             f'rmse_per_sku dan meta dibutuhkan untuk stok pengaman; '
                             f'buat ulang rf_sikoshen.pkl dengan notebook 01 versi terbaru.')
        import sklearn
        v_latih = bundle['meta']['versi_library']['scikit_learn']
        if v_latih != sklearn.__version__:
            warnings.warn(f'Model dilatih dengan scikit-learn {v_latih}, server memakai {sklearn.__version__}. '
                          f'Pasang scikit-learn=={v_latih} agar hasil sama.')
        self.bundle = bundle
        self.meta = bundle['meta']
        self.reg = bundle['reg_model']
        self.clf = bundle['clf_model']
        self.rmse = pd.DataFrame(bundle['rmse_per_sku'])
        self.rmse['Ukuran'] = self.rmse['Ukuran'].astype(str)
        self.ramadan = bundle['ramadan_dates']
        self.z = bundle['z_layanan']
        self.fitur_regresi = list(bundle['reg_feature_cols'])
        self.fitur_klasifikasi = list(bundle['clf_feature_cols'])

    def prediksi(self, df_harian, z_layanan=None):
        """Prediksi penjualan bulan depan + stok pengaman + saran pesan per SKU.
        'Bulan depan' = bulan setelah tanggal terakhir pada df_harian."""
        z = self.z if z_layanan is None else z_layanan
        df = siapkan_harian(df_harian)
        bulan_pred = df['Tanggal_dt'].max().to_period('M') + 1
        periksa_kalender(self.ramadan, bulan_pred)
        sku = bangun_label_sku(df)
        panel, kalender, bulan_akhir = bangun_panel(df, self.ramadan)

        depan = fitur_bulan_depan(panel, kalender, bulan_pred)
        X = matriks_regresi(depan, self.fitur_regresi)
        bisa = X.notna().all(axis=1)
        depan['Prediksi_Penjualan'] = np.nan
        if bisa.any():
            depan.loc[bisa, 'Prediksi_Penjualan'] = np.maximum(0, self.reg.predict(X[bisa]))

        musim = 'lebaran' if bool(bulan_musim_lebaran(kalender)[bulan_pred]) else 'biasa'
        kol = f'RMSE_{musim}'
        depan = depan.merge(self.rmse[KUNCI_SKU + [kol]].rename(columns={kol: 'RMSE_SKU'}), on=KUNCI_SKU, how='left')
        depan['RMSE_SKU'] = depan['RMSE_SKU'].fillna(self.rmse[kol].median())
        stok_kini = (df.sort_values('Tanggal_dt').groupby(KUNCI_SKU)['Stok'].last()
                     .rename('Stok_Saat_Ini').reset_index())
        depan = depan.merge(stok_kini, on=KUNCI_SKU, how='left').merge(
            sku[KUNCI_SKU + ['Label', 'Threshold_Median', 'Total_Keluar']], on=KUNCI_SKU, how='left')
        depan['Stok_Pengaman'] = np.ceil(z * depan['RMSE_SKU'])
        depan['Saran_Pesan'] = np.ceil(np.maximum(0, depan['Prediksi_Penjualan'] + depan['Stok_Pengaman']
                                                  - depan['Stok_Saat_Ini']))
        depan['Prediksi_Penjualan'] = depan['Prediksi_Penjualan'].round(0)
        depan['Musim'] = musim
        depan['Bulan'] = depan['Bulan'].astype(str)
        return depan[KUNCI_SKU + ['Bulan', 'Musim', 'Label', 'Prediksi_Penjualan', 'Stok_Saat_Ini',
                                  'Stok_Pengaman', 'Saran_Pesan', 'RMSE_SKU']]

    def peluang_fast(self, jenis_produk, varian, ukuran):
        """Peluang (0-1) kombinasi produk-varian-ukuran cenderung Fast-Moving, dari ciri produk saja.
        Hanya valid untuk jenis produk dan varian yang sudah pernah dijual (varian baru ~ tebakan acak)."""
        baris = pd.DataFrame([{'Jenis_Produk': jenis_produk, 'Varian': varian, 'Ukuran_Urut': urut_ukuran(ukuran)}])
        if f'Varian_{varian}' not in self.fitur_klasifikasi:
            warnings.warn(f'Varian "{varian}" belum pernah ada saat model dilatih; hasil tidak dapat diandalkan.')
        X = matriks_klasifikasi(baris, self.fitur_klasifikasi)
        return float(self.clf.predict_proba(X)[0, 1])
