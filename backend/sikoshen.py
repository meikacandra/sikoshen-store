"""Adapter kartu stok notebook dan kolom prediksi pada skema SQLite Sikoshen."""
import csv
import json
import re
import secrets
import shutil
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from xml.etree.ElementTree import ParseError
from zipfile import BadZipFile

import numpy as np
import openpyxl
import pandas as pd

from evaluation import EVALUATION_SCHEMA
from sikoshen_pipeline import (
    JEDA_MAKS_HARI,
    KUNCI_SKU,
    KOLOM_WAJIB,
    hitung_kalender,
    urut_ukuran,
)

# Posisi kartu stok lebar mengikuti sel pembacaan Excel pada 01-website.ipynb.
KARTU = {
    "Iron Head Ultimate": ("Sheet2", 1, 2, 5),
    "Kemeja Denim": ("Sheet1", 1, 3, 5),
    "Tony Jack Biasa": ("Sheet1", 2, 4, 4),
}


def baca_excel(file):
    with closing(openpyxl.load_workbook(file, read_only=True, data_only=True)) as wb:
        first = wb.worksheets[0].values
        header = next(first, ())
        if "Jenis_Produk" in header:
            return pd.DataFrame(first, columns=header)
        for produk, (sheet, var, size, start) in KARTU.items():
            if sheet not in wb:
                continue
            rows = iter(wb[sheet].values)
            next(rows, None)
            header = next(rows, ())
            if len(header) <= var or str(header[var]).strip().casefold() != produk.casefold():
                continue
            cols = []
            for i, value in enumerate(header):
                name = str(value).lower().strip()
                if name.startswith("jumlah"):
                    date = re.search(r"(\d+)/(\d+)/(\d+)", name)
                    if not date:
                        raise ValueError("Tanggal pada kolom Jumlah tidak terbaca.")
                    day, month, year = date.groups()
                    cols.append((i, "stok", f"{int(day)}/{int(month)}/{year[-2:]}"))
                elif "masuk" in name or "keluar" in name:
                    cols.append((i, "masuk" if "masuk" in name else "keluar", None))
            for _ in range(3, start):
                next(rows, None)
            records = []
            variant = None
            for row in rows:
                if row[var] is not None:
                    variant = str(row[var]).strip()
                if row[size] is None:
                    continue
                ukuran = row[size]
                if isinstance(ukuran, float) and ukuran.is_integer():
                    ukuran = int(ukuran)
                ukuran = str(ukuran).strip()
                incoming = outgoing = 0
                previous = None
                for i, kind, date in cols:
                    value = row[i]
                    if kind == "masuk":
                        incoming += float(value or 0)
                    elif kind == "keluar":
                        outgoing += float(value or 0)
                    elif value is not None:
                        if previous is None:
                            opening, received, sold, adjustment = value, 0, 0, 0
                        else:
                            opening, received, sold = 0, incoming, outgoing
                            adjustment = value - (previous + incoming - outgoing)
                        records.append((produk, variant, ukuran, date, received, sold,
                                        value, opening, adjustment))
                        previous = value
                        incoming = outgoing = 0
            daily = pd.DataFrame(records, columns=KOLOM_WAJIB + ["Saldo_Awal", "Penyesuaian_Opname"])
            return daily.groupby(KUNCI_SKU + ["Tanggal_dt"], as_index=False, sort=False).agg(
                Barang_Masuk=("Barang_Masuk", "sum"), Barang_Keluar=("Barang_Keluar", "sum"),
                Saldo_Awal=("Saldo_Awal", "sum"), Penyesuaian_Opname=("Penyesuaian_Opname", "sum"),
                Stok_Akhir=("Stok_Akhir", "last"))
    raise ValueError("Format Excel belum dikenali. Pilih kartu stok asli atau tabel harian.")


def baca_harian(filename, file):
    suffix = Path(filename).suffix.lower()
    if suffix == ".csv":
        try:
            if hasattr(file, "seek"):
                file.seek(0)
            sample = file.read(4096)
            if isinstance(sample, bytes):
                sample_text = sample.decode("utf-8-sig", errors="ignore")
            else:
                sample_text = str(sample)
            if hasattr(file, "seek"):
                file.seek(0)
            first_line = sample_text.splitlines()[0] if sample_text else ""
            sep = ";" if (";" in first_line and "," not in first_line) else ","
            data = pd.read_csv(file, sep=sep, encoding="utf-8-sig", dtype=str)
        except (csv.Error, UnicodeError, pd.errors.ParserError, pd.errors.EmptyDataError, IndexError) as err:
            raise ValueError("CSV tidak terbaca. Gunakan UTF-8 dan baris judul kolom.") from err
    elif suffix == ".xlsx":
        try:
            data = baca_excel(file)
        except (BadZipFile, ParseError, KeyError, IndexError, TypeError, openpyxl.utils.exceptions.InvalidFileException) as err:
            raise ValueError("Berkas Excel rusak atau format kartu stok tidak sesuai.") from err
    else:
        raise ValueError("Pilih berkas .csv atau .xlsx.")
    data.columns = [str(col).strip() for col in data.columns]
    for old, new in [("Tanggal", "Tanggal_dt"), ("Varian Warna", "Varian")]:
        if new not in data and old in data:
            data = data.rename(columns={old: new})
    missing = sorted(set(KOLOM_WAJIB) - set(data))
    if missing:
        raise ValueError("Kolom belum lengkap: " + ", ".join(missing))
    balance_cols = [col for col in ("Saldo_Awal", "Penyesuaian_Opname") if col in data]
    if len(balance_cols) == 1:
        raise ValueError("Sertakan Saldo_Awal dan Penyesuaian_Opname bersama-sama.")
    data = data[KOLOM_WAJIB + balance_cols].copy()
    if data.empty:
        raise ValueError("Kartu stok tidak berisi baris harian.")
    for col in KUNCI_SKU:
        data[col] = data[col].astype("string")
        if data[col].isna().any() or data[col].str.strip().eq("").any():
            raise ValueError(f"Kolom {col} memiliki nilai kosong.")
    data["Ukuran"] = data["Ukuran"].str.strip().str.replace(r"^(\d+)\.0+$", r"\1", regex=True)
    try:
        data["Ukuran"].map(urut_ukuran)
    except (ValueError, OverflowError) as err:
        raise ValueError("Gunakan ukuran angka atau M sampai XXXXL.") from err
    dates = data["Tanggal_dt"].astype("string").str.strip()
    iso = dates.str.match(r"^\d{4}-", na=False)
    dmy_short = dates.str.match(r"^\d{1,2}/\d{1,2}/\d{2}$", na=False)
    parsed = pd.to_datetime(dates.where(iso), format="ISO8601", errors="coerce")
    parsed = parsed.fillna(pd.to_datetime(dates.where(dmy_short), format="%d/%m/%y", errors="coerce"))
    parsed = parsed.fillna(pd.to_datetime(dates.where(~iso & ~dmy_short), format="mixed", dayfirst=True, errors="coerce"))
    if parsed.isna().any():
        raise ValueError("Periksa tanggal pada kartu stok. Gunakan tanggal Indonesia atau YYYY-MM-DD.")
    data["Tanggal_dt"] = parsed.dt.normalize()
    for col in ["Barang_Masuk", "Barang_Keluar", "Stok_Akhir", *balance_cols]:
        vals = data[col]
        if isinstance(vals.dtype, pd.StringDtype) or vals.dtype == object:
            vals = vals.astype("string").str.strip().replace("", pd.NA)
        if col in ("Barang_Masuk", "Barang_Keluar"):
            vals = vals.fillna("0")
        elif col == "Stok_Akhir" and vals.isna().any() and not vals.isna().all():
            # Tangani baris Stok_Akhir kosong pada berkas CSV hasil ekspor lama
            vals = vals.groupby([data[k] for k in KUNCI_SKU]).ffill().fillna("0")
        vals = pd.to_numeric(vals, errors="coerce").astype(float)
        if not np.isfinite(vals).all():
            raise ValueError(f"Kolom {col} harus berisi jumlah unit yang valid.")
        data[col] = vals
    if data.duplicated(KUNCI_SKU + ["Tanggal_dt"]).any():
        agg_spec = {
            "Barang_Masuk": ("Barang_Masuk", "sum"),
            "Barang_Keluar": ("Barang_Keluar", "sum"),
            "Stok_Akhir": ("Stok_Akhir", "last"),
        }
        for bcol in balance_cols:
            agg_spec[bcol] = (bcol, "sum")
        data = data.groupby(KUNCI_SKU + ["Tanggal_dt"], as_index=False, sort=False).agg(**agg_spec)
    return data


def clean_size(value) -> str:
    """Normalisasi nilai ukuran menjadi string bersih tanpa akhiran '.0'."""
    text = str(value).strip()
    return text[:-2] if text.endswith(".0") else text


def _audit_stock_balance(daily: pd.DataFrame) -> tuple[int, int]:
    """Hitung (baris_cocok, total_baris_audit) untuk rumus stok kemarin + saldo awal + masuk - keluar + opname."""
    data = daily.sort_values(KUNCI_SKU + ["Tanggal_dt"])
    previous = data.groupby(KUNCI_SKU)["Stok_Akhir"].shift().fillna(0)
    expected = (
        previous
        + data["Saldo_Awal"]
        + data["Barang_Masuk"]
        - data["Barang_Keluar"]
        + data["Penyesuaian_Opname"]
    )
    audit = data["Saldo_Awal"].notna() & data["Penyesuaian_Opname"].notna()
    total = int(audit.sum())
    if total == 0:
        return 0, 0
    matched = int(np.isclose(data.loc[audit, "Stok_Akhir"], expected[audit]).sum())
    return matched, total


def periksa_saldo(daily):
    # Tabel backend tujuh kolom sudah merupakan input model. Untuk kartu stok
    # lengkap, terapkan pemeriksaan rekonsiliasi yang sama dengan sel 2 notebook.
    if "Saldo_Awal" not in daily:
        return
    matched, total = _audit_stock_balance(daily)
    if total > 0 and (matched / total) <= 0.999:
        raise ValueError("Rumus stok tidak cocok. Periksa saldo awal dan penyesuaian opname.")


def summarize_daily_history(daily, ramadan, file_summaries):
    """Ringkas hasil validasi riwayat harian & agregasi penjualan bulanan dari data unggahan."""
    total_rows = int(len(daily))
    total_skus = int(daily.groupby(KUNCI_SKU).ngroups)

    neg_mask = daily["Stok_Akhir"] < 0
    neg_rows = int(neg_mask.sum())
    neg_skus = int(daily.loc[neg_mask, KUNCI_SKU].drop_duplicates().shape[0]) if neg_rows else 0

    balance_checked = "Saldo_Awal" in daily.columns and "Penyesuaian_Opname" in daily.columns
    balance_match_count = 0
    balance_total_count = 0
    opname_events = 0
    opname_skus = 0
    opname_plus = 0
    opname_minus = 0

    if balance_checked:
        balance_match_count, balance_total_count = _audit_stock_balance(daily)
        opname = daily["Penyesuaian_Opname"].fillna(0)
        op_mask = opname != 0
        opname_events = int(op_mask.sum())
        if opname_events:
            opname_skus = int(daily.loc[op_mask, KUNCI_SKU].drop_duplicates().shape[0])
            opname_plus = int(round(float(opname[opname > 0].sum())))
            opname_minus = int(round(float(opname[opname < 0].sum())))

    # Jeda tidak tercatat mengikuti aturan bangun_panel() di sikoshen_pipeline.py (> JEDA_MAKS_HARI)
    unrecorded_periods = []
    for produk, g in daily.groupby("Jenis_Produk"):
        tgl = pd.Series(sorted(g["Tanggal_dt"].unique()))
        for i in range(1, len(tgl)):
            gap_days = int((tgl[i] - tgl[i - 1]).days)
            if gap_days > JEDA_MAKS_HARI:
                dari = (tgl[i - 1] + pd.Timedelta(days=1)).date().isoformat()
                sampai = (tgl[i] - pd.Timedelta(days=1)).date().isoformat()
                lama_hari = int((tgl[i] - tgl[i - 1]).days - 1)
                unrecorded_periods.append({
                    "produk": str(produk),
                    "dari": dari,
                    "sampai": sampai,
                    "lama_hari": lama_hari,
                })
    unrecorded_periods.sort(key=lambda item: (-item["lama_hari"], item["produk"], item["dari"]))

    validation = {
        "total_rows": total_rows,
        "total_skus": total_skus,
        "period_start": daily["Tanggal_dt"].min().date().isoformat(),
        "period_end": daily["Tanggal_dt"].max().date().isoformat(),
        "files": file_summaries,
        "balance_checked": balance_checked,
        "balance_match_count": balance_match_count,
        "balance_total_count": balance_total_count,
        "negative_stock_rows": neg_rows,
        "negative_stock_skus": neg_skus,
        "opname_events": opname_events,
        "opname_skus": opname_skus,
        "opname_plus": opname_plus,
        "opname_minus": opname_minus,
        "unrecorded_periods": unrecorded_periods,
    }

    # Penjualan bulanan per produk + penanda bulan Ramadan dari kalender model
    bulan_awal = daily["Tanggal_dt"].min().to_period("M")
    bulan_akhir = daily["Tanggal_dt"].max().to_period("M")
    semua_bulan = pd.period_range(bulan_awal, bulan_akhir, freq="M")
    kalender = hitung_kalender(semua_bulan, ramadan).set_index("Bulan")

    tmp = daily.assign(Bulan=daily["Tanggal_dt"].dt.to_period("M"))
    pivot = (tmp.groupby(["Bulan", "Jenis_Produk"])["Barang_Keluar"]
             .sum()
             .unstack(fill_value=0)
             .reindex(semua_bulan, fill_value=0))

    monthly_sales = []
    for b in semua_bulan:
        row_vals = pivot.loc[b] if b in pivot.index else pd.Series(dtype=float)
        ihu = int(round(float(row_vals.get("Iron Head Ultimate", 0.0))))
        denim = int(round(float(row_vals.get("Kemeja Denim", 0.0))))
        tjb = int(round(float(row_vals.get("Tony Jack Biasa", 0.0))))
        totals = {str(col): int(round(float(val))) for col, val in row_vals.items()}
        monthly_sales.append({
            "ym": str(b),
            "ihu": ihu,
            "denim": denim,
            "tjb": tjb,
            "totals": totals,
            "ramadan": bool(kalender.loc[b, "Porsi_Ramadan"] > 0),
        })

    return validation, monthly_sales


def normalize_result_records(records):
    """Normalisasi record hasil model.prediksi() menjadi nilai JSON-safe tanpa NaN."""
    normalized = []
    for rec in records:
        pred = None if pd.isna(rec["Prediksi_Penjualan"]) else float(rec["Prediksi_Penjualan"])
        rmse = None if pd.isna(rec["RMSE_SKU"]) else float(rec["RMSE_SKU"])
        sp = None if pd.isna(rec["Stok_Pengaman"]) else int(rec["Stok_Pengaman"])
        saran = None if pd.isna(rec["Saran_Pesan"]) else int(rec["Saran_Pesan"])
        normalized.append({
            "Jenis_Produk": str(rec["Jenis_Produk"]),
            "Varian": str(rec["Varian"]),
            "Ukuran": str(rec["Ukuran"]).strip(),
            "Label": str(rec["Label"]),
            "Stok_Saat_Ini": int(rec["Stok_Saat_Ini"]),
            "Prediksi_Penjualan": pred,
            "RMSE_SKU": rmse,
            "Stok_Pengaman": sp,
            "Saran_Pesan": saran,
            "Bulan": str(rec["Bulan"]),
            "Musim": str(rec["Musim"]),
        })
    return normalized


def _count_by_product(sku_keys):
    counts = {}
    for product, _, _ in sku_keys:
        counts[product] = counts.get(product, 0) + 1
    return dict(sorted(counts.items()))


def _sort_sku_key(key):
    product, variant, size = key
    try:
        size_order = urut_ukuran(size)
    except Exception:
        size_order = 9999
    return (product, variant, size_order, size)


def build_import_comparison(current_forecast, current_validation, candidate_records, candidate_validation, source):
    """Bandingkan identitas SKU (Jenis_Produk, Varian, Ukuran) antara hasil aktif & calon impor."""
    candidate_keys = {
        (str(r["Jenis_Produk"]), str(r["Varian"]), str(r["Ukuran"]).strip())
        for r in candidate_records
    }
    candidate_counts = _count_by_product(candidate_keys)
    cand_pred_month = str(candidate_records[0]["Bulan"]) if candidate_records else ""
    cand_season = str(candidate_records[0]["Musim"]) if candidate_records else "biasa"
    cand_total_pred = int(sum(round(float(r["Prediksi_Penjualan"])) for r in candidate_records if r["Prediksi_Penjualan"] is not None))
    cand_total_order = int(sum(int(r["Saran_Pesan"]) for r in candidate_records if r["Saran_Pesan"] is not None))
    cand_total_stock = int(sum(int(r["Stok_Saat_Ini"]) for r in candidate_records))

    candidate_summary = {
        "source": source,
        "period_start": candidate_validation["period_start"],
        "period_end": candidate_validation["period_end"],
        "prediction_month": cand_pred_month,
        "season": cand_season,
        "daily_rows": candidate_validation["total_rows"],
        "total_skus": len(candidate_keys),
        "product_counts": candidate_counts,
        "total_predicted": cand_total_pred,
        "total_stock": cand_total_stock,
        "total_order": cand_total_order,
        "files": candidate_validation["files"],
    }

    if current_forecast is None:
        product_rows = [
            {
                "product": prod,
                "current_count": 0,
                "candidate_count": candidate_counts[prod],
                "missing_count": 0,
                "added_count": candidate_counts[prod],
                "status": "baru",
            }
            for prod in sorted(candidate_counts)
        ]
        return {
            "is_first_import": True,
            "has_scope_reduction": False,
            "requires_extra_confirmation": False,
            "current": None,
            "candidate": candidate_summary,
            "retained_sku_count": 0,
            "missing_sku_count": 0,
            "added_sku_count": len(candidate_keys),
            "missing_products": [],
            "affected_products": [],
            "product_breakdown": product_rows,
            "missing_skus": [],
            "added_skus": [
                {"product": p, "variant": v, "size": s}
                for p, v, s in sorted(candidate_keys, key=_sort_sku_key)
            ],
        }

    current_rows = current_forecast["rows"]
    current_keys = {
        (str(r["product"]), str(r["variant"]), str(r["size"]).strip())
        for r in current_rows
    }
    current_counts = _count_by_product(current_keys)
    cur_pred_month = str(current_rows[0]["prediction_month"]) if current_rows else ""
    cur_total_pred = int(sum(round(float(r["predicted_next_month"])) for r in current_rows if r["predicted_next_month"] is not None))
    cur_total_order = int(sum(int(r["suggested_order"]) for r in current_rows if r["suggested_order"] is not None))
    cur_total_stock = int(sum(int(r["stock"]) for r in current_rows))

    current_summary = {
        "source": current_forecast["source"],
        "period_start": current_validation["period_start"] if current_validation else None,
        "period_end": current_forecast["period_end"],
        "prediction_month": cur_pred_month,
        "season": current_forecast["season"],
        "daily_rows": current_forecast.get("daily_rows"),
        "total_skus": len(current_keys),
        "product_counts": current_counts,
        "total_predicted": cur_total_pred,
        "total_stock": cur_total_stock,
        "total_order": cur_total_order,
    }

    missing_keys = sorted(current_keys - candidate_keys, key=_sort_sku_key)
    added_keys = sorted(candidate_keys - current_keys, key=_sort_sku_key)
    retained_count = len(current_keys & candidate_keys)

    missing_by_prod = _count_by_product(missing_keys)
    added_by_prod = _count_by_product(added_keys)
    all_products = sorted(set(current_counts) | set(candidate_counts))

    missing_products = [p for p in sorted(current_counts) if candidate_counts.get(p, 0) == 0]
    product_breakdown = []
    affected_products = []
    for prod in all_products:
        cur_c = current_counts.get(prod, 0)
        cand_c = candidate_counts.get(prod, 0)
        miss_c = missing_by_prod.get(prod, 0)
        add_c = added_by_prod.get(prod, 0)
        if cur_c > 0 and cand_c == 0:
            status = "hilang"
        elif miss_c > 0:
            status = "berkurang"
        elif cur_c == 0 and cand_c > 0:
            status = "baru"
        elif add_c > 0:
            status = "bertambah"
        else:
            status = "tetap"
        item = {
            "product": prod,
            "current_count": cur_c,
            "candidate_count": cand_c,
            "missing_count": miss_c,
            "added_count": add_c,
            "status": status,
        }
        product_breakdown.append(item)
        if miss_c > 0:
            affected_products.append(item)

    has_scope_reduction = len(missing_keys) > 0 or len(missing_products) > 0

    return {
        "is_first_import": False,
        "has_scope_reduction": has_scope_reduction,
        "requires_extra_confirmation": has_scope_reduction,
        "current": current_summary,
        "candidate": candidate_summary,
        "retained_sku_count": retained_count,
        "missing_sku_count": len(missing_keys),
        "added_sku_count": len(added_keys),
        "missing_products": missing_products,
        "affected_products": affected_products,
        "product_breakdown": product_breakdown,
        "missing_skus": [{"product": p, "variant": v, "size": s} for p, v, s in missing_keys],
        "added_skus": [{"product": p, "variant": v, "size": s} for p, v, s in added_keys],
    }


def build_product_catalog(master_records):
    """Susun daftar produk, varian, dan ukuran terurut langsung dari sku_master model."""
    by_product = {}
    for rec in master_records:
        produk = str(rec["Jenis_Produk"])
        varian = str(rec["Varian"])
        ukuran = clean_size(rec["Ukuran"])
        entry = by_product.setdefault(produk, {"variants": set(), "sizes": set()})
        entry["variants"].add(varian)
        entry["sizes"].add(ukuran)

    catalog = []
    for produk in sorted(by_product):
        variants = sorted(by_product[produk]["variants"])
        sizes = sorted(by_product[produk]["sizes"], key=urut_ukuran)
        catalog.append({"name": produk, "variants": variants, "sizes": sizes})
    return catalog


def build_attention_rows(master_records):
    """Hitung daftar SKU Perlu Perhatian langsung dari sku_master model (tanpa daftar statis)."""
    rows = []
    for rec in master_records:
        peluang = float(rec["Peluang_Fast"])
        is_fast = str(rec["Label"]) == "Fast-Moving"
        pred_fast = peluang >= 0.5
        if pred_fast == is_fast:
            continue
        terjual = int(round(float(rec["Total_Keluar"])))
        median = int(round(float(rec["Threshold_Median"])))
        dekat_median = (abs(float(rec["Total_Keluar"]) - float(rec["Threshold_Median"])) / float(rec["Threshold_Median"]) < 0.10) if float(rec["Threshold_Median"]) > 0 else False
        temuan = "Lebih laku dari pola" if is_fast else "Kurang laku dari pola"
        tindakan = "Pertahankan stok; ini pengecualian." if is_fast else "Cek apakah sering kosong."
        ukuran = clean_size(rec["Ukuran"])
        rows.append({
            "produk": str(rec["Jenis_Produk"]),
            "varian": str(rec["Varian"]),
            "ukuran": ukuran,
            "terjual": terjual,
            "median": median,
            "label": "Fast" if is_fast else "Slow",
            "peluang": round(peluang, 4),
            "temuan": temuan,
            "dekat_median": dekat_median,
            "tindakan": tindakan,
        })
    # Urutkan: "Lebih laku dari pola" (peluang terendah dulu), lalu "Kurang laku dari pola" (peluang tertinggi dulu)
    rows.sort(key=lambda r: (0 if r["label"] == "Fast" else 1, r["peluang"] if r["label"] == "Fast" else -r["peluang"]))
    return rows


def recalculate_orders(forecast_data, z=None, cap=None, default_z=1.65, model=None, daily=None):
    """Hitung ulang stok pengaman (Z * RMSE_SKU), saran pesan, dan batas unit terpusat di backend."""
    if z is None and cap is None:
        return forecast_data

    effective_z = float(default_z if z is None else z)
    rows = [dict(r) for r in forecast_data["rows"]]

    if abs(effective_z - float(default_z)) > 1e-9:
        if daily is not None and model is not None:
            recomputed = model.prediksi(daily, z_layanan=effective_z)
            rows = []
            for rec in recomputed.to_dict("records"):
                pred = None if pd.isna(rec["Prediksi_Penjualan"]) else float(rec["Prediksi_Penjualan"])
                rmse = None if pd.isna(rec["RMSE_SKU"]) else float(rec["RMSE_SKU"])
                sp = None if pd.isna(rec["Stok_Pengaman"]) else int(rec["Stok_Pengaman"])
                saran = None if pd.isna(rec["Saran_Pesan"]) else int(rec["Saran_Pesan"])
                rows.append({
                    "product": str(rec["Jenis_Produk"]),
                    "variant": str(rec["Varian"]),
                    "size": str(rec["Ukuran"]),
                    "label": "fast" if rec["Label"] == "Fast-Moving" else "slow",
                    "stock": int(rec["Stok_Saat_Ini"]),
                    "predicted_next_month": pred,
                    "safety_stock": sp,
                    "suggested_order": saran,
                    "prediction_month": str(rec["Bulan"]),
                    "rmse_sku": rmse,
                })
        else:
            for r in rows:
                rmse = r.get("rmse_sku")
                pred = r.get("predicted_next_month")
                if rmse is not None:
                    sp = int(np.ceil(effective_z * float(rmse)))
                elif r.get("safety_stock") is not None:
                    sp = int(np.ceil(float(r["safety_stock"]) * effective_z / float(default_z)))
                else:
                    sp = None
                r["safety_stock"] = sp
                if pred is None or sp is None:
                    r["suggested_order"] = None
                else:
                    r["suggested_order"] = int(np.ceil(max(0.0, float(pred) + sp - float(r["stock"]))))

    rows.sort(
        key=lambda r: (
            -(r["suggested_order"] if r["suggested_order"] is not None else -1),
            -(r["predicted_next_month"] if r["predicted_next_month"] is not None else -1),
            r["product"],
            r["variant"],
            r["size"],
        )
    )

    if cap is not None and cap > 0:
        remaining = int(cap)
        for r in rows:
            saran = r["suggested_order"]
            if saran is None:
                continue
            if remaining <= 0 or saran <= 0:
                r["suggested_order"] = 0
            else:
                alloc = min(int(saran), remaining)
                remaining -= alloc
                r["suggested_order"] = alloc

    return {**forecast_data, "rows": rows, "z": effective_z, "cap": cap}


# Skema penyimpanan SQLite untuk hasil prediksi, metadata, pratinjau, dan pemulihan.
SCHEMA = """
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS sku_profiles (
    id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id),
    variant TEXT NOT NULL, size TEXT NOT NULL, label TEXT NOT NULL, stock INTEGER NOT NULL,
    predicted_next_month REAL, rmse_sku REAL, safety_stock INTEGER, suggested_order INTEGER,
    prediction_month TEXT NOT NULL, UNIQUE(product_id, variant, size)
);
CREATE TABLE IF NOT EXISTS forecast_run (
    id INTEGER PRIMARY KEY CHECK(id=1), source TEXT NOT NULL, period_end TEXT NOT NULL,
    daily_rows INTEGER NOT NULL, season TEXT NOT NULL, model_version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS forecast_meta (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS import_previews (
    preview_id TEXT PRIMARY KEY,
    base_revision TEXT NOT NULL,
    source TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    daily_rows INTEGER NOT NULL,
    season TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prediction_month TEXT NOT NULL,
    results_json TEXT NOT NULL,
    validation_json TEXT NOT NULL,
    monthly_sales_json TEXT NOT NULL,
    comparison_json TEXT NOT NULL,
    daily_pickle_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
""" + EVALUATION_SCHEMA


def database(path):
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def save_meta(conn, key, value):
    if value is None:
        conn.execute("DELETE FROM forecast_meta WHERE key=?", (key,))
        return
    conn.execute(
        "INSERT OR REPLACE INTO forecast_meta(key, value_json) VALUES (?, ?)",
        (key, json.dumps(value, ensure_ascii=False)),
    )


def read_meta(conn, key):
    row = conn.execute("SELECT value_json FROM forecast_meta WHERE key=?", (key,)).fetchone()
    if row is None:
        return None
    return json.loads(row["value_json"])


def get_active_revision(conn) -> str:
    rev = read_meta(conn, "active_revision")
    if rev:
        return str(rev)
    run = conn.execute("SELECT source, period_end, daily_rows, model_version FROM forecast_run").fetchone()
    if run is None:
        return "empty"
    rev = f"init-{secrets.token_hex(8)}"
    save_meta(conn, "active_revision", rev)
    return rev


def bump_active_revision(conn) -> str:
    rev = secrets.token_hex(12)
    save_meta(conn, "active_revision", rev)
    return rev


def save_forecast(conn, results, source, period_end, count, version):
    conn.execute("DELETE FROM sku_profiles")
    conn.execute("DELETE FROM products")
    names = sorted({r["Jenis_Produk"] for r in results})
    conn.executemany("INSERT INTO products(name) VALUES (?)", [(n,) for n in names])
    ids = {r["name"]: r["id"] for r in conn.execute("SELECT * FROM products")}
    conn.executemany("""
        INSERT INTO sku_profiles(product_id,variant,size,label,stock,predicted_next_month,
            rmse_sku,safety_stock,suggested_order,prediction_month) VALUES (?,?,?,?,?,?,?,?,?,?)
    """, [(ids[r["Jenis_Produk"]], r["Varian"], str(r["Ukuran"]),
           "fast" if r["Label"] == "Fast-Moving" else "slow", r["Stok_Saat_Ini"],
           r["Prediksi_Penjualan"], r["RMSE_SKU"], r["Stok_Pengaman"], r["Saran_Pesan"], r["Bulan"])
          for r in results])
    conn.execute("INSERT OR REPLACE INTO forecast_run VALUES (1,?,?,?,?,?)",
                 (source, period_end, count, results[0]["Musim"], version))


def read_forecast(conn):
    row = conn.execute("SELECT * FROM forecast_run").fetchone()
    if row is None:
        return None
    run = dict(row)
    rows = conn.execute("""
        SELECT p.name AS product, s.variant, s.size, s.label, s.stock, s.predicted_next_month,
               s.safety_stock, s.suggested_order, s.prediction_month, s.rmse_sku
        FROM sku_profiles s JOIN products p ON s.product_id = p.id
        ORDER BY s.suggested_order DESC, p.name, s.variant, s.size
    """)
    return {**run, "daily_rows": run["daily_rows"] or None, "rows": [dict(r) for r in rows]}


def backup_active_snapshot(conn, daily_path: Path, backup_daily_path: Path):
    """Simpan snapshot lengkap hasil aktif sebelum diganti (untuk fitur Pulihkan Hasil Sebelumnya)."""
    current = read_forecast(conn)
    if current is None:
        return None

    has_daily_cache = daily_path.exists()
    if has_daily_cache:
        shutil.copy2(daily_path, backup_daily_path)
    elif backup_daily_path.exists():
        backup_daily_path.unlink(missing_ok=True)

    sku_keys = {(r["product"], r["variant"], str(r["size"])) for r in current["rows"]}
    snapshot = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "forecast": current,
        "validation": read_meta(conn, "validation"),
        "monthly_sales": read_meta(conn, "monthly_sales"),
        "has_daily_cache": has_daily_cache,
        "summary": {
            "source": current["source"],
            "period_end": current["period_end"],
            "prediction_month": current["rows"][0]["prediction_month"] if current["rows"] else "",
            "season": current["season"],
            "total_skus": len(sku_keys),
            "product_counts": _count_by_product(sku_keys),
        },
    }
    save_meta(conn, "previous_snapshot", snapshot)
    return snapshot


def read_restore_info(conn):
    snapshot = read_meta(conn, "previous_snapshot")
    if not snapshot:
        return None
    return {
        "available": True,
        "saved_at": snapshot["saved_at"],
        **snapshot["summary"],
    }


def restore_previous_snapshot(conn, daily_path: Path, backup_daily_path: Path):
    """Pulihkan hasil aktif sebelumnya secara utuh (prediksi, metadata validasi, tren bulanan, dan riwayat harian)."""
    snapshot = read_meta(conn, "previous_snapshot")
    if not snapshot:
        return None

    fc = snapshot["forecast"]
    records = [
        {
            "Jenis_Produk": r["product"],
            "Varian": r["variant"],
            "Ukuran": str(r["size"]),
            "Label": "Fast-Moving" if r["label"] == "fast" else "Slow-Moving",
            "Stok_Saat_Ini": r["stock"],
            "Prediksi_Penjualan": r["predicted_next_month"],
            "RMSE_SKU": r["rmse_sku"],
            "Stok_Pengaman": r["safety_stock"],
            "Saran_Pesan": r["suggested_order"],
            "Bulan": r["prediction_month"],
            "Musim": fc["season"],
        }
        for r in fc["rows"]
    ]
    save_forecast(
        conn,
        records,
        fc["source"],
        fc["period_end"],
        fc["daily_rows"] or 0,
        fc["model_version"],
    )
    save_meta(conn, "validation", snapshot.get("validation"))
    save_meta(conn, "monthly_sales", snapshot.get("monthly_sales"))
    save_meta(conn, "previous_snapshot", None)

    if snapshot.get("has_daily_cache") and backup_daily_path.exists():
        shutil.move(str(backup_daily_path), str(daily_path))
    else:
        daily_path.unlink(missing_ok=True)
        backup_daily_path.unlink(missing_ok=True)

    bump_active_revision(conn)
    return read_forecast(conn)


def save_import_preview(
    conn,
    *,
    preview_id: str,
    base_revision: str,
    source: str,
    period_start: str,
    period_end: str,
    daily_rows: int,
    season: str,
    model_version: str,
    prediction_month: str,
    results: list[dict],
    validation: dict,
    monthly_sales: list[dict],
    comparison: dict,
    daily_pickle_path: Path,
):
    conn.execute(
        """
        INSERT INTO import_previews (
            preview_id, base_revision, source, period_start, period_end, daily_rows,
            season, model_version, prediction_month, results_json, validation_json,
            monthly_sales_json, comparison_json, daily_pickle_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            preview_id,
            base_revision,
            source,
            period_start,
            period_end,
            daily_rows,
            season,
            model_version,
            prediction_month,
            json.dumps(results, ensure_ascii=False),
            json.dumps(validation, ensure_ascii=False),
            json.dumps(monthly_sales, ensure_ascii=False),
            json.dumps(comparison, ensure_ascii=False),
            str(daily_pickle_path),
            int(time.time()),
        ),
    )


def read_import_preview(conn, preview_id: str):
    row = conn.execute("SELECT * FROM import_previews WHERE preview_id=?", (preview_id,)).fetchone()
    if row is None:
        return None
    item = dict(row)
    item["results"] = json.loads(item["results_json"])
    item["validation"] = json.loads(item["validation_json"])
    item["monthly_sales"] = json.loads(item["monthly_sales_json"])
    item["comparison"] = json.loads(item["comparison_json"])
    return item


def delete_import_preview(conn, preview_id: str) -> bool:
    row = conn.execute(
        "SELECT daily_pickle_path FROM import_previews WHERE preview_id=?",
        (preview_id,),
    ).fetchone()
    if row is None:
        return False
    conn.execute("DELETE FROM import_previews WHERE preview_id=?", (preview_id,))
    Path(row["daily_pickle_path"]).unlink(missing_ok=True)
    return True
