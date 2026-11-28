"""
Angka hasil PENELITIAN (Notebook penelitian: 02_Analisis_Penelitian_Sikoshen).

Angka-angka ini berasal dari evaluasi yang berat (nested cross-validation 15 pengujian, perbandingan 7 algoritma,
uji varian baru, permutation importance) sehingga TIDAK dihitung ulang oleh website. Website hanya menampilkannya
sebagai rujukan "hasil penelitian". Angka yang dihitung ulang setiap kali model dilatih di website ada di
model.meta (akurasi out-of-fold klasifikasi, WAPE/MAE regresi bergulir).

Jika notebook penelitian dijalankan ulang dengan data baru, perbarui angka di file ini.
"""

SUMBER = 'Notebook penelitian (Revisi 4), data kartu stok 6 Mei 2023 – 30 Mei 2026, 126 SKU'

KLASIFIKASI = {
    'catatan': 'Nested cross-validation: Repeated Stratified 5-Fold x 3 ulangan (15 pengujian), '
               'GridSearchCV 5-fold di dalam setiap lipatan. Rata-rata ± simpangan baku.',
    'perbandingan': [
        # model, akurasi %, sd, precision, recall, f1, roc_auc, jenis
        {'model': 'SVM (RBF)', 'akurasi': 89.4, 'sd': 3.5, 'precision': 0.88, 'recall': 0.92, 'f1': 0.90, 'rocAuc': 0.95, 'jenis': 'ml'},
        {'model': 'Gradient Boosting', 'akurasi': 88.9, 'sd': 7.0, 'precision': 0.87, 'recall': 0.93, 'f1': 0.89, 'rocAuc': 0.94, 'jenis': 'ml'},
        {'model': 'Logistic Regression', 'akurasi': 88.6, 'sd': 4.3, 'precision': 0.89, 'recall': 0.89, 'f1': 0.88, 'rocAuc': 0.96, 'jenis': 'ml'},
        {'model': 'Random Forest', 'akurasi': 88.0, 'sd': 7.0, 'precision': 0.86, 'recall': 0.92, 'f1': 0.89, 'rocAuc': 0.96, 'jenis': 'dipilih'},
        {'model': 'Decision Tree', 'akurasi': 86.5, 'sd': 8.1, 'precision': 0.86, 'recall': 0.90, 'f1': 0.87, 'rocAuc': 0.89, 'jenis': 'ml'},
        {'model': 'KNN', 'akurasi': 85.1, 'sd': 9.1, 'precision': 0.83, 'recall': 0.88, 'f1': 0.85, 'rocAuc': 0.94, 'jenis': 'ml'},
        {'model': 'Aturan varian saja', 'akurasi': 70.4, 'sd': 3.8, 'precision': 0.70, 'recall': 0.72, 'f1': 0.70, 'rocAuc': 0.83, 'jenis': 'pembanding'},
        {'model': 'Naive Bayes', 'akurasi': 70.1, 'sd': 8.8, 'precision': 0.66, 'recall': 0.83, 'f1': 0.73, 'rocAuc': 0.75, 'jenis': 'ml'},
        {'model': 'Aturan ukuran saja', 'akurasi': 58.4, 'sd': 10.9, 'precision': 0.60, 'recall': 0.50, 'f1': 0.54, 'rocAuc': 0.60, 'jenis': 'pembanding'},
        {'model': 'Tebak mayoritas', 'akurasi': 50.8, 'sd': 1.6, 'precision': 0.0, 'recall': 0.0, 'f1': 0.0, 'rocAuc': 0.50, 'jenis': 'pembanding'},
    ],
    # Confusion matrix gabungan Random Forest dari 15 pengujian (126 SKU x 3 putaran = 378 tebakan)
    'confusionMatrix': {'actualSlow': {'slow': 162, 'fast': 30}, 'actualFast': {'slow': 15, 'fast': 171}},
    # Penurunan akurasi (poin %) jika satu kelompok fitur diacak
    'permutationImportance': [
        {'feature': 'Varian', 'value': 28.3},
        {'feature': 'Ukuran', 'value': 21.1},
        {'feature': 'Jenis produk', 'value': 4.8},
    ],
    'akurasiVarianBaru': 49.7,
    'akurasiOutOfFold': 93.7,
    'setelan': {'n_estimators': 100, 'max_depth': None, 'min_samples_split': 2, 'min_samples_leaf': 1},
}

REGRESI = {
    'catatan': 'Pengujian bergulir 12 bulan (Juni 2025 – Mei 2026): model dilatih ulang hanya dengan data '
               'sebelum bulan yang ditebak.',
    'perbandingan': [
        {'model': 'Random Forest', 'mae': 8.02, 'rmse': 11.82, 'wape': 0.53, 'jenis': 'dipilih'},
        {'model': 'Decision Tree', 'mae': 8.31, 'rmse': 12.66, 'wape': 0.55, 'jenis': 'ml'},
        {'model': 'HistGradientBoosting', 'mae': 8.63, 'rmse': 13.21, 'wape': 0.57, 'jenis': 'ml'},
        {'model': 'RF tanpa fitur H-14', 'mae': 9.01, 'rmse': 14.04, 'wape': 0.59, 'jenis': 'uji'},
        {'model': 'Linear Regression', 'mae': 9.17, 'rmse': 14.05, 'wape': 0.60, 'jenis': 'ml'},
        {'model': 'Rata-rata 6 bulan', 'mae': 10.86, 'rmse': 18.27, 'wape': 0.72, 'jenis': 'pembanding'},
        {'model': 'Penjualan bulan lalu', 'mae': 10.88, 'rmse': 20.61, 'wape': 0.72, 'jenis': 'pembanding'},
        {'model': 'Rata-rata 3 bulan', 'mae': 11.15, 'rmse': 19.00, 'wape': 0.74, 'jenis': 'pembanding'},
        {'model': 'RF tanpa fitur kalender', 'mae': 12.69, 'rmse': 21.44, 'wape': 0.84, 'jenis': 'uji'},
    ],
    'catatanKejujuran': 'Fitur Porsi_H14_Lebaran ditambahkan setelah melihat hasil uji Februari 2026, sehingga WAPE 0,53 '
                        'bisa sedikit optimis. Tanpa fitur ini WAPE 0,59, tetap lebih baik daripada tebakan sederhana.',
}


def ringkasan():
    return {'sumber': SUMBER, 'klasifikasi': KLASIFIKASI, 'regresi': REGRESI}
