"""Regresi kesetaraan antara notebook sumber, endpoint website, pratinjau impor, pemulihan, dan kalender 2027."""
import ast
from contextlib import closing
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

# Tes memakai database kosong + data tiruan di test_fixtures/, jadi pengisian otomatis dari sample_files dimatikan.
# Pengisian awal diuji terpisah di test_startup_seeds_from_real_sample_files.
os.environ.setdefault("SIKOSHEN_SEED_SAMPLES", "0")

import evaluation
import main
import sikoshen
import sikoshen_pipeline as pipeline


def _oof(model, produk, varian, ukuran):
    """Peluang out-of-fold dari sku_master, atau None jika kombinasi belum pernah dijual."""
    for r in model.bundle.get("sku_master", []):
        if (str(r["Jenis_Produk"]), str(r["Varian"]), str(r["Ukuran"]).strip()) == (produk, varian, str(ukuran).strip()):
            return float(r["Peluang_Fast"])
    return None


class _ApiTestBase(unittest.TestCase):
    def _login(self, client: TestClient):
        resp = client.post("/api/auth/login", json={
            "email": "owner@sikoshen.id", "password": "sikoshen123"
        })
        self.assertTrue(resp.is_success, resp.text)

    def _import_via_preview_commit(self, client: TestClient, files, confirm_scope_reduction: bool = True):
        prev_resp = client.post("/api/forecast/import/preview", files=files)
        self.assertEqual(prev_resp.status_code, 200, prev_resp.text)
        preview = prev_resp.json()
        commit_resp = client.post("/api/forecast/import/commit", json={
            "preview_id": preview["preview_id"],
            "confirm_scope_reduction": confirm_scope_reduction,
        })
        self.assertEqual(commit_resp.status_code, 200, commit_resp.text)
        return commit_resp


class NotebookParity(_ApiTestBase):
    def test_pipeline_is_notebook_export(self):
        notebook = main.ROOT.parent / "notebooks" / "01-website.ipynb"
        cells = json.loads(notebook.read_text(encoding="utf-8"))["cells"]
        cell = next("".join(c["source"]) for c in cells if "".join(c["source"]).startswith("MODUL ="))
        exported = ast.literal_eval(ast.parse(cell).body[0].value)
        self.assertEqual(exported, Path(pipeline.__file__).read_text(encoding="utf-8"))

    def test_import_and_probability_use_notebook_calculations(self):
        # Februari 2025 -> prediksi Maret, sehingga jalur RMSE Lebaran juga diuji.
        dates = pd.date_range("2024-09-01", "2025-02-28")
        daily = pd.DataFrame({
            "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "28",
            "Tanggal_dt": dates, "Barang_Masuk": 0, "Barang_Keluar": np.arange(len(dates)) % 4,
            "Stok_Akhir": -1,
        })
        # SKU yang baru tercatat belum mempunyai lag yang cukup.
        recent = daily.tail(2).assign(Ukuran="29", Stok_Akhir=5)
        daily = pd.concat([daily, recent], ignore_index=True)
        model = pipeline.muat_model(main.MODEL_PATH)
        expected = model.prediksi(daily).set_index("Ukuran")
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test.db"):
            with TestClient(main.app) as client:
                self._login(client)
                response = self._import_via_preview_commit(client, files={
                    "files": ("harian.csv", io.BytesIO(daily.to_csv(index=False).encode()))
                })
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()
                self.assertEqual(result["season"], "lebaran")
                self.assertEqual(len(result["rows"]), len(expected))
                for row in result["rows"]:
                    ref = expected.loc[row["size"]]
                    self.assertEqual(row["prediction_month"], ref.Bulan)
                    self.assertEqual(row["label"], "fast" if ref.Label == "Fast-Moving" else "slow")
                    for col, source in {
                        "predicted_next_month": "Prediksi_Penjualan", "stock": "Stok_Saat_Ini",
                        "rmse_sku": "RMSE_SKU", "safety_stock": "Stok_Pengaman", "suggested_order": "Saran_Pesan"
                    }.items():
                        value = ref[source]
                        if pd.isna(value):
                            self.assertIsNone(row[col])
                        else:
                            self.assertEqual(row[col], value)
                    sku = (row["product"], row["variant"], row["size"])
                    query = dict(zip(("produk", "varian", "ukuran"), sku))
                    prob = client.get("/api/model/peluang-fast", params=query).json()
                    oof = _oof(model, *sku)
                    # SKU yang sudah dijual: peluang out-of-fold (sama dengan Peta Pola); selain itu model akhir.
                    self.assertEqual(prob["probability"], oof if oof is not None else model.peluang_fast(*sku))
                    self.assertTrue(prob["known"])

                # Uji target layanan Z (90% dan 98%) setara dengan ModelSikoshen.prediksi(daily, z_layanan=z)
                for z_val in (1.28, 2.05):
                    exp_z = model.prediksi(daily, z_layanan=z_val).set_index("Ukuran")
                    res_z = client.get("/api/forecast", params={"z": z_val}).json()
                    for row in res_z["rows"]:
                        ref = exp_z.loc[row["size"]]
                        self.assertEqual(row["safety_stock"], int(ref["Stok_Pengaman"]))
                        if pd.isna(ref["Saran_Pesan"]):
                            self.assertIsNone(row["suggested_order"])
                        else:
                            self.assertEqual(row["suggested_order"], int(ref["Saran_Pesan"]))

                # Uji batas unit (cap) di backend
                capped = client.get("/api/forecast", params={"cap": 5}).json()
                total_capped = sum(r["suggested_order"] or 0 for r in capped["rows"])
                self.assertLessEqual(total_capped, 5)

            with TestClient(main.app) as client:
                self._login(client)
                self.assertEqual(client.get("/api/forecast").json(), result)

    def test_peluang_fast_known_and_unseen_variant(self):
        model = pipeline.muat_model(main.MODEL_PATH)
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test.db"):
            with TestClient(main.app) as client:
                self._login(client)
                known_res = client.get("/api/model/peluang-fast", params={
                    "produk": "Tony Jack Biasa", "varian": "HITAM", "ukuran": "30"
                })
                self.assertEqual(known_res.status_code, 200)
                body = known_res.json()
                self.assertEqual(body["probability"], _oof(model, "Tony Jack Biasa", "HITAM", "30"))
                self.assertEqual(body["probability_source"], "out_of_fold")
                self.assertTrue(body["known"])
                self.assertTrue(body["in_training_master"])
                self.assertIsNone(body["warning"])

                unseen_size_res = client.get("/api/model/peluang-fast", params={
                    "produk": "Kemeja Denim", "varian": "PANJANG ABU", "ukuran": "XXL"
                }).json()
                self.assertEqual(unseen_size_res["probability"], model.peluang_fast("Kemeja Denim", "PANJANG ABU", "XXL"))
                self.assertTrue(unseen_size_res["known"])
                self.assertFalse(unseen_size_res["in_training_master"])

                unseen_var_res = client.get("/api/model/peluang-fast", params={
                    "produk": "Iron Head Ultimate", "varian": "WARNA BARU", "ukuran": "30"
                }).json()
                self.assertEqual(unseen_var_res["probability"], model.peluang_fast("Iron Head Ultimate", "WARNA BARU", "30"))
                self.assertFalse(unseen_var_res["known"])
                self.assertFalse(unseen_var_res["variant_known"])
                self.assertIsNotNone(unseen_var_res["warning"])
                self.assertIn("belum pernah", unseen_var_res["warning"].lower())

    def test_csv_missing_monthly_data_and_fractional_averages(self):
        """CSV dengan bulan hilang (jeda > 7 hari) dan rata-rata pecahan diproses tanpa galat tipe angka."""
        # Bangun data integer harian: 2025-01 s.d. 2025-07, namun seluruh 2025-04 hilang (jeda 30 hari).
        # Total bulanan non-kelipatan agar rata_3 dan rata_6 berupa pecahan (float).
        all_dates = pd.date_range("2025-01-01", "2025-07-31")
        kept_dates = all_dates[all_dates.month != 4]
        keluar_vals = [1 if d.day <= (d.month * 3 + 1) else 0 for d in kept_dates]
        daily_int = pd.DataFrame({
            "Jenis_Produk": "Iron Head Ultimate",
            "Varian": "ash gray",
            "Ukuran": "30",
            "Tanggal_dt": kept_dates,
            "Barang_Masuk": pd.Series([2] * len(kept_dates), dtype="Int64"),
            "Barang_Keluar": pd.Series(keluar_vals, dtype="Int64"),
            "Stok_Akhir": pd.Series([15] * len(kept_dates), dtype="Int64"),
        })

        # 1) Uji langsung bangun_panel() dengan input bertipe Int64 (pandas 3 nullable integer)
        df_siap = pipeline.siapkan_harian(daily_int)
        panel, _, _ = pipeline.bangun_panel(df_siap, pipeline.RAMADAN_DEFAULT)
        for col in ("Target", "lag_1", "lag_2", "lag_3", "rata_3", "rata_6"):
            self.assertTrue(pd.api.types.is_float_dtype(panel[col]), f"{col} harus bertipe float")

        # Bulan pertama dan bulan kedua tidak punya riwayat valid sebelumnya -> lag_1 tetap NaN
        self.assertTrue(pd.isna(panel.loc[0, "lag_1"]))
        # Bulan Mei (setelah April hilang) harus memakai rata_6 (lalu rata_3) yang berupa pecahan untuk lag_1
        mei_row = panel.loc[panel["Bulan"] == pd.Period("2025-05", freq="M")].iloc[0]
        self.assertTrue(pd.isna(panel.loc[panel["Bulan"] == pd.Period("2025-04", freq="M"), "Target"].iloc[0]))
        expected_mei_fill = mei_row["rata_6"] if pd.notna(mei_row["rata_6"]) else mei_row["rata_3"]
        self.assertAlmostEqual(mei_row["lag_1"], expected_mei_fill, places=6)
        self.assertNotEqual(mei_row["lag_1"], int(mei_row["lag_1"]))  # memastikan pecahan dipertahankan

        # 2) Uji lewat endpoint pratinjau CSV dengan angka bulat
        csv_bytes = daily_int.to_csv(index=False).encode("utf-8")
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_frac.db"):
            with TestClient(main.app) as client:
                self._login(client)
                prev = client.post("/api/forecast/import/preview", files={
                    "files": ("pecahan.csv", io.BytesIO(csv_bytes))
                })
                self.assertEqual(prev.status_code, 200, prev.text)
                body = prev.json()
                self.assertEqual(body["candidate"]["prediction_month"], "2025-08")
                self.assertGreater(len(body["validation"]["unrecorded_periods"]), 0)

    def test_ramadan_calendar_boundary_returns_clear_422(self):
        """Dengan kalender uji berhenti di 2026, CSV akhir Desember 2026 -> HTTP 422 menyebut Januari 2027."""
        dates = pd.date_range("2026-07-01", "2026-12-31")
        daily_2026 = pd.DataFrame({
            "Jenis_Produk": "Iron Head Ultimate",
            "Varian": "ash gray",
            "Ukuran": "30",
            "Tanggal_dt": dates,
            "Barang_Masuk": 2,
            "Barang_Keluar": 1,
            "Stok_Akhir": 10,
        })
        csv_payload = daily_2026.to_csv(index=False).encode("utf-8")
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_cal2026.db"):
            with TestClient(main.app) as client:
                self._login(client)
                before = client.get("/api/forecast").json()
                ramadan_until_2026 = {k: v for k, v in main.app.state.model.ramadan.items() if int(k) <= 2026}
                with patch.object(main.app.state.model, "ramadan", ramadan_until_2026):
                    resp = client.post("/api/forecast/import/preview", files={
                        "files": ("akhir_2026.csv", io.BytesIO(csv_payload))
                    })
                    self.assertEqual(resp.status_code, 422, resp.text)
                    detail = resp.json()["detail"]
                    self.assertIn("2026", detail)
                    self.assertIn("Januari 2027", detail)
                    self.assertIn("2027-01", detail)
                    self.assertIn("RAMADAN", detail)
                # Hasil aktif harus tetap dipertahankan saat impor gagal
                self.assertEqual(client.get("/api/forecast").json(), before)

    def test_december_2026_predicts_january_2027_with_2027_calendar(self):
        """Dengan kalender 2027 pada model aktif, CSV akhir Desember 2026 berhasil memprediksi Januari 2027."""
        dates = pd.date_range("2026-06-01", "2026-12-31")
        daily_2026 = pd.DataFrame({
            "Jenis_Produk": "Iron Head Ultimate",
            "Varian": "ash gray",
            "Ukuran": "30",
            "Tanggal_dt": dates,
            "Barang_Masuk": 2,
            "Barang_Keluar": (np.arange(len(dates)) % 3) + 1,
            "Stok_Akhir": 10,
        })
        model = pipeline.muat_model(main.MODEL_PATH)
        self.assertIn(2027, model.ramadan)
        expected = model.prediksi(daily_2026).iloc[0]
        self.assertEqual(expected["Bulan"], "2027-01")

        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_2027.db"):
            with TestClient(main.app) as client:
                self._login(client)
                health = client.get("/api/health").json()
                self.assertEqual(health["ramadan_max_year"], 2027)

                prev = client.post("/api/forecast/import/preview", files={
                    "files": ("des_2026.csv", io.BytesIO(daily_2026.to_csv(index=False).encode()))
                })
                self.assertEqual(prev.status_code, 200, prev.text)
                prev_body = prev.json()
                self.assertEqual(prev_body["candidate"]["prediction_month"], "2027-01")

                commit = client.post("/api/forecast/import/commit", json={
                    "preview_id": prev_body["preview_id"],
                    "confirm_scope_reduction": True,
                })
                self.assertEqual(commit.status_code, 200, commit.text)
                rows = commit.json()["rows"]
                self.assertEqual(len(rows), 1)
                row = rows[0]
                self.assertEqual(row["prediction_month"], "2027-01")
                self.assertIsNotNone(row["predicted_next_month"])
                self.assertEqual(row["predicted_next_month"], float(expected["Prediksi_Penjualan"]))
                self.assertEqual(row["safety_stock"], int(expected["Stok_Pengaman"]))
                self.assertEqual(row["suggested_order"], int(expected["Saran_Pesan"]))

                # Uji batas baru: Desember 2027 -> Januari 2028 harus ditolak 422
                dates_2027 = pd.date_range("2027-07-01", "2027-12-31")
                daily_2027 = pd.DataFrame({
                    "Jenis_Produk": "Iron Head Ultimate",
                    "Varian": "ash gray",
                    "Ukuran": "30",
                    "Tanggal_dt": dates_2027,
                    "Barang_Masuk": 2,
                    "Barang_Keluar": 1,
                    "Stok_Akhir": 10,
                })
                resp_2028 = client.post("/api/forecast/import/preview", files={
                    "files": ("des_2027.csv", io.BytesIO(daily_2027.to_csv(index=False).encode()))
                })
                self.assertEqual(resp_2028.status_code, 422, resp_2028.text)
                self.assertIn("Januari 2028", resp_2028.json()["detail"])
                self.assertIn("2027", resp_2028.json()["detail"])

    def test_startup_seeds_from_real_sample_files(self):
        """Database kosong diisi dari 3 kartu stok asli: 126 SKU, riwayat bulanan tersedia, prediksi = notebook."""
        if len(list(main.SAMPLE_DIR.glob("*.xlsx"))) < 3:
            self.skipTest("Tiga kartu stok asli belum ada di backend/sample_files/.")
        ref = pd.read_csv(main.MODEL_PATH.with_name("prediksi_bulan_depan.csv"), dtype={"Ukuran": str},
                          float_precision="round_trip")
        with tempfile.TemporaryDirectory() as folder, \
                patch.object(main, "DB_PATH", Path(folder) / "seed.db"), \
                patch.dict(os.environ, {"SIKOSHEN_SEED_SAMPLES": "1"}):
            with TestClient(main.app) as client:
                self._login(client)
                fc = client.get("/api/forecast").json()
                self.assertEqual(fc["source"], main.SEED_SOURCE)
                self.assertEqual(len(fc["rows"]), 126)
                master = client.get("/api/model/master").json()
                self.assertGreater(len(master["monthly_sales"]), 30)
                self.assertEqual(master["validation"]["total_skus"], 126)
                pred = {(r["product"], r["variant"], r["size"]): r["predicted_next_month"] for r in fc["rows"]}
                for r in ref.itertuples(index=False):
                    self.assertAlmostEqual(pred[(r.Jenis_Produk, r.Varian, str(r.Ukuran))], r.Prediksi_Penjualan, places=6)

    def test_three_original_excel_cards_match_reference_export_126_skus(self):
        """Tiga kartu stok asli menghasilkan prediksi Juni 2026 untuk 126 SKU identik dengan ekspor acuan."""
        orig_names = ["iron head ultimate.xlsx", "STOK KMJ DENIM-40.xlsx", "STOK TJ BIASA-50.xlsx"]
        orig_paths = [main.SAMPLE_DIR / name for name in orig_names]
        if not all(p.exists() for p in orig_paths):
            self.skipTest("Tiga kartu stok asli belum ada di backend/sample_files/.")

        ref = pd.read_csv(
            main.MODEL_PATH.with_name("prediksi_bulan_depan.csv"),
            dtype={"Ukuran": str},
            float_precision="round_trip",
        ).set_index(["Jenis_Produk", "Varian", "Ukuran"])
        self.assertEqual(len(ref), 126)

        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_orig126.db"):
            with TestClient(main.app) as client:
                self._login(client)
                multipart = [
                    ("files", (p.name, p.read_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    for p in orig_paths
                ]
                prev = client.post("/api/forecast/import/preview", files=multipart)
                self.assertEqual(prev.status_code, 200, prev.text)
                prev_body = prev.json()
                self.assertEqual(prev_body["candidate"]["total_skus"], 126)
                self.assertEqual(prev_body["candidate"]["prediction_month"], "2026-06")
                self.assertFalse(prev_body["has_scope_reduction"])

                commit = client.post("/api/forecast/import/commit", json={
                    "preview_id": prev_body["preview_id"],
                    "confirm_scope_reduction": False,
                })
                self.assertEqual(commit.status_code, 200, commit.text)
                result = commit.json()
                self.assertEqual(len(result["rows"]), 126)
                self.assertEqual(result["season"], "biasa")

                for row in result["rows"]:
                    key = (row["product"], row["variant"], row["size"])
                    expected = ref.loc[key]
                    self.assertEqual(row["prediction_month"], "2026-06")
                    self.assertEqual(row["label"], "fast" if expected["Label"] == "Fast-Moving" else "slow")
                    self.assertEqual(row["predicted_next_month"], float(expected["Prediksi_Penjualan"]))
                    self.assertEqual(row["safety_stock"], int(expected["Stok_Pengaman"]))
                    self.assertEqual(row["suggested_order"], int(expected["Saran_Pesan"]))

    def _sample_multipart(self, names=None):
        sample_dir = main.ROOT / "test_fixtures"      # data tiruan khusus tes (38/36/52 SKU)
        files = sorted(sample_dir.glob("*.xlsx"))
        if names is not None:
            files = [p for p in files if p.name in names]
        return [
            ("files", (p.name, p.read_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            for p in files
        ]

    def test_case_126_to_38_preview_cancel_commit_and_restore(self):
        """Kasus utama: 126 SKU (3 produk) -> unggah 1 file (38 SKU) -> pratinjau, batal, konfirmasi, dan pulihkan."""
        all_three = self._sample_multipart()
        only_ihu = self._sample_multipart({"iron head ultimate.xlsx"})
        self.assertEqual(len(all_three), 3)
        self.assertEqual(len(only_ihu), 1)

        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_126_38.db"):
            with TestClient(main.app) as client:
                self._login(client)

                # Siapkan kondisi aktif 126 SKU lengkap dengan validasi & riwayat harian (3 produk: 38 + 36 + 52 = 126)
                init_prev = client.post("/api/forecast/import/preview", files=all_three)
                self.assertEqual(init_prev.status_code, 200, init_prev.text)
                init_body = init_prev.json()
                init_commit = client.post("/api/forecast/import/commit", json={
                    "preview_id": init_body["preview_id"],
                    "confirm_scope_reduction": True,
                })
                self.assertEqual(init_commit.status_code, 200, init_commit.text)

                baseline_fc = client.get("/api/forecast").json()
                baseline_z90 = client.get("/api/forecast", params={"z": 1.28}).json()
                baseline_z98 = client.get("/api/forecast", params={"z": 2.05}).json()
                baseline_master = client.get("/api/model/master").json()
                self.assertEqual(len(baseline_fc["rows"]), 126)

                # 1. Unggah satu file (iron head ultimate.xlsx -> 38 SKU) ke pratinjau
                prev_resp = client.post("/api/forecast/import/preview", files=only_ihu)
                self.assertEqual(prev_resp.status_code, 200, prev_resp.text)
                prev = prev_resp.json()

                self.assertFalse(prev["is_first_import"])
                self.assertTrue(prev["has_scope_reduction"])
                self.assertTrue(prev["requires_extra_confirmation"])
                self.assertEqual(prev["current"]["total_skus"], 126)
                self.assertEqual(prev["candidate"]["total_skus"], 38)
                self.assertEqual(prev["missing_sku_count"], 88)
                self.assertEqual(prev["retained_sku_count"], 38)
                self.assertEqual(prev["missing_products"], ["Kemeja Denim", "Tony Jack Biasa"])
                self.assertEqual(len(prev["missing_skus"]), 88)

                # Selama pratinjau, Beranda & Saran Pemesanan tetap membaca hasil aktif 126 SKU
                self.assertEqual(client.get("/api/forecast").json(), baseline_fc)

                # 2. Batalkan pratinjau -> hasil aktif tetap 126 SKU dan identik
                cancel_resp = client.delete(f"/api/forecast/import/preview/{prev['preview_id']}")
                self.assertEqual(cancel_resp.status_code, 200)
                self.assertTrue(cancel_resp.json()["cancelled"])
                self.assertEqual(client.get("/api/forecast").json(), baseline_fc)
                self.assertEqual(client.get("/api/model/master").json()["validation"], baseline_master["validation"])

                # 3. Ulangi pratinjau 38 SKU
                prev2 = client.post("/api/forecast/import/preview", files=only_ihu).json()
                reject = client.post("/api/forecast/import/commit", json={
                    "preview_id": prev2["preview_id"],
                    "confirm_scope_reduction": False,
                })
                self.assertEqual(reject.status_code, 422)
                self.assertEqual(len(client.get("/api/forecast").json()["rows"]), 126)

                commit_resp = client.post("/api/forecast/import/commit", json={
                    "preview_id": prev2["preview_id"],
                    "confirm_scope_reduction": True,
                })
                self.assertEqual(commit_resp.status_code, 200, commit_resp.text)
                after_38 = commit_resp.json()
                self.assertEqual(len(after_38["rows"]), 38)
                self.assertEqual({r["product"] for r in after_38["rows"]}, {"Iron Head Ultimate"})

                master_38 = client.get("/api/model/master").json()
                self.assertTrue(master_38["restore_info"]["available"])
                self.assertEqual(master_38["restore_info"]["total_skus"], 126)
                self.assertEqual(master_38["validation"]["total_skus"], 38)

                # 4. Pulihkan hasil sebelumnya -> kembali 126 SKU beserta metadata validasi & skenario Z
                restore_resp = client.post("/api/forecast/restore")
                self.assertEqual(restore_resp.status_code, 200, restore_resp.text)
                restored_fc = restore_resp.json()
                self.assertEqual(restored_fc, baseline_fc)
                self.assertEqual(client.get("/api/forecast", params={"z": 1.28}).json(), baseline_z90)
                self.assertEqual(client.get("/api/forecast", params={"z": 2.05}).json(), baseline_z98)

                restored_master = client.get("/api/model/master").json()
                self.assertEqual(restored_master["validation"], baseline_master["validation"])
                self.assertEqual(restored_master["monthly_sales"], baseline_master["monthly_sales"])
                self.assertIsNone(restored_master["restore_info"])

    def test_same_total_sku_count_with_different_sku_identities_triggers_warning(self):
        """Jumlah SKU sama (2 vs 2) tetapi identitas SKU berbeda tetap terdeteksi hilang."""
        dates = pd.date_range("2025-01-01", "2025-06-30")
        df_a = pd.concat([
            pd.DataFrame({
                "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": sz,
                "Tanggal_dt": dates, "Barang_Masuk": 2, "Barang_Keluar": 1, "Stok_Akhir": 10,
            })
            for sz in ("28", "29")
        ], ignore_index=True)
        df_b = pd.concat([
            pd.DataFrame({
                "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": sz,
                "Tanggal_dt": dates, "Barang_Masuk": 2, "Barang_Keluar": 1, "Stok_Akhir": 10,
            })
            for sz in ("28", "30")
        ], ignore_index=True)

        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_id.db"):
            with TestClient(main.app) as client:
                self._login(client)
                # Pastikan rute impor langsung tanpa pratinjau sudah dihapus (tidak bisa mem-bypass pratinjau)
                direct = client.post("/api/forecast/import", files={
                    "files": ("a.csv", io.BytesIO(df_a.to_csv(index=False).encode()))
                })
                self.assertIn(direct.status_code, (404, 405))

                r1 = self._import_via_preview_commit(client, files={
                    "files": ("a.csv", io.BytesIO(df_a.to_csv(index=False).encode()))
                })
                self.assertEqual(r1.status_code, 200)

                prev = client.post("/api/forecast/import/preview", files={
                    "files": ("b.csv", io.BytesIO(df_b.to_csv(index=False).encode()))
                }).json()
                self.assertEqual(prev["current"]["total_skus"], 2)
                self.assertEqual(prev["candidate"]["total_skus"], 2)
                self.assertTrue(prev["has_scope_reduction"])
                self.assertEqual(prev["missing_sku_count"], 1)
                self.assertEqual(prev["added_sku_count"], 1)
                self.assertEqual(prev["missing_skus"], [{"product": "Iron Head Ultimate", "variant": "ash gray", "size": "29"}])
                self.assertEqual(prev["added_skus"], [{"product": "Iron Head Ultimate", "variant": "ash gray", "size": "30"}])

    def test_full_import_without_reduction_commits_without_extra_confirm(self):
        """Impor lengkap (ketiga file sama) tidak memicu peringatan pengurangan dan bisa diterapkan langsung."""
        all_three = self._sample_multipart()
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_full.db"):
            with TestClient(main.app) as client:
                self._login(client)
                p1 = client.post("/api/forecast/import/preview", files=all_three).json()
                c1 = client.post("/api/forecast/import/commit", json={
                    "preview_id": p1["preview_id"], "confirm_scope_reduction": True
                })
                self.assertEqual(c1.status_code, 200)

                p2 = client.post("/api/forecast/import/preview", files=all_three).json()
                self.assertFalse(p2["has_scope_reduction"])
                self.assertFalse(p2["requires_extra_confirmation"])
                self.assertEqual(p2["missing_sku_count"], 0)
                c2 = client.post("/api/forecast/import/commit", json={
                    "preview_id": p2["preview_id"], "confirm_scope_reduction": False
                })
                self.assertEqual(c2.status_code, 200)
                self.assertEqual(len(c2.json()["rows"]), 126)

    def test_first_import_on_empty_database(self):
        """Impor pertama saat belum ada hasil aktif: is_first_import=True dan current=None."""
        all_three = self._sample_multipart()
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_first.db"):
            with TestClient(main.app) as client:
                self._login(client)
                with closing(sikoshen.database(main.DB_PATH)) as conn, conn:
                    conn.execute("DELETE FROM sku_profiles")
                    conn.execute("DELETE FROM products")
                    conn.execute("DELETE FROM forecast_run")
                    conn.execute("DELETE FROM forecast_meta")

                self.assertEqual(client.get("/api/forecast").status_code, 404)
                prev = client.post("/api/forecast/import/preview", files=all_three).json()
                self.assertTrue(prev["is_first_import"])
                self.assertIsNone(prev["current"])
                self.assertFalse(prev["has_scope_reduction"])
                self.assertEqual(prev["candidate"]["total_skus"], 126)
                self.assertEqual(client.get("/api/forecast").status_code, 404)

                commit = client.post("/api/forecast/import/commit", json={
                    "preview_id": prev["preview_id"], "confirm_scope_reduction": False
                })
                self.assertEqual(commit.status_code, 200)
                self.assertEqual(len(commit.json()["rows"]), 126)
                self.assertIsNone(client.get("/api/model/master").json()["restore_info"])

    def test_invalid_file_preserves_active_forecast(self):
        """Berkas tidak valid ditolak 422 dan tidak mengubah hasil aktif."""
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_invalid.db"):
            with TestClient(main.app) as client:
                self._login(client)
                before = client.get("/api/forecast").json()

                bad_csv = b"Kolom_Salah,Angka\nfoo,bar\n"
                resp = client.post("/api/forecast/import/preview", files={
                    "files": ("rusak.csv", io.BytesIO(bad_csv))
                })
                self.assertEqual(resp.status_code, 422)
                self.assertEqual(client.get("/api/forecast").json(), before)

    def test_two_previews_from_same_active_state_rejects_stale_second_commit(self):
        """Dua pratinjau dari hasil aktif sama: commit pertama berhasil, commit kedua ditolak 409."""
        all_three = self._sample_multipart()
        only_ihu = self._sample_multipart({"iron head ultimate.xlsx"})
        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "test_race.db"):
            with TestClient(main.app) as client:
                self._login(client)
                p1 = client.post("/api/forecast/import/preview", files=all_three).json()
                p2 = client.post("/api/forecast/import/preview", files=only_ihu).json()
                self.assertEqual(p1["base_revision"], p2["base_revision"])

                c1 = client.post("/api/forecast/import/commit", json={
                    "preview_id": p1["preview_id"], "confirm_scope_reduction": True
                })
                self.assertEqual(c1.status_code, 200, c1.text)
                after_c1 = c1.json()
                self.assertEqual(len(after_c1["rows"]), 126)

                c2 = client.post("/api/forecast/import/commit", json={
                    "preview_id": p2["preview_id"], "confirm_scope_reduction": True
                })
                self.assertEqual(c2.status_code, 409, c2.text)
                self.assertIn("pratinjau ulang", c2.json()["detail"].lower())
                self.assertEqual(client.get("/api/forecast").json(), after_c1)


class MonthlyEvaluationTests(_ApiTestBase):
    def test_manual_mae_wape_season_breakdown_and_zero_actual_wape(self):
        """Uji angka prediksi, aktual, MAE, dan WAPE yang dihitung manual (keseluruhan, per musim, dan aktual total 0)."""
        with tempfile.TemporaryDirectory() as folder:
            db_path = Path(folder) / "eval_manual.db"
            with closing(sikoshen.database(db_path)) as conn, conn:
                conn.executescript(sikoshen.SCHEMA)

                # Bulan biasa 2026-06: 3 SKU (termasuk 1 SKU terjual 0 unit)
                evaluation.save_prediction_snapshot(
                    conn,
                    target_month="2026-06",
                    data_period_end="2026-05-30",
                    season="biasa",
                    model_version="v-manual-1",
                    source="test-mei",
                    records=[
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "28", "Prediksi_Penjualan": 12.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 10},
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "29", "Prediksi_Penjualan": 8.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 6},
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "30", "Prediksi_Penjualan": 4.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 2},
                    ],
                    baseline_map={
                        ("Iron Head Ultimate", "ash gray", "28"): 15.0,
                        ("Iron Head Ultimate", "ash gray", "29"): 6.0,
                        ("Iron Head Ultimate", "ash gray", "30"): 3.0,
                    },
                )
                # Bulan Ramadan/Lebaran 2027-02: 1 SKU
                evaluation.save_prediction_snapshot(
                    conn,
                    target_month="2027-02",
                    data_period_end="2027-01-31",
                    season="lebaran",
                    model_version="v-manual-1",
                    source="test-jan27",
                    records=[
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "28", "Prediksi_Penjualan": 30.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 35},
                    ],
                    baseline_map={("Iron Head Ultimate", "ash gray", "28"): 15.0},
                )
                # Bulan total aktual nol 2026-07: WAPE harus None (tidak tersedia)
                evaluation.save_prediction_snapshot(
                    conn,
                    target_month="2026-07",
                    data_period_end="2026-06-30",
                    season="biasa",
                    model_version="v-manual-1",
                    source="test-jun",
                    records=[
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "30", "Prediksi_Penjualan": 5.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 0},
                    ],
                    baseline_map={("Iron Head Ultimate", "ash gray", "30"): 2.0},
                )

                # Masukkan aktual tervalidasi manual untuk 2026-06 (10, 10, 0), 2027-02 (35), dan 2026-07 (0)
                conn.executemany(
                    """
                    INSERT INTO actual_monthly_sales (
                        month, product, variant, size, actual_sales, coverage, is_valid,
                        is_first_month, sku_first_date, stockout_days, recorded_days,
                        stockout_pct, had_stockout, source_period_end
                    ) VALUES (?, ?, ?, ?, ?, 1.0, 1, 0, '2026-01-01', 0, 30, 0.0, 0, '2027-02-28')
                    """,
                    [
                        ("2026-06", "Iron Head Ultimate", "ash gray", "28", 10.0),
                        ("2026-06", "Iron Head Ultimate", "ash gray", "29", 10.0),
                        ("2026-06", "Iron Head Ultimate", "ash gray", "30", 0.0),
                        ("2027-02", "Iron Head Ultimate", "ash gray", "28", 35.0),
                        ("2026-07", "Iron Head Ultimate", "ash gray", "30", 0.0),
                    ],
                )

                report = evaluation.evaluate_monthly_predictions(conn)
                by_m = {m["target_month"]: m for m in report["months"]}

                # Cek 2026-06 (biasa): RF abs err = 2+2+4=8, MAE=2.67, WAPE=8/20=40.0% | Base6 abs err = 5+4+3=12, MAE=4.0, WAPE=60.0%
                m_jun = by_m["2026-06"]
                self.assertEqual(m_jun["evaluated_count"], 3)
                self.assertEqual(m_jun["zero_sales_count"], 1)
                self.assertEqual(m_jun["rf"]["mae"], 2.67)
                self.assertEqual(m_jun["rf"]["wape_pct"], 40.0)
                self.assertEqual(m_jun["baseline_6m"]["mae"], 4.0)
                self.assertEqual(m_jun["baseline_6m"]["wape_pct"], 60.0)
                self.assertTrue(m_jun["rf_beats_baseline"])
                self.assertEqual(m_jun["top_errors"][0]["size"], "30")  # selisih terbesar: |4 - 0| = 4

                # Cek 2026-07 (total aktual = 0): MAE=5.0, WAPE=None (tidak tersedia)
                m_jul = by_m["2026-07"]
                self.assertEqual(m_jul["rf"]["mae"], 5.0)
                self.assertIsNone(m_jul["rf"]["wape_pct"])
                self.assertEqual(m_jul["baseline_6m"]["mae"], 2.0)
                self.assertIsNone(m_jul["baseline_6m"]["wape_pct"])

                # Cek 2027-02 (lebaran): RF abs err=5, MAE=5.0, WAPE=5/35=14.29% | Base6 abs err=20, MAE=20.0, WAPE=57.14%
                m_feb = by_m["2027-02"]
                self.assertEqual(m_feb["rf"]["mae"], 5.0)
                self.assertEqual(m_feb["rf"]["wape_pct"], 14.29)
                self.assertEqual(m_feb["baseline_6m"]["mae"], 20.0)
                self.assertEqual(m_feb["baseline_6m"]["wape_pct"], 57.14)

                # Cek per musim: biasa (2026-06 + 2026-07 -> 4 baris, total aktual 20, RF err 8+5=13 -> MAE=3.25, WAPE=65.0%)
                self.assertEqual(report["by_season"]["biasa"]["rf"]["n"], 4)
                self.assertEqual(report["by_season"]["biasa"]["rf"]["mae"], 3.25)
                self.assertEqual(report["by_season"]["biasa"]["rf"]["wape_pct"], 65.0)
                self.assertEqual(report["by_season"]["lebaran"]["rf"]["n"], 1)
                self.assertEqual(report["by_season"]["lebaran"]["rf"]["wape_pct"], 14.29)

                # Cek keseluruhan (5 baris, total aktual 55, RF err 13+5=18 -> MAE=3.6, WAPE=32.73%)
                self.assertEqual(report["overall"]["evaluated_months"], 3)
                self.assertEqual(report["overall"]["rf"]["n"], 5)
                self.assertEqual(report["overall"]["rf"]["mae"], 3.6)
                self.assertEqual(report["overall"]["rf"]["wape_pct"], 32.73)
                self.assertEqual(report["overall"]["baseline_6m"]["mae"], 6.8)
                self.assertEqual(report["overall"]["baseline_6m"]["wape_pct"], 61.82)
                self.assertTrue(report["overall"]["rf_beats_baseline"])

    def test_missing_and_incomplete_excluded_while_zero_sales_and_stockout_evaluated(self):
        """Data hilang & pencatatan <75% dikeluarkan dari evaluasi; penjualan 0 tercatat lengkap tetap dihitung & stok habis ditandai."""
        with tempfile.TemporaryDirectory() as folder:
            db_path = Path(folder) / "eval_completeness.db"
            with closing(sikoshen.database(db_path)) as conn, conn:
                conn.executescript(sikoshen.SCHEMA)
                evaluation.save_prediction_snapshot(
                    conn,
                    target_month="2026-06",
                    data_period_end="2026-05-30",
                    season="biasa",
                    model_version="v-comp",
                    source="mei-lengkap",
                    records=[
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "28", "Prediksi_Penjualan": 6.0, "Stok_Saat_Ini": 10, "Saran_Pesan": 0},
                        {"Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "29", "Prediksi_Penjualan": 4.0, "Stok_Saat_Ini": 0, "Saran_Pesan": 8},
                        {"Jenis_Produk": "Kemeja Denim", "Varian": "PENDEK ABU", "Ukuran": "L", "Prediksi_Penjualan": 20.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 15},
                        {"Jenis_Produk": "Tony Jack Biasa", "Varian": "HITAM", "Ukuran": "30", "Prediksi_Penjualan": 15.0, "Stok_Saat_Ini": 5, "Saran_Pesan": 10},
                    ],
                    baseline_map={
                        ("Iron Head Ultimate", "ash gray", "28"): 5.0,
                        ("Iron Head Ultimate", "ash gray", "29"): 5.0,
                        ("Kemeja Denim", "PENDEK ABU", "L"): 18.0,
                        ("Tony Jack Biasa", "HITAM", "30"): 12.0,
                    },
                )

                # Juni 2026:
                # - Iron Head 28: 30 hari penuh, terjual 0, stok 10 (tidak habis stok) -> DINILAI (aktual 0)
                # - Iron Head 29: 30 hari penuh, terjual 0, stok 0 selama 10 hari -> DINILAI (aktual 0 + had_stockout=True)
                # - Kemeja Denim L: hanya 10 hari tercatat (1-10 Juni, cakupan 33% < 75%) -> DIKECUALIKAN (incomplete_recording)
                # - Tony Jack 30: tidak ada data sama sekali -> DIKECUALIKAN (missing_data)
                jun_full = pd.date_range("2026-06-01", "2026-06-30")
                jun_part = pd.date_range("2026-06-01", "2026-06-10")
                daily = pd.concat([
                    pd.DataFrame({
                        "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "28",
                        "Tanggal_dt": jun_full, "Barang_Masuk": 0, "Barang_Keluar": 0, "Stok_Akhir": 10,
                    }),
                    pd.DataFrame({
                        "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": "29",
                        "Tanggal_dt": jun_full, "Barang_Masuk": 0, "Barang_Keluar": 0,
                        "Stok_Akhir": [0 if i < 10 else 5 for i in range(len(jun_full))],
                    }),
                    pd.DataFrame({
                        "Jenis_Produk": "Kemeja Denim", "Varian": "PENDEK ABU", "Ukuran": "L",
                        "Tanggal_dt": jun_part, "Barang_Masuk": 0, "Barang_Keluar": 1, "Stok_Akhir": 5,
                    }),
                ], ignore_index=True)

                evaluation.save_actual_monthly_sales(conn, daily)
                report = evaluation.evaluate_monthly_predictions(conn)
                m = report["months"][0]

                self.assertEqual(m["evaluated_count"], 2)
                self.assertEqual(m["zero_sales_count"], 2)
                self.assertEqual(m["stockout_count"], 1)
                self.assertEqual(m["excluded_incomplete_count"], 1)
                self.assertEqual(m["excluded_missing_count"], 1)
                self.assertEqual(m["rf"]["mae"], 5.0)  # (|6-0| + |4-0|) / 2 = 5.0
                self.assertIsNone(m["rf"]["wape_pct"])  # total aktual 0 -> WAPE tidak tersedia

                by_sku = {(r["product"], r["size"]): r for r in m["rows"]}
                self.assertEqual(by_sku[("Iron Head Ultimate", "28")]["status"], "evaluated")
                self.assertFalse(by_sku[("Iron Head Ultimate", "28")]["had_stockout"])
                self.assertEqual(by_sku[("Iron Head Ultimate", "29")]["status"], "evaluated")
                self.assertTrue(by_sku[("Iron Head Ultimate", "29")]["had_stockout"])
                self.assertEqual(by_sku[("Iron Head Ultimate", "29")]["stockout_days"], 10)
                self.assertEqual(by_sku[("Kemeja Denim", "L")]["status"], "incomplete_recording")
                self.assertEqual(by_sku[("Tony Jack Biasa", "30")]["status"], "missing_data")

    def test_imports_and_model_update_do_not_modify_saved_snapshots_and_evaluate_post_training_month(self):
        """Impor baru & pembaruan versi model tidak mengubah prediksi lama; data aktual Juni 2026 dievaluasi end-to-end."""
        # Data 7 bulan s.d. Mei 2026 -> prediksi Juni 2026
        dates_may = pd.date_range("2025-11-01", "2026-05-31")
        df_may = pd.concat([
            pd.DataFrame({
                "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": sz,
                "Tanggal_dt": dates_may, "Barang_Masuk": 2,
                "Barang_Keluar": ((np.arange(len(dates_may)) + idx) % 3),
                "Stok_Akhir": 12,
            })
            for idx, sz in enumerate(("28", "30"))
        ], ignore_index=True)

        # Data Juni 2026 (pasca-pelatihan) ditambahkan -> aktual Juni 2026 diketahui & rencana Juli 2026 dibuat
        dates_jun = pd.date_range("2026-06-01", "2026-06-30")
        df_jun_add = pd.concat([
            pd.DataFrame({
                "Jenis_Produk": "Iron Head Ultimate", "Varian": "ash gray", "Ukuran": sz,
                "Tanggal_dt": dates_jun, "Barang_Masuk": 1,
                "Barang_Keluar": [1 if (i % (2 + idx) == 0) else 0 for i in range(len(dates_jun))],
                "Stok_Akhir": [0 if (idx == 1 and i < 5) else 8 for i in range(len(dates_jun))],
            })
            for idx, sz in enumerate(("28", "30"))
        ], ignore_index=True)
        df_through_jun = pd.concat([df_may, df_jun_add], ignore_index=True)

        with tempfile.TemporaryDirectory() as folder, patch.object(main, "DB_PATH", Path(folder) / "eval_e2e.db"):
            with TestClient(main.app) as client:
                self._login(client)
                # 1. Terapkan rencana Mei 2026 (prediksi Juni 2026) dengan versi model "v-sebelum-update"
                with patch.dict(main.app.state.model.meta, {"versi_model": "v-sebelum-update"}):
                    p1 = client.post("/api/forecast/import/preview", files={
                        "files": ("mei_2026.csv", io.BytesIO(df_may.to_csv(index=False).encode()))
                    }).json()
                    c1 = client.post("/api/forecast/import/commit", json={
                        "preview_id": p1["preview_id"], "confirm_scope_reduction": True
                    })
                    self.assertEqual(c1.status_code, 200, c1.text)

                # Sebelum aktual Juni 2026 masuk -> evaluasi bulan baru masih menunggu data aktual
                eval_before = client.get("/api/evaluation").json()
                self.assertFalse(eval_before["has_evaluated_months"])
                snap_jun_before = next(
                    m for m in eval_before["months"]
                    if m["target_month"] == "2026-06" and m["model_version"] == "v-sebelum-update"
                )
                saved_jun_preds = {
                    (r["product"], r["variant"], r["size"]): (r["rf_prediction"], r["baseline_6m"])
                    for r in snap_jun_before["rows"]
                }
                self.assertTrue(all(v[0] is not None and v[1] is not None for v in saved_jun_preds.values()))

                # 2. Simulasikan pembaruan model ("v-sesudah-update") + unggah aktual Juni 2026
                with patch.dict(main.app.state.model.meta, {"versi_model": "v-sesudah-update"}):
                    p2 = client.post("/api/forecast/import/preview", files={
                        "files": ("juni_2026.csv", io.BytesIO(df_through_jun.to_csv(index=False).encode()))
                    }).json()
                    c2 = client.post("/api/forecast/import/commit", json={
                        "preview_id": p2["preview_id"], "confirm_scope_reduction": True
                    })
                    self.assertEqual(c2.status_code, 200, c2.text)

                eval_after = client.get("/api/evaluation").json()
                self.assertTrue(eval_after["has_evaluated_months"])
                self.assertEqual(eval_after["overall"]["evaluated_months"], 1)
                self.assertEqual(eval_after["research_reference"]["unseen_variant_accuracy_pct"], 49.7)

                # Prediksi Juni 2026 lama (v-sebelum-update) tetap utuh & kini ter-evaluasi dengan aktual Juni 2026
                snap_jun_after = next(
                    m for m in eval_after["months"]
                    if m["target_month"] == "2026-06" and m["model_version"] == "v-sebelum-update"
                )
                self.assertTrue(snap_jun_after["has_actuals"])
                self.assertEqual(snap_jun_after["evaluated_count"], 2)
                self.assertEqual(snap_jun_after["stockout_count"], 1)
                self.assertIsNotNone(snap_jun_after["rf"]["mae"])
                self.assertIsNotNone(snap_jun_after["rf"]["wape_pct"])
                self.assertIsNotNone(snap_jun_after["baseline_6m"]["mae"])
                self.assertIsNotNone(snap_jun_after["baseline_6m"]["wape_pct"])
                for r in snap_jun_after["rows"]:
                    key = (r["product"], r["variant"], r["size"])
                    self.assertEqual((r["rf_prediction"], r["baseline_6m"]), saved_jun_preds[key])

                # Snapshot baru 2026-07 memakai v-sesudah-update & masih menunggu aktual Juli 2026
                snap_jul = next(m for m in eval_after["months"] if m["target_month"] == "2026-07")
                self.assertEqual(snap_jul["model_version"], "v-sesudah-update")
                self.assertFalse(snap_jul["has_actuals"])


if __name__ == "__main__":
    unittest.main()
