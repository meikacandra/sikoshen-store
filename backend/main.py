"""Website lokal untuk model dari notebooks/01-website.ipynb."""
import os
import secrets
import shutil
from contextlib import asynccontextmanager, closing
from pathlib import Path

import pandas as pd
from fastapi import Cookie, Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from evaluation import (
    compute_baseline_6m_map,
    evaluate_monthly_predictions,
    save_actual_monthly_sales,
    save_prediction_snapshot,
)
from sikoshen import (
    SCHEMA,
    baca_harian,
    backup_active_snapshot,
    build_attention_rows,
    build_import_comparison,
    build_product_catalog,
    bump_active_revision,
    clean_size,
    database,
    delete_import_preview,
    get_active_revision,
    normalize_result_records,
    periksa_saldo,
    read_forecast,
    read_import_preview,
    read_meta,
    read_restore_info,
    recalculate_orders,
    restore_previous_snapshot,
    save_forecast,
    save_import_preview,
    save_meta,
    summarize_daily_history,
)
import research_metrics
from sikoshen_pipeline import KUNCI_SKU, bangun_label_sku, muat_model, siapkan_harian

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("SIKOSHEN_DB", ROOT / "website.sqlite3"))
MODEL_PATH = ROOT / "models" / "rf_sikoshen.pkl"


def daily_cache_path() -> Path:
    return DB_PATH.with_suffix(".daily.pkl")


def backup_daily_cache_path() -> Path:
    return DB_PATH.with_suffix(".backup.daily.pkl")


def preview_daily_path(preview_id: str) -> Path:
    return DB_PATH.parent / f"{DB_PATH.stem}.preview-{preview_id}.pkl"


def _ramadan_max_year(ramadan) -> int:
    ranges = list(ramadan.values()) if isinstance(ramadan, dict) else [tuple(r) for r in ramadan]
    return max(int(pd.Timestamp(end).year) for _, end in ranges)


def _master_records(model) -> list[dict]:
    master = model.bundle.get("sku_master", [])
    if isinstance(master, pd.DataFrame):
        return master.to_dict("records")
    return list(master)


def _parse_and_predict_upload(files: list[UploadFile], model):
    """Jalankan parser, validasi, pemeriksaan saldo, dan pipeline prediksi yang sudah ada."""
    if not files:
        raise HTTPException(422, "Pilih minimal satu berkas kartu stok (.xlsx atau .csv).")
    frames = []
    names = []
    file_summaries = []
    for file in files:
        name = Path(file.filename or "").name
        try:
            frame = baca_harian(name, file.file)
        except (ValueError, OverflowError) as err:
            raise HTTPException(422, f"{name}: {err}") from err
        frames.append(frame)
        names.append(name)
        file_summaries.append({
            "name": name,
            "products": sorted(str(p) for p in frame["Jenis_Produk"].unique()),
            "sku_count": int(frame.groupby(KUNCI_SKU).ngroups),
            "period_start": frame["Tanggal_dt"].min().date().isoformat(),
            "period_end": frame["Tanggal_dt"].max().date().isoformat(),
            "rows": int(len(frame)),
        })
    daily = pd.concat(frames, ignore_index=True)
    if daily.duplicated(KUNCI_SKU + ["Tanggal_dt"]).any():
        raise HTTPException(422, "Ada SKU dan tanggal yang tercatat dua kali. Periksa berkas yang dipilih.")
    if not daily[["Barang_Masuk", "Barang_Keluar", "Stok_Akhir"]].ne(0).any().any():
        raise HTTPException(422, "Riwayat belum memuat SKU aktif.")
    try:
        periksa_saldo(daily)
        result = model.prediksi(daily)
    except ValueError as err:
        raise HTTPException(422, str(err)) from err

    validation, monthly_sales = summarize_daily_history(daily, model.ramadan, file_summaries)
    records = normalize_result_records(result.to_dict("records"))
    source = ", ".join(names)
    return daily, records, validation, monthly_sales, source


SAMPLE_DIR = ROOT / "sample_files"
SEED_SOURCE = "Kartu stok asli (data awal)"


def _seed_enabled() -> bool:
    return os.environ.get("SIKOSHEN_SEED_SAMPLES", "1").strip().lower() not in {"0", "false", "no"}


def _seed_from_sample_files(conn, model) -> bool:
    """Isi hasil aktif + riwayat harian dari kartu stok asli di sample_files/.

    Langkahnya sama dengan menu Unggah Data (parser, cek saldo, model.prediksi), sehingga grafik penjualan
    per bulan dan evaluasi langsung tersedia tanpa harus mengunggah dulu. Dilewati (False) bila file tidak ada,
    bila berisi varian yang tidak dikenal model (mis. data tiruan), atau bila terjadi galat."""
    files = sorted(p for p in SAMPLE_DIR.glob("*.xlsx") if not p.name.startswith("~$"))
    if not files or not _seed_enabled():
        return False
    try:
        frames, summaries = [], []
        for path in files:
            with path.open("rb") as fh:
                frame = baca_harian(path.name, fh)
            frames.append(frame)
            summaries.append({
                "name": path.name,
                "products": sorted(str(p) for p in frame["Jenis_Produk"].unique()),
                "sku_count": int(frame.groupby(KUNCI_SKU).ngroups),
                "period_start": frame["Tanggal_dt"].min().date().isoformat(),
                "period_end": frame["Tanggal_dt"].max().date().isoformat(),
                "rows": int(len(frame)),
            })
        daily = pd.concat(frames, ignore_index=True)
        unknown = sorted({str(v) for v in daily["Varian"].unique()} - {
            c[len("Varian_"):] for c in model.fitur_klasifikasi if c.startswith("Varian_")})
        if unknown:
            print(f"[sikoshen] sample_files dilewati: varian tidak dikenal model ({', '.join(unknown[:5])}).")
            return False
        periksa_saldo(daily)
        result = model.prediksi(daily)
        validation, monthly_sales = summarize_daily_history(daily, model.ramadan, summaries)
        records = normalize_result_records(result.to_dict("records"))
        source = SEED_SOURCE
        save_forecast(conn, records, source, validation["period_end"], validation["total_rows"],
                      model.meta["versi_model"])
        save_actual_monthly_sales(conn, daily)
        save_prediction_snapshot(
            conn,
            target_month=str(records[0]["Bulan"]),
            data_period_end=str(validation["period_end"]),
            season=str(records[0]["Musim"]),
            model_version=str(model.meta["versi_model"]),
            source=source,
            records=records,
            baseline_map=compute_baseline_6m_map(daily, model.ramadan),
            skip_if_identical_seed=True,
        )
        save_meta(conn, "validation", validation)
        save_meta(conn, "monthly_sales", monthly_sales)
        daily.to_pickle(daily_cache_path())
        bump_active_revision(conn)
        print(f"[sikoshen] Data awal dimuat dari {len(files)} kartu stok asli ({len(daily):,} baris).")
        return True
    except Exception as err:  # noqa: BLE001 - jangan menggagalkan server; jatuh ke prediksi_bulan_depan.csv
        print(f"[sikoshen] Gagal memuat sample_files ({err}); memakai prediksi_bulan_depan.csv.")
        return False


@asynccontextmanager
async def lifespan(app):
    app.state.model = None
    app.state.model_error = None
    try:
        model = muat_model(MODEL_PATH)
        app.state.model = model
    except Exception as err:
        app.state.model_error = f"Model gagal dimuat dari {MODEL_PATH.name}: {err}"

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(database(DB_PATH)) as conn, conn:
        conn.executescript(SCHEMA)
        conn.execute("CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, expires INTEGER NOT NULL)")
        if app.state.model is not None:
            model = app.state.model
            conn.execute("BEGIN IMMEDIATE")
            current = conn.execute("SELECT source, model_version FROM forecast_run").fetchone()
            initial_source = "Kartu stok pelatihan"
            initial_csv = MODEL_PATH.with_name("prediksi_bulan_depan.csv")
            # Data awal: utamakan kartu stok asli (riwayat harian lengkap -> grafik & evaluasi langsung tersedia).
            perlu_awal = current is None or (
                current["source"] in (initial_source, SEED_SOURCE) and (
                    current["model_version"] != model.meta["versi_model"] or not daily_cache_path().exists()))
            if perlu_awal and _seed_from_sample_files(conn, model):
                pass
            elif (current is None or (current["source"] == initial_source and
                                      current["model_version"] != model.meta["versi_model"])) and initial_csv.exists():
                initial = pd.read_csv(initial_csv, dtype={"Ukuran": str}, float_precision="round_trip")
                if len(initial) != model.meta["jumlah_sku"] or not initial["Bulan"].eq(model.meta["bulan_prediksi"]).all():
                    raise ValueError("Pasangkan model dengan prediksi_bulan_depan.csv dari eksekusi notebook yang sama.")
                # Ekspor asli berisi satu baris per SKU. Jumlah baris harian tersedia saat impor.
                initial_records = initial.to_dict("records")
                save_forecast(conn, initial_records, initial_source,
                              model.meta["periode_data"][1], 0, model.meta["versi_model"])
                save_prediction_snapshot(
                    conn,
                    target_month=str(initial["Bulan"].iloc[0]),
                    data_period_end=str(model.meta["periode_data"][1]),
                    season=str(initial["Musim"].iloc[0]),
                    model_version=str(model.meta["versi_model"]),
                    source=initial_source,
                    records=initial_records,
                    baseline_map=None,
                    skip_if_identical_seed=True,
                )
                bump_active_revision(conn)
            else:
                get_active_revision(conn)
    yield


app = FastAPI(title="Sikoshen · Perencanaan stok", lifespan=lifespan)

# Peringatan bila website dipasang online tetapi kata sandi bawaan belum diganti.
_ONLINE = any(os.environ.get(k) for k in ("RENDER", "RAILWAY_ENVIRONMENT", "SPACE_ID"))
if _ONLINE and os.environ.get("SIKOSHEN_OWNER_PASSWORD", "sikoshen123") == "sikoshen123":
    print("[sikoshen] PERINGATAN: website online masih memakai kata sandi bawaan. "
          "Atur variabel SIKOSHEN_OWNER_PASSWORD di dashboard hosting.")


class Login(BaseModel):
    email: str
    password: str


class CommitImportRequest(BaseModel):
    preview_id: str
    confirm_scope_reduction: bool = False


def require_model():
    if app.state.model is None:
        raise HTTPException(
            503,
            app.state.model_error or "Model prediksi belum siap. Periksa file backend/models/rf_sikoshen.pkl.",
        )
    return app.state.model


def _session_cookie_flags() -> tuple[bool, str]:
    on_hf_space = bool(os.environ.get("SPACE_ID", "").strip())
    cookie_secure = on_hf_space or os.environ.get("SIKOSHEN_COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes"}
    cookie_samesite = os.environ.get("SIKOSHEN_COOKIE_SAMESITE", "none" if on_hf_space else "lax").strip().lower()
    if cookie_samesite not in {"lax", "strict", "none"}:
        cookie_samesite = "lax"
    if cookie_samesite == "none":
        cookie_secure = True
    return cookie_secure, cookie_samesite


@app.post("/api/auth/login")
def login(body: Login, response: Response):
    email = os.environ.get("SIKOSHEN_OWNER_EMAIL", "owner@sikoshen.id").strip().lower()
    password = os.environ.get("SIKOSHEN_OWNER_PASSWORD", "sikoshen123")
    cookie_secure, cookie_samesite = _session_cookie_flags()
    # Hanya satu akun pemilik. Bandingkan dengan compare_digest agar waktu respons tidak membocorkan isi sandi.
    if not (secrets.compare_digest(body.email.strip().lower(), email)
            and secrets.compare_digest(body.password.encode(), password.encode())):
        raise HTTPException(401, "Email atau kata sandi salah.")
    token = secrets.token_urlsafe(32)
    with closing(database(DB_PATH)) as conn, conn:
        conn.execute("DELETE FROM sessions WHERE expires <= unixepoch()")
        conn.execute("INSERT INTO sessions VALUES (?,unixepoch()+28800)", (token,))
    response.set_cookie(
        "sikoshen_session",
        token,
        httponly=True,
        samesite=cookie_samesite,
        secure=cookie_secure,
        max_age=28800,
    )
    return {"ok": True, "user": {"name": "Owner Sikoshen", "email": email, "role": "Owner"}}


@app.post("/api/auth/logout")
def logout(response: Response, sikoshen_session: str | None = Cookie(None)):
    cookie_secure, cookie_samesite = _session_cookie_flags()
    with closing(database(DB_PATH)) as conn, conn:
        conn.execute("DELETE FROM sessions WHERE token=?", (sikoshen_session,))
    response.delete_cookie("sikoshen_session", samesite=cookie_samesite, secure=cookie_secure)
    return {"ok": True}


def owner(sikoshen_session: str | None = Cookie(None)):
    with closing(database(DB_PATH)) as conn:
        if not conn.execute("SELECT 1 FROM sessions WHERE token=? AND expires>unixepoch()",
                            (sikoshen_session,)).fetchone():
            raise HTTPException(401, "Silakan masuk kembali.")


@app.get("/api/health")
def health():
    model = app.state.model
    forecast_ready = False
    if DB_PATH.exists():
        with closing(database(DB_PATH)) as conn:
            forecast_ready = conn.execute("SELECT 1 FROM forecast_run").fetchone() is not None
    return {
        "ok": model is not None,
        "storage": "sqlite",
        "model_loaded": model is not None,
        "model_version": model.meta.get("versi_model") if model is not None else None,
        "model_error": app.state.model_error,
        "ramadan_max_year": _ramadan_max_year(model.ramadan) if model is not None else None,
        "forecast_ready": forecast_ready,
    }


@app.get("/api/forecast", dependencies=[Depends(owner)])
def forecast(
    z: float | None = Query(None, gt=0, le=5),
    cap: int | None = Query(None, gt=0),
):
    model = require_model()
    with closing(database(DB_PATH)) as conn:
        conn.execute("BEGIN")
        data = read_forecast(conn)
    if data is None:
        raise HTTPException(
            404,
            "Belum ada riwayat kartu stok atau hasil prediksi tersimpan. Unggah kartu stok terlebih dahulu di menu Unggah Data.",
        )
    if z is None and cap is None:
        return data

    daily = None
    cache = daily_cache_path()
    if z is not None and abs(z - float(model.z)) > 1e-9 and cache.exists():
        try:
            daily = pd.read_pickle(cache)
        except Exception:
            daily = None
    try:
        return recalculate_orders(data, z=z, cap=cap, default_z=float(model.z), model=model, daily=daily)
    except ValueError as err:
        raise HTTPException(422, str(err)) from err


@app.get("/api/model/peluang-fast", dependencies=[Depends(owner)])
def peluang_fast(produk: str, varian: str, ukuran: str):
    model = require_model()
    produk_clean = produk.strip()
    varian_clean = varian.strip()
    ukuran_clean = ukuran.strip()
    if not produk_clean or not varian_clean or not ukuran_clean:
        raise HTTPException(422, "Produk, varian, dan ukuran harus diisi.")
    try:
        probability = model.peluang_fast(produk_clean, varian_clean, ukuran_clean)
    except (ValueError, OverflowError) as err:
        raise HTTPException(422, "Ukuran belum dikenali model. Gunakan angka atau M sampai XXXXL.") from err

    product_known = f"Produk_{produk_clean}" in model.fitur_klasifikasi
    variant_known = f"Varian_{varian_clean}" in model.fitur_klasifikasi
    known = product_known and variant_known

    records = _master_records(model)
    sold = [
        r for r in records
        if str(r["Jenis_Produk"]) == produk_clean
        and str(r["Varian"]) == varian_clean
        and clean_size(r["Ukuran"]) == ukuran_clean
    ]
    in_training_master = bool(sold)
    # SKU yang sudah pernah dijual memakai peluang OUT-OF-FOLD (dinilai model yang tidak melihat SKU itu),
    # sama dengan Peta Pola & Perlu Perhatian. Model akhir dilatih dengan SKU ini sehingga hasilnya bias
    # ke label aslinya (mis. ash gray 34: out-of-fold 0,20 vs model akhir 0,73).
    # Model akhir hanya dipakai untuk kombinasi yang belum pernah dijual.
    probability_source = "model"
    if sold:
        probability = float(sold[0]["Peluang_Fast"])
        probability_source = "out_of_fold"
    variant_probs = [
        float(r["Peluang_Fast"])
        for r in records
        if str(r["Jenis_Produk"]) == produk_clean and str(r["Varian"]) == varian_clean
    ]
    size_probs = [
        float(r["Peluang_Fast"])
        for r in records
        if str(r["Jenis_Produk"]) == produk_clean
        and clean_size(r["Ukuran"]) == ukuran_clean
    ]
    avg_variant = round(sum(variant_probs) / len(variant_probs), 4) if variant_probs else None
    avg_size = round(sum(size_probs) / len(size_probs), 4) if size_probs else None

    warning = None
    if not product_known:
        warning = f'Jenis produk "{produk_clean}" belum pernah ada saat model dilatih; hasil prediksi tidak dapat diandalkan.'
    elif not variant_known:
        warning = (
            f'Varian "{varian_clean}" belum pernah terlihat saat pelatihan model. '
            "Pada varian baru akurasi model hanya sekitar ~50% (setara menebak), sehingga hasil ini tidak dapat diandalkan."
        )

    return {
        "probability": probability,
        "known": known,
        "product_known": product_known,
        "variant_known": variant_known,
        "in_training_master": in_training_master,
        "probability_source": probability_source,
        "actual_label": str(sold[0]["Label"]) if sold else None,
        "avg_variant": avg_variant,
        "avg_size": avg_size,
        "warning": warning,
    }


def _akurasi_penelitian() -> dict:
    """Akurasi Random Forest hasil nested cross-validation (angka yang dilaporkan di penelitian)."""
    rf = next(r for r in research_metrics.KLASIFIKASI["perbandingan"] if r["jenis"] == "dipilih")
    return {"akurasi": rf["akurasi"], "sd": rf["sd"], "roc_auc": rf["rocAuc"]}


@app.get("/api/klasifikasi", dependencies=[Depends(owner)])
def klasifikasi():
    """Label Fast/Slow (aturan median per jenis produk) dari riwayat aktif + angka hasil penelitian.

    Label dihitung ulang dari riwayat harian yang sedang aktif dengan fungsi yang sama dengan notebook
    (siapkan_harian + bangun_label_sku). Jika riwayat harian belum ada, dipakai label saat model dilatih."""
    model = require_model()
    master = _master_records(model)
    oof = {(str(r["Jenis_Produk"]), str(r["Varian"]), clean_size(r["Ukuran"])): float(r["Peluang_Fast"]) for r in master}
    daily = None
    if daily_cache_path().exists():
        try:
            daily = pd.read_pickle(daily_cache_path())
        except Exception:
            daily = None
    if daily is not None and len(daily):
        sku = bangun_label_sku(siapkan_harian(daily))
        rows = [{
            "product": str(r.Jenis_Produk), "variant": str(r.Varian), "size": clean_size(r.Ukuran),
            "total_out": float(r.Total_Keluar), "median": float(r.Threshold_Median),
            "label": "fast" if r.Label_enc == 1 else "slow",
        } for r in sku.itertuples(index=False)]
        basis = "riwayat aktif"
        with closing(database(DB_PATH)) as conn:
            run = conn.execute("SELECT source, period_end FROM forecast_run").fetchone()
        source, period_end = (run["source"], run["period_end"]) if run else ("-", None)
    else:
        rows = [{
            "product": str(r["Jenis_Produk"]), "variant": str(r["Varian"]), "size": clean_size(r["Ukuran"]),
            "total_out": float(r["Total_Keluar"]), "median": float(r["Threshold_Median"]),
            "label": "fast" if r["Label"] == "Fast-Moving" else "slow",
        } for r in master]
        basis = "data pelatihan model"
        source, period_end = model.meta.get("sumber_data", "-"), (model.meta.get("periode_data") or [None, None])[1]
    for r in rows:
        r["peluang_fast"] = oof.get((r["product"], r["variant"], r["size"]))
    thresholds = {}
    for r in rows:
        thresholds.setdefault(r["product"], r["median"])
    return {
        "basis": basis,
        "source": source,
        "period_end": period_end,
        "thresholds": thresholds,
        "fast": sum(r["label"] == "fast" for r in rows),
        "slow": sum(r["label"] == "slow" for r in rows),
        "rows": rows,
        "model": {
            "version": model.meta.get("versi_model"),
            "oof_accuracy": (model.meta.get("evaluasi_klasifikasi") or {}).get("akurasi_out_of_fold"),
            "params": model.meta.get("param_klasifikasi"),
            "features": [c for c in model.fitur_klasifikasi],
        },
        "research": research_metrics.ringkasan(),
    }


@app.get("/api/model/master", dependencies=[Depends(owner)])
def model_master():
    model = require_model()
    records = _master_records(model)
    with closing(database(DB_PATH)) as conn:
        monthly_sales = read_meta(conn, "monthly_sales")
        validation = read_meta(conn, "validation")
        restore_info = read_restore_info(conn)
        active_revision = get_active_revision(conn)
    return {
        "rows": records,
        "meta": {**model.meta, "akurasi_penelitian": _akurasi_penelitian()},
        "z_default": float(model.z),
        "ramadan_max_year": _ramadan_max_year(model.ramadan),
        "products": build_product_catalog(records),
        "attention": build_attention_rows(records),
        "monthly_sales": monthly_sales,
        "validation": validation,
        "restore_info": restore_info,
        "active_revision": active_revision,
    }


@app.post("/api/forecast/import/preview", dependencies=[Depends(owner)])
def preview_import(files: list[UploadFile] = File(...)):
    model = require_model()
    daily, records, validation, monthly_sales, source = _parse_and_predict_upload(files, model)

    preview_id = secrets.token_urlsafe(16)
    staged_daily = preview_daily_path(preview_id)
    daily.to_pickle(staged_daily)

    try:
        with closing(database(DB_PATH)) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            current = read_forecast(conn)
            current_validation = read_meta(conn, "validation")
            base_revision = get_active_revision(conn)
            comparison = build_import_comparison(
                current,
                current_validation,
                records,
                validation,
                source,
            )
            save_import_preview(
                conn,
                preview_id=preview_id,
                base_revision=base_revision,
                source=source,
                period_start=validation["period_start"],
                period_end=validation["period_end"],
                daily_rows=validation["total_rows"],
                season=records[0]["Musim"],
                model_version=model.meta["versi_model"],
                prediction_month=records[0]["Bulan"],
                results=records,
                validation=validation,
                monthly_sales=monthly_sales,
                comparison=comparison,
                daily_pickle_path=staged_daily,
            )
    except Exception:
        staged_daily.unlink(missing_ok=True)
        raise

    return {
        "preview_id": preview_id,
        "base_revision": base_revision,
        "validation": validation,
        **comparison,
    }


@app.post("/api/forecast/import/commit", dependencies=[Depends(owner)])
def commit_import(body: CommitImportRequest):
    require_model()
    with closing(database(DB_PATH)) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        staged = read_import_preview(conn, body.preview_id)
        if staged is None:
            raise HTTPException(
                404,
                "Pratinjau impor tidak ditemukan atau sudah tidak berlaku. Buat pratinjau baru terlebih dahulu.",
            )

        current_revision = get_active_revision(conn)
        if staged["base_revision"] != current_revision:
            raise HTTPException(
                409,
                "Hasil aktif sudah berubah sejak pratinjau ini dibuat. Silakan buat pratinjau ulang sebelum menerapkan impor.",
            )

        comparison = staged["comparison"]
        if comparison.get("requires_extra_confirmation") and not body.confirm_scope_reduction:
            missing_prods = ", ".join(comparison.get("missing_products", []))
            missing_cnt = comparison.get("missing_sku_count", 0)
            extra = f" (produk terdampak: {missing_prods})" if missing_prods else ""
            raise HTTPException(
                422,
                f"Impor ini akan menghilangkan {missing_cnt} SKU{extra}. Tambahkan berkas yang kurang atau berikan konfirmasi pengurangan cakupan untuk melanjutkan.",
            )

        staged_daily_path = Path(staged["daily_pickle_path"])
        if not staged_daily_path.exists():
            raise HTTPException(
                409,
                "Data sementara pratinjau sudah tidak tersedia. Silakan buat pratinjau ulang.",
            )

        staged_daily = pd.read_pickle(staged_daily_path)
        baseline_map = compute_baseline_6m_map(staged_daily, app.state.model.ramadan)

        backup_active_snapshot(conn, daily_cache_path(), backup_daily_cache_path())
        save_forecast(
            conn,
            staged["results"],
            staged["source"],
            staged["period_end"],
            staged["daily_rows"],
            staged["model_version"],
        )
        save_actual_monthly_sales(conn, staged_daily)
        save_prediction_snapshot(
            conn,
            target_month=staged["prediction_month"],
            data_period_end=staged["period_end"],
            season=staged["season"],
            model_version=staged["model_version"],
            source=staged["source"],
            records=staged["results"],
            baseline_map=baseline_map,
        )
        save_meta(conn, "validation", staged["validation"])
        save_meta(conn, "monthly_sales", staged["monthly_sales"])
        shutil.move(str(staged_daily_path), str(daily_cache_path()))
        conn.execute("DELETE FROM import_previews WHERE preview_id=?", (body.preview_id,))
        bump_active_revision(conn)
        return read_forecast(conn)


@app.delete("/api/forecast/import/preview/{preview_id}", dependencies=[Depends(owner)])
def cancel_preview(preview_id: str):
    with closing(database(DB_PATH)) as conn, conn:
        deleted = delete_import_preview(conn, preview_id)
    return {"ok": True, "cancelled": deleted}


@app.post("/api/forecast/restore", dependencies=[Depends(owner)])
def restore_previous():
    require_model()
    with closing(database(DB_PATH)) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        restored = restore_previous_snapshot(conn, daily_cache_path(), backup_daily_cache_path())
        if restored is None:
            raise HTTPException(404, "Belum ada hasil sebelumnya yang tersimpan untuk dipulihkan.")
        return restored


@app.get("/api/evaluation", dependencies=[Depends(owner)])
def monthly_evaluation():
    model = require_model()
    with closing(database(DB_PATH)) as conn:
        return evaluate_monthly_predictions(conn, model.meta)


DIST = ROOT.parent / "dist"
if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/favicon.svg", include_in_schema=False)
def favicon():
    return FileResponse(DIST / "favicon.svg")


@app.get("/", include_in_schema=False)
@app.get("/dashboard", include_in_schema=False)
@app.get("/login", include_in_schema=False)
@app.get("/masuk", include_in_schema=False)
@app.get("/beranda", include_in_schema=False)
@app.get("/unggah-data", include_in_schema=False)
@app.get("/saran-pemesanan", include_in_schema=False)
@app.get("/peta-pola", include_in_schema=False)
@app.get("/cek-kombinasi", include_in_schema=False)
@app.get("/perlu-perhatian", include_in_schema=False)
@app.get("/klasifikasi", include_in_schema=False)
def website():
    return FileResponse(DIST / "index.html")
