"""Evaluasi prediksi bulanan (Random Forest vs Baseline Rata-rata 6 Bulan) mengikuti 02_Analisis_Penelitian_Sikoshen.ipynb."""
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from sikoshen_pipeline import (
    JEDA_MAKS_HARI,
    KUNCI_SKU,
    MIN_CAKUPAN,
    bangun_panel,
    fitur_bulan_depan,
    porsi_hari,
    siapkan_harian,
)

EVALUATION_SCHEMA = """
CREATE TABLE IF NOT EXISTS prediction_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_month TEXT NOT NULL,
    data_period_end TEXT NOT NULL,
    season TEXT NOT NULL,
    model_version TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prediction_snapshot_rows (
    snapshot_id INTEGER NOT NULL REFERENCES prediction_snapshots(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    variant TEXT NOT NULL,
    size TEXT NOT NULL,
    rf_prediction REAL,
    baseline_6m REAL,
    stock_at_prediction INTEGER,
    suggested_order INTEGER,
    PRIMARY KEY (snapshot_id, product, variant, size)
);
CREATE TABLE IF NOT EXISTS actual_monthly_sales (
    month TEXT NOT NULL,
    product TEXT NOT NULL,
    variant TEXT NOT NULL,
    size TEXT NOT NULL,
    actual_sales REAL NOT NULL,
    coverage REAL NOT NULL,
    is_valid INTEGER NOT NULL,
    is_first_month INTEGER NOT NULL,
    sku_first_date TEXT NOT NULL,
    stockout_days INTEGER NOT NULL,
    recorded_days INTEGER NOT NULL,
    stockout_pct REAL NOT NULL,
    had_stockout INTEGER NOT NULL,
    source_period_end TEXT NOT NULL,
    PRIMARY KEY (month, product, variant, size)
);
"""


def compute_baseline_6m_map(daily: pd.DataFrame, ramadan) -> dict[tuple[str, str, str], float | None]:
    """Hitung prediksi pembanding rata-rata 6 bulan per SKU persis mengikuti fitur_bulan_depan() notebook."""
    df = siapkan_harian(daily)
    panel, kalender, bulan_akhir = bangun_panel(df, ramadan)
    depan = fitur_bulan_depan(panel, kalender, bulan_akhir + 1)
    result: dict[tuple[str, str, str], float | None] = {}
    for _, row in depan.iterrows():
        key = (str(row["Jenis_Produk"]), str(row["Varian"]), str(row["Ukuran"]).strip())
        val = row["rata_6"]
        result[key] = None if pd.isna(val) else float(val)
    return result


def save_prediction_snapshot(
    conn,
    *,
    target_month: str,
    data_period_end: str,
    season: str,
    model_version: str,
    source: str,
    records: list[dict],
    baseline_map: dict[tuple[str, str, str], float | None] | None = None,
    skip_if_identical_seed: bool = False,
) -> int | None:
    """Simpan snapshot prediksi secara append-only (tidak menimpa/menghapus snapshot lama)."""
    if not records:
        return None

    if skip_if_identical_seed:
        existing = conn.execute(
            """
            SELECT id FROM prediction_snapshots
            WHERE target_month=? AND data_period_end=? AND model_version=? AND source=?
            LIMIT 1
            """,
            (target_month, data_period_end, model_version, source),
        ).fetchone()
        if existing is not None:
            return int(existing["id"])

    created_at = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        """
        INSERT INTO prediction_snapshots (
            target_month, data_period_end, season, model_version, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (target_month, data_period_end, season, model_version, source, created_at),
    )
    snapshot_id = int(cur.lastrowid)
    base_lookup = baseline_map or {}

    row_tuples = []
    for rec in records:
        prod = str(rec["Jenis_Produk"])
        var = str(rec["Varian"])
        sz = str(rec["Ukuran"]).strip()
        rf_raw = rec.get("Prediksi_Penjualan")
        rf_pred = None if (rf_raw is None or pd.isna(rf_raw)) else float(rf_raw)
        base_pred = base_lookup.get((prod, var, sz))
        stok_raw = rec.get("Stok_Saat_Ini")
        stok_val = None if (stok_raw is None or pd.isna(stok_raw)) else int(round(float(stok_raw)))
        saran_raw = rec.get("Saran_Pesan")
        saran_val = None if (saran_raw is None or pd.isna(saran_raw)) else int(round(float(saran_raw)))
        row_tuples.append((snapshot_id, prod, var, sz, rf_pred, base_pred, stok_val, saran_val))

    conn.executemany(
        """
        INSERT INTO prediction_snapshot_rows (
            snapshot_id, product, variant, size, rf_prediction, baseline_6m,
            stock_at_prediction, suggested_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        row_tuples,
    )
    return snapshot_id


def extract_actual_monthly_rows(
    daily: pd.DataFrame,
    known_active_skus: set[tuple[str, str, str]] | None = None,
) -> list[dict]:
    """Ekstrak penjualan aktual bulanan, cakupan pencatatan (>=75%, jeda<=7 hari), dan tanda kehabisan stok."""
    df = siapkan_harian(daily)
    if known_active_skus:
        keys_series = list(
            zip(df["Jenis_Produk"].astype(str), df["Varian"].astype(str), df["Ukuran"].astype(str).str.strip())
        )
        known_mask = pd.Series([k in known_active_skus for k in keys_series], index=df.index)
        # SKU yang sudah ada pada snapshot rencana sebelumnya sudah aktif sejak hari pertama bulan target
        df.loc[known_mask, "Sudah_Dijual"] = True

    bulan_awal = df["Tanggal_dt"].min().to_period("M")
    bulan_akhir = df["Tanggal_dt"].max().to_period("M")
    semua_bulan = pd.period_range(bulan_awal, bulan_akhir, freq="M")
    source_period_end = df["Tanggal_dt"].max().date().isoformat()

    # Cakupan pencatatan per produk per bulan mengikuti bangun_panel() notebook
    coverage_map: dict[tuple[str, pd.Period], float] = {}
    for produk, g in df.groupby("Jenis_Produk"):
        tgl = pd.Series(sorted(g["Tanggal_dt"].unique()))
        awal, akhir = tgl.min(), tgl.max()
        jeda = [
            (tgl[i - 1] + pd.Timedelta(days=1), tgl[i] - pd.Timedelta(days=1))
            for i in range(1, len(tgl))
            if (tgl[i] - tgl[i - 1]).days > JEDA_MAKS_HARI
        ]
        for b in semua_bulan:
            hari = porsi_hari(b, awal, akhir) - sum(porsi_hari(b, a, z) for a, z in jeda)
            coverage_map[(str(produk), b)] = float(max(0.0, hari / b.days_in_month))

    harian = df[df["Sudah_Dijual"]].assign(Bulan=lambda t: t["Tanggal_dt"].dt.to_period("M"))
    records: list[dict] = []
    seen_skus: set[tuple[str, str, str]] = set()

    if not harian.empty:
        first_date_by_sku = harian.groupby(KUNCI_SKU)["Tanggal_dt"].min().to_dict()
        monthly_agg = (
            harian.groupby(KUNCI_SKU + ["Bulan"])
            .agg(
                actual_sales=("Barang_Keluar", "sum"),
                recorded_days=("Tanggal_dt", "nunique"),
                stockout_days=("Stok", lambda s: int((s <= 0).sum())),
            )
            .reset_index()
        )

        for kunci, g in monthly_agg.groupby(KUNCI_SKU):
            prod, var, sz = str(kunci[0]), str(kunci[1]), str(kunci[2]).strip()
            seen_skus.add((prod, var, sz))
            first_dt = pd.Timestamp(first_date_by_sku[kunci])
            first_month = first_dt.to_period("M")
            sku_months = pd.period_range(first_month, bulan_akhir, freq="M")
            by_month = {row["Bulan"]: row for _, row in g.iterrows()}

            for b in sku_months:
                cov = coverage_map.get((prod, b), 0.0)
                is_first = b == first_month
                # Bulan lengkap: cakupan >= 75% (aturan MIN_CAKUPAN notebook) dan bukan mulai di tengah bulan
                is_valid = (cov >= MIN_CAKUPAN) and (not is_first or first_dt.day == 1)

                if b in by_month:
                    row = by_month[b]
                    actual_sales = float(row["actual_sales"])
                    recorded_days = int(row["recorded_days"])
                    stockout_days = int(row["stockout_days"])
                else:
                    actual_sales = 0.0
                    recorded_days = 0
                    stockout_days = 0

                stockout_pct = round((stockout_days / recorded_days) * 100.0, 1) if recorded_days > 0 else 0.0
                records.append(
                    {
                        "month": str(b),
                        "product": prod,
                        "variant": var,
                        "size": sz,
                        "actual_sales": actual_sales,
                        "coverage": round(cov, 4),
                        "is_valid": 1 if is_valid else 0,
                        "is_first_month": 1 if is_first else 0,
                        "sku_first_date": first_dt.date().isoformat(),
                        "stockout_days": stockout_days,
                        "recorded_days": recorded_days,
                        "stockout_pct": stockout_pct,
                        "had_stockout": 1 if stockout_days > 0 else 0,
                        "source_period_end": source_period_end,
                    }
                )

    # Tangani SKU yang tercatat sepanjang bulan namun stok=0 & keluar=0 terus (mis. berkas 1 bulan saat stok kosong)
    df_all_m = df.assign(Bulan=lambda t: t["Tanggal_dt"].dt.to_period("M"))
    for kunci, g in df_all_m.groupby(KUNCI_SKU):
        prod, var, sz = str(kunci[0]), str(kunci[1]), str(kunci[2]).strip()
        if (prod, var, sz) in seen_skus:
            continue
        first_dt = pd.Timestamp(g["Tanggal_dt"].min())
        for b, gb in g.groupby("Bulan"):
            cov = coverage_map.get((prod, b), 0.0)
            recorded_days = int(gb["Tanggal_dt"].nunique())
            stockout_days = int((gb["Stok"] <= 0).sum())
            stockout_pct = round((stockout_days / recorded_days) * 100.0, 1) if recorded_days > 0 else 0.0
            is_valid = cov >= MIN_CAKUPAN
            records.append(
                {
                    "month": str(b),
                    "product": prod,
                    "variant": var,
                    "size": sz,
                    "actual_sales": float(gb["Barang_Keluar"].sum()),
                    "coverage": round(cov, 4),
                    "is_valid": 1 if is_valid else 0,
                    "is_first_month": 0,
                    "sku_first_date": first_dt.date().isoformat(),
                    "stockout_days": stockout_days,
                    "recorded_days": recorded_days,
                    "stockout_pct": stockout_pct,
                    "had_stockout": 1 if stockout_days > 0 else 0,
                    "source_period_end": source_period_end,
                }
            )
    return records


def save_actual_monthly_sales(conn, daily: pd.DataFrame) -> int:
    """Simpan / perbarui penjualan aktual bulanan tanpa mengubah snapshot prediksi lama."""
    known_active = {
        (str(r["product"]), str(r["variant"]), str(r["size"]).strip())
        for r in conn.execute("SELECT DISTINCT product, variant, size FROM prediction_snapshot_rows").fetchall()
    }
    rows = extract_actual_monthly_rows(daily, known_active_skus=known_active)
    if not rows:
        return 0
    conn.executemany(
        """
        INSERT OR REPLACE INTO actual_monthly_sales (
            month, product, variant, size, actual_sales, coverage, is_valid,
            is_first_month, sku_first_date, stockout_days, recorded_days,
            stockout_pct, had_stockout, source_period_end
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                r["month"],
                r["product"],
                r["variant"],
                r["size"],
                r["actual_sales"],
                r["coverage"],
                r["is_valid"],
                r["is_first_month"],
                r["sku_first_date"],
                r["stockout_days"],
                r["recorded_days"],
                r["stockout_pct"],
                r["had_stockout"],
                r["source_period_end"],
            )
            for r in rows
        ],
    )
    return len(rows)


def compute_method_metrics(pairs: list[tuple[float, float]]) -> dict:
    """Hitung MAE (unit) dan WAPE (%) dari daftar pasangan (prediksi, aktual). WAPE=None jika total aktual 0."""
    n = len(pairs)
    if n == 0:
        return {
            "n": 0,
            "mae": None,
            "wape_pct": None,
            "total_actual": 0.0,
            "total_abs_error": 0.0,
        }
    total_abs_error = float(sum(abs(pred - act) for pred, act in pairs))
    total_actual = float(sum(act for _, act in pairs))
    mae = round(total_abs_error / n, 2)
    wape_pct = round((total_abs_error / total_actual) * 100.0, 2) if total_actual > 0 else None
    return {
        "n": n,
        "mae": mae,
        "wape_pct": wape_pct,
        "total_actual": round(total_actual, 2),
        "total_abs_error": round(total_abs_error, 2),
    }


def _rf_beats_baseline(rf_metrics: dict, base_metrics: dict) -> bool | None:
    if rf_metrics["n"] == 0 or base_metrics["n"] == 0:
        return None
    if rf_metrics["wape_pct"] is not None and base_metrics["wape_pct"] is not None:
        return rf_metrics["wape_pct"] < base_metrics["wape_pct"]
    if rf_metrics["mae"] is not None and base_metrics["mae"] is not None:
        return rf_metrics["mae"] < base_metrics["mae"]
    return None


def build_research_reference(model_meta: dict | None) -> dict:
    """Ringkas angka penelitian terdahulu dari 02_Analisis_Penelitian_Sikoshen.ipynb secara terpisah."""
    reg = (model_meta or {}).get("evaluasi_regresi_bergulir") or {}
    rf = reg.get("Random Forest") or {}
    base6 = reg.get("Baseline rata 6 bln") or {}
    rf_wape = rf.get("WAPE")
    base_wape = base6.get("WAPE")
    return {
        "period": reg.get("bulan_uji") or ["2025-06", "2026-05"],
        "rf_mae": round(float(rf["MAE"]), 2) if "MAE" in rf else 8.02,
        "rf_wape_pct": round(float(rf_wape) * 100.0, 1) if rf_wape is not None else 52.9,
        "baseline_6m_mae": round(float(base6["MAE"]), 2) if "MAE" in base6 else 10.86,
        "baseline_6m_wape_pct": round(float(base_wape) * 100.0, 1) if base_wape is not None else 71.6,
        "unseen_variant_accuracy_pct": 49.7,
        "note": (
            "Angka acuan penelitian terdahulu (uji bergulir 12 bulan, Juni 2025 – Mei 2026, 02_Analisis_Penelitian_Sikoshen.ipynb). "
            "Evaluasi bulan baru dihitung terpisah dari penjualan aktual pasca-rencana."
        ),
    }


def evaluate_monthly_predictions(conn, model_meta: dict | None = None) -> dict:
    """Bandingkan snapshot prediksi pra-aktual dengan penjualan aktual bulanan yang tercatat lengkap."""
    snapshots = [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM prediction_snapshots ORDER BY target_month DESC, id DESC"
        ).fetchall()
    ]

    actual_rows = conn.execute("SELECT * FROM actual_monthly_sales").fetchall()
    actual_lookup: dict[tuple[str, str, str, str], dict] = {
        (r["month"], r["product"], r["variant"], r["size"]): dict(r) for r in actual_rows
    }

    evaluated_months = []
    # Untuk ringkasan keseluruhan & per musim, pakai 1 snapshot pra-aktual terbaru per target_month
    # agar satu bulan tidak terhitung ganda jika rencana pernah diterapkan ulang sebelum bulan target.
    primary_seen_months: set[str] = set()
    overall_rf_pairs: list[tuple[float, float]] = []
    overall_base_pairs: list[tuple[float, float]] = []
    overall_months_with_actuals = 0

    season_buckets: dict[str, dict] = {
        "biasa": {"months": 0, "rf_pairs": [], "base_pairs": []},
        "lebaran": {"months": 0, "rf_pairs": [], "base_pairs": []},
    }

    for snap in snapshots:
        target_month = str(snap["target_month"])
        data_period_end = str(snap["data_period_end"])
        # Aturan ketat: hanya pakai prediksi yang dibuat SEBELUM penjualan bulan target diketahui
        if data_period_end[:7] >= target_month:
            continue

        snap_rows = conn.execute(
            """
            SELECT product, variant, size, rf_prediction, baseline_6m, stock_at_prediction, suggested_order
            FROM prediction_snapshot_rows
            WHERE snapshot_id=?
            ORDER BY product, variant, size
            """,
            (snap["id"],),
        ).fetchall()

        rf_pairs: list[tuple[float, float]] = []
        base_pairs: list[tuple[float, float]] = []
        detail_rows: list[dict] = []

        evaluated_count = 0
        zero_sales_count = 0
        excluded_missing_count = 0
        excluded_incomplete_count = 0
        excluded_no_prediction_count = 0
        stockout_count = 0

        for r in snap_rows:
            prod, var, sz = r["product"], r["variant"], r["size"]
            rf_pred = None if r["rf_prediction"] is None else float(r["rf_prediction"])
            base_pred = None if r["baseline_6m"] is None else float(r["baseline_6m"])
            act_rec = actual_lookup.get((target_month, prod, var, sz))

            if act_rec is None:
                status = "missing_data"
                excluded_missing_count += 1
                actual_val = None
                coverage = None
                had_stockout = False
                stockout_days = 0
                stockout_pct = 0.0
                reason = "Data aktual bulan ini belum tersedia."
            elif int(act_rec["is_valid"]) == 0:
                status = "incomplete_recording"
                excluded_incomplete_count += 1
                actual_val = float(act_rec["actual_sales"])
                coverage = float(act_rec["coverage"])
                had_stockout = bool(act_rec["had_stockout"])
                stockout_days = int(act_rec["stockout_days"])
                stockout_pct = float(act_rec["stockout_pct"])
                reason = f"Pencatatan belum lengkap (cakupan {round(coverage * 100)}% < 75% atau mulai di tengah bulan)."
            elif rf_pred is None and base_pred is None:
                status = "no_prediction"
                excluded_no_prediction_count += 1
                actual_val = float(act_rec["actual_sales"])
                coverage = float(act_rec["coverage"])
                had_stockout = bool(act_rec["had_stockout"])
                stockout_days = int(act_rec["stockout_days"])
                stockout_pct = float(act_rec["stockout_pct"])
                reason = "Prediksi belum tersedia karena riwayat SKU saat perencanaan belum cukup."
            else:
                status = "evaluated"
                actual_val = float(act_rec["actual_sales"])
                coverage = float(act_rec["coverage"])
                had_stockout = bool(act_rec["had_stockout"])
                stockout_days = int(act_rec["stockout_days"])
                stockout_pct = float(act_rec["stockout_pct"])
                reason = None
                evaluated_count += 1
                if actual_val == 0:
                    zero_sales_count += 1
                if had_stockout:
                    stockout_count += 1
                if rf_pred is not None:
                    rf_pairs.append((rf_pred, actual_val))
                if base_pred is not None:
                    base_pairs.append((base_pred, actual_val))

            rf_diff = round(rf_pred - actual_val, 2) if (status == "evaluated" and rf_pred is not None and actual_val is not None) else None
            rf_abs = round(abs(rf_diff), 2) if rf_diff is not None else None
            base_diff = round(base_pred - actual_val, 2) if (status == "evaluated" and base_pred is not None and actual_val is not None) else None
            base_abs = round(abs(base_diff), 2) if base_diff is not None else None

            detail_rows.append(
                {
                    "product": prod,
                    "variant": var,
                    "size": sz,
                    "rf_prediction": round(rf_pred, 2) if rf_pred is not None else None,
                    "baseline_6m": round(base_pred, 2) if base_pred is not None else None,
                    "actual": round(actual_val, 2) if actual_val is not None else None,
                    "rf_diff": rf_diff,
                    "rf_abs_error": rf_abs,
                    "baseline_diff": base_diff,
                    "baseline_abs_error": base_abs,
                    "suggested_order": r["suggested_order"],
                    "stock_at_prediction": r["stock_at_prediction"],
                    "status": status,
                    "reason": reason,
                    "coverage": coverage,
                    "had_stockout": had_stockout,
                    "stockout_days": stockout_days,
                    "stockout_pct": stockout_pct,
                }
            )

        # Urutkan: SKU yang dievaluasi dengan selisih absolut terbesar di atas, lalu SKU yang dikecualikan
        detail_rows.sort(
            key=lambda x: (
                0 if x["status"] == "evaluated" else 1,
                -(x["rf_abs_error"] if x["rf_abs_error"] is not None else -1.0),
                x["product"],
                x["variant"],
                x["size"],
            )
        )

        rf_metrics = compute_method_metrics(rf_pairs)
        base_metrics = compute_method_metrics(base_pairs)
        has_actuals = evaluated_count > 0
        season = snap["season"] if snap["season"] in ("biasa", "lebaran") else "biasa"

        is_primary_for_month = target_month not in primary_seen_months
        if is_primary_for_month:
            primary_seen_months.add(target_month)
            if has_actuals:
                overall_months_with_actuals += 1
                overall_rf_pairs.extend(rf_pairs)
                overall_base_pairs.extend(base_pairs)
                season_buckets[season]["months"] += 1
                season_buckets[season]["rf_pairs"].extend(rf_pairs)
                season_buckets[season]["base_pairs"].extend(base_pairs)

        top_errors = [x for x in detail_rows if x["status"] == "evaluated"][:10]
        evaluated_months.append(
            {
                "snapshot_id": snap["id"],
                "target_month": target_month,
                "data_period_end": data_period_end,
                "season": season,
                "model_version": snap["model_version"],
                "source": snap["source"],
                "created_at": snap["created_at"],
                "is_primary": is_primary_for_month,
                "has_actuals": has_actuals,
                "total_snapshot_skus": len(snap_rows),
                "evaluated_count": evaluated_count,
                "zero_sales_count": zero_sales_count,
                "excluded_missing_count": excluded_missing_count,
                "excluded_incomplete_count": excluded_incomplete_count,
                "excluded_no_prediction_count": excluded_no_prediction_count,
                "stockout_count": stockout_count,
                "rf": rf_metrics,
                "baseline_6m": base_metrics,
                "rf_beats_baseline": _rf_beats_baseline(rf_metrics, base_metrics),
                "top_errors": top_errors,
                "rows": detail_rows,
            }
        )

    overall_rf = compute_method_metrics(overall_rf_pairs)
    overall_base = compute_method_metrics(overall_base_pairs)

    by_season = {}
    for s_key in ("biasa", "lebaran"):
        s_rf = compute_method_metrics(season_buckets[s_key]["rf_pairs"])
        s_base = compute_method_metrics(season_buckets[s_key]["base_pairs"])
        by_season[s_key] = {
            "evaluated_months": season_buckets[s_key]["months"],
            "rf": s_rf,
            "baseline_6m": s_base,
            "rf_beats_baseline": _rf_beats_baseline(s_rf, s_base),
        }

    return {
        "research_reference": build_research_reference(model_meta),
        "has_evaluated_months": overall_months_with_actuals > 0,
        "overall": {
            "evaluated_months": overall_months_with_actuals,
            "rf": overall_rf,
            "baseline_6m": overall_base,
            "rf_beats_baseline": _rf_beats_baseline(overall_rf, overall_base),
        },
        "by_season": by_season,
        "months": evaluated_months,
    }
