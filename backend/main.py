import asyncio
import hashlib
import io
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import get_db_connection
from seed_and_ml import (
    FEATURED_SKU_ID,
    FEATURE_COLS,
    MODEL_PATH,
    SAMPLE_DIR,
    can_classify_sku,
    extract_sku_features,
    get_daily_movements,
    get_movement_label,
    get_stock_action,
    get_stock_condition,
    load_rf_artifact,
    seed_database,
    train_and_save_rf_model,
)

app = FastAPI(
    title="Sikoshen Store Backend API",
    description="Backend API FastAPI + MySQL Laragon + Random Forest Regressor untuk Sikoshen Store",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STOCK_COLUMNS = [
    "Tanggal",
    "Jenis_Produk",
    "Varian Warna",
    "Ukuran",
    "Barang_Masuk",
    "Barang_Keluar",
    "Stok_Akhir",
]

# Menyimpan flag pembatalan cepat di memori di samping status MySQL
CANCELLED_JOBS = set()


@app.on_event("startup")
def on_startup():
    seed_database(force_reset=False)


def normalize_col(name: str) -> str:
    return (
        name.strip()
        .strip('"')
        .lower()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
    )


def check_csv_header(header_line: str) -> List[Dict[str, Any]]:
    delimiter = ";" if (";" in header_line and "," not in header_line) else ","
    present_cols = {normalize_col(c) for c in header_line.split(delimiter)}
    return [{"name": col, "present": normalize_col(col) in present_cols} for col in STOCK_COLUMNS]


def check_df_columns(columns: List[str]) -> List[Dict[str, Any]]:
    present_cols = {normalize_col(str(c)) for c in columns}
    return [{"name": col, "present": normalize_col(col) in present_cols} for col in STOCK_COLUMNS]


def fetch_full_state() -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM system_state WHERE id = 1")
        sys_row = cursor.fetchone()

        cursor.execute("SELECT * FROM products ORDER BY sort_order ASC")
        prod_rows = cursor.fetchall()
        products = [
            {
                "id": r["id"],
                "name": r["name"],
                "sizeType": r["size_type"],
                "variants": json.loads(r["variants_json"]),
                "sizes": json.loads(r["sizes_json"]),
                "unavailable": json.loads(r["unavailable_json"]),
                "median": r["median"],
                "stockTarget": r["stock_target"],
                "fastTarget": r["fast_target"],
                "restockTarget": r["restock_target"],
                "stackedSlowTarget": r["stacked_slow_target"],
            }
            for r in prod_rows
        ]

        cursor.execute("SELECT * FROM sku_profiles ORDER BY sort_order ASC")
        sku_rows = cursor.fetchall()
        profiles = []
        for r in sku_rows:
            p_item: Dict[str, Any] = {
                "id": r["id"],
                "productId": r["product_id"],
                "variant": r["variant"],
                "size": r["size"],
                "stock": r["stock"],
                "averageStockTarget": r["average_stock_target"],
                "estimatedTotalOut": r["estimated_total_out"],
                "label": r["label"],
                "recognizedByModel": bool(r["recognized_by_model"]),
            }
            if r["sample_monthly_out"] is not None:
                p_item["sampleMonthlyOut"] = r["sample_monthly_out"]
            profiles.append(p_item)

        cursor.execute("SELECT * FROM monthly_movements ORDER BY id ASC")
        mov_rows = cursor.fetchall()
        movements_by_sku: Dict[str, List[Dict[str, Any]]] = {p["id"]: [] for p in profiles}
        for m in mov_rows:
            entry: Dict[str, Any] = {
                "month": m["month"],
                "openingStock": m["opening_stock"],
                "incoming": m["incoming"],
                "outgoing": m["outgoing"],
                "closingStock": m["closing_stock"],
            }
            if m["transactions_json"]:
                entry["transactions"] = json.loads(m["transactions_json"])
            movements_by_sku.setdefault(m["sku_id"], []).append(entry)

        cursor.execute("SELECT * FROM uploads ORDER BY at DESC")
        upload_rows = cursor.fetchall()
        uploads = []
        for u in upload_rows:
            base = {
                "id": u["id"],
                "name": u["name"],
                "at": u["at"].isoformat() if isinstance(u["at"], datetime) else str(u["at"]),
                "status": u["status"],
            }
            if u["status"] == "berhasil":
                base["readyRows"] = u["ready_rows"] or 0
                base["skuCount"] = u["sku_count"] or 0
                base["discardedRows"] = u["discarded_rows"] or 0
            else:
                base["reason"] = u["reason"] or ""
            uploads.append(base)

        cursor.execute("SELECT * FROM classifications ORDER BY at DESC")
        cls_rows = cursor.fetchall()
        classifications = [
            {
                "id": c["id"],
                "at": c["at"].isoformat() if isinstance(c["at"], datetime) else str(c["at"]),
                "periodStart": c["period_start"].isoformat() if hasattr(c["period_start"], "isoformat") else str(c["period_start"]),
                "periodEnd": c["period_end"].isoformat() if hasattr(c["period_end"], "isoformat") else str(c["period_end"]),
                "fast": c["fast"],
                "slow": c["slow"],
                "changes": json.loads(c["changes_json"]),
            }
            for c in cls_rows
        ]

        cursor.execute("SELECT * FROM recommendation_reviews ORDER BY at DESC")
        rev_rows = cursor.fetchall()
        recommendation_reviews = [
            {
                "id": r["id"],
                "at": r["at"].isoformat() if isinstance(r["at"], datetime) else str(r["at"]),
                "skuIds": json.loads(r["sku_ids_json"]),
                "classificationAt": r["classification_at"].isoformat() if isinstance(r["classification_at"], datetime) else str(r["classification_at"]),
            }
            for r in rev_rows
        ]

        cursor.execute("SELECT * FROM model_metadata WHERE id = 1")
        m_row = cursor.fetchone()
        model_meta = None
        if m_row:
            model_meta = {
                "algorithm": m_row["algorithm"],
                "trees": m_row["trees"],
                "maxDepth": m_row["max_depth"],
                "trainSkuCount": m_row["train_sku_count"],
                "testSkuCount": m_row["test_sku_count"],
                "correctLabels": m_row["correct_labels"],
                "accuracyPercent": m_row["accuracy_percent"],
                "fastRecall": m_row["fast_recall"],
                "slowRecall": m_row["slow_recall"],
                "crossValidation": {
                    "averagePercent": m_row["cv_avg_percent"],
                    "standardDeviationPercent": m_row["cv_std_percent"],
                },
                "confusionMatrix": json.loads(m_row["confusion_matrix_json"]),
                "featureImportance": json.loads(m_row["feature_importance_json"]),
                "mae": m_row["mae"],
            }

        cursor.close()
        return {
            "status": {
                "periodStart": sys_row["period_start"].isoformat() if sys_row else "2023-05-01",
                "periodEnd": sys_row["period_end"].isoformat() if sys_row else "2026-05-31",
                "lastUpload": sys_row["last_upload"].isoformat() if sys_row else "2026-06-03T14:05:00",
                "lastClassification": sys_row["last_classification"].isoformat() if sys_row else "2026-06-03T14:20:00",
                "classificationRunning": bool(sys_row["classification_running"]) if sys_row else False,
            },
            "products": products,
            "model": model_meta,
            "profiles": profiles,
            "movementsBySku": movements_by_sku,
            "uploads": uploads,
            "classifications": classifications,
            "recommendationReviews": recommendation_reviews,
        }
    finally:
        conn.close()


class LoginRequest(BaseModel):
    email: str
    password: str


@app.get("/api/health")
def health_check():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        return {
            "ok": True,
            "database": "MySQL Laragon (sikoshen_store)",
            "modelLoaded": MODEL_PATH.exists(),
            "modelFile": MODEL_PATH.name,
        }
    finally:
        conn.close()


@app.get("/api/model/info")
def get_model_info():
    artifact = load_rf_artifact()
    rf = artifact["model"]
    return {
        "file": str(MODEL_PATH.name),
        "exists": MODEL_PATH.exists(),
        "sizeBytes": MODEL_PATH.stat().st_size if MODEL_PATH.exists() else 0,
        "type": type(rf).__name__,
        "nEstimators": getattr(rf, "n_estimators", 100),
        "maxDepth": getattr(rf, "max_depth", 10),
        "featureCols": artifact.get("feature_cols", FEATURE_COLS),
        "featureColsNoLeakage": artifact.get("feature_cols_no_leakage", []),
        "mae": artifact.get("mae", "66,19 unit"),
        "maeNoLeakage": artifact.get("mae_no_leakage", "161,65 unit"),
    }


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    await asyncio.sleep(0.5)
    email = req.email.strip().lower()
    pw_hash = hashlib.sha256(req.password.encode("utf-8")).hexdigest()
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, name, email, role FROM users WHERE LOWER(email) = %s AND password_hash = %s",
            (email, pw_hash),
        )
        user = cursor.fetchone()
        cursor.close()
        if not user:
            raise HTTPException(status_code=401, detail="Email atau kata sandi salah.")
        return {
            "ok": True,
            "user": {
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
            },
        }
    finally:
        conn.close()


@app.get("/api/state")
def get_state():
    return fetch_full_state()


@app.post("/api/demo/reset")
def reset_demo_data():
    seed_database(force_reset=True)
    return fetch_full_state()


class UploadProblemRequest(BaseModel):
    type: str
    name: str
    reason: str


@app.post("/api/uploads/problem")
def record_upload_problem(req: UploadProblemRequest):
    now = datetime.now()
    rec_id = f"upload-{int(now.timestamp() * 1000)}"
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO uploads (id, name, at, status, reason) VALUES (%s, %s, %s, %s, %s)",
            (rec_id, req.name, now.strftime("%Y-%m-%d %H:%M:%S"), req.type, req.reason),
        )
        conn.commit()
        cursor.close()
        return {
            "id": rec_id,
            "name": req.name,
            "at": now.isoformat(),
            "status": req.type,
            "reason": req.reason,
        }
    finally:
        conn.close()


def update_job_in_db(
    job_id: str,
    *,
    status: Optional[str] = None,
    progress: Optional[float] = None,
    current_step: Optional[int] = None,
    error_code: Optional[str] = None,
    reason: Optional[str] = None,
    result_obj: Optional[Dict[str, Any]] = None,
):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        fields = []
        values = []
        if status is not None:
            fields.append("status = %s")
            values.append(status)
        if progress is not None:
            fields.append("progress = %s")
            values.append(progress)
        if current_step is not None:
            fields.append("current_step = %s")
            values.append(current_step)
        if error_code is not None:
            fields.append("error_code = %s")
            values.append(error_code)
        if reason is not None:
            fields.append("reason = %s")
            values.append(reason)
        if result_obj is not None:
            fields.append("result_json = %s")
            values.append(json.dumps(result_obj))
        if fields:
            values.append(job_id)
            cursor.execute(f"UPDATE process_jobs SET {', '.join(fields)} WHERE id = %s", tuple(values))
            conn.commit()
        cursor.close()
    finally:
        conn.close()


async def run_upload_check_job(
    job_id: str,
    file_blobs: List[Dict[str, Any]],
    scenario: str,
    force_failure: bool,
    file_summary_name: str,
):
    """Menjalankan pemeriksaan file kartu stok secara bertahap di backend (5 tahap)."""
    total_steps = 5
    duration_sec = 2.8
    ticks = 20
    sleep_per_tick = duration_sec / ticks

    validation_issue = None
    parsed_preview = []
    parsed_row_count = 0

    # Pra-pemeriksaan file nyata (CSV / XLSX)
    try:
        if scenario == "invalid":
            first_name = file_blobs[0]["name"] if file_blobs else "kartu-stok.csv"
            validation_issue = {
                "file": first_name,
                "columns": check_csv_header(",".join(STOCK_COLUMNS[:5])),
            }
        else:
            for item in file_blobs:
                fname = item["name"]
                raw_bytes: Optional[bytes] = item.get("bytes")
                if not raw_bytes:
                    sample_file = SAMPLE_DIR / fname
                    if sample_file.exists():
                        raw_bytes = sample_file.read_bytes()
                if not raw_bytes:
                    continue

                if fname.lower().endswith(".csv"):
                    text_head = raw_bytes[:8192].decode("utf-8", errors="ignore")
                    first_line = next((line for line in text_head.splitlines() if line.strip()), "")
                    cols = check_csv_header(first_line)
                    if any(not c["present"] for c in cols):
                        validation_issue = {"file": fname, "columns": cols}
                        break
                    df = pd.read_csv(io.BytesIO(raw_bytes))
                    parsed_row_count += len(df)
                    if not parsed_preview and len(df) > 0:
                        for _, r in df.head(5).iterrows():
                            parsed_preview.append([str(r.iloc[i]) if i < len(r) else "" for i in range(min(7, len(r)))])
                elif fname.lower().endswith(".xlsx"):
                    df = pd.read_excel(io.BytesIO(raw_bytes))
                    cols = check_df_columns([str(c) for c in df.columns])
                    if len(df.columns) >= 5 and any(not c["present"] for c in cols):
                        # Jika format baris tetapi kolom kurang
                        validation_issue = {"file": fname, "columns": cols}
                        break
                    parsed_row_count += len(df)
                    if not parsed_preview and len(df) > 0:
                        for _, r in df.head(5).iterrows():
                            parsed_preview.append([str(r.iloc[i]) if i < len(r) else "" for i in range(min(7, len(r)))])
    except Exception as exc:
        err_code = f"UPL-{ hex(int(time.time() * 1000))[2:].upper() }"
        update_job_in_db(
            job_id,
            status="failed",
            progress=40,
            current_step=1,
            error_code=err_code,
            reason=f"File tidak dapat dibaca ({exc}).",
        )
        return

    for tick in range(1, ticks + 1):
        await asyncio.sleep(sleep_per_tick)
        if job_id in CANCELLED_JOBS:
            update_job_in_db(job_id, status="cancelled", progress=0, current_step=0)
            return
        progress = min(100.0, (tick / ticks) * 100.0)
        step = min(total_steps - 1, int((progress / 100.0) * total_steps))

        if force_failure and progress >= 64.0:
            err_code = f"UPL-{ hex(int(time.time() * 1000))[2:].upper() }"
            now = datetime.now()
            conn = get_db_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO uploads (id, name, at, status, reason) VALUES (%s, %s, %s, %s, %s)",
                    (
                        f"upload-{int(now.timestamp() * 1000)}",
                        file_summary_name,
                        now.strftime("%Y-%m-%d %H:%M:%S"),
                        "gagal",
                        "Koneksi terputus saat memeriksa file.",
                    ),
                )
                conn.commit()
                cur.close()
            finally:
                conn.close()
            update_job_in_db(
                job_id,
                status="failed",
                progress=progress,
                current_step=step,
                error_code=err_code,
                reason="Koneksi terputus saat memeriksa file.",
            )
            return

        if tick < ticks:
            update_job_in_db(job_id, status="running", progress=progress, current_step=step)

    if validation_issue:
        now = datetime.now()
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO uploads (id, name, at, status, reason) VALUES (%s, %s, %s, %s, %s)",
                (
                    f"upload-{int(now.timestamp() * 1000)}",
                    validation_issue["file"],
                    now.strftime("%Y-%m-%d %H:%M:%S"),
                    "ditolak",
                    "Kolom wajib tidak lengkap.",
                ),
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()

    result_payload = {
        "validation": validation_issue,
        "duplicate": scenario == "duplicate" and validation_issue is None,
        "summary": {
            "convertedRows": 94679,
            "readyRows": 93977,
            "discardedRows": 702,
            "fixedRows": 1642,
            "parsedFileRows": parsed_row_count,
        },
        "preview": parsed_preview,
    }
    update_job_in_db(
        job_id,
        status="success",
        progress=100.0,
        current_step=total_steps - 1,
        result_obj=result_payload,
    )


@app.post("/api/uploads/check")
async def start_upload_check(
    background_tasks: BackgroundTasks,
    scenario: str = Form("normal"),
    forceFailure: bool = Form(False),
    fileNamesJson: str = Form("[]"),
    files: List[UploadFile] = File(default=[]),
):
    names_list = json.loads(fileNamesJson) if fileNamesJson else []
    file_blobs = []
    if files:
        for uf in files:
            content = await uf.read()
            file_blobs.append({"name": uf.filename or "kartu-stok.xlsx", "bytes": content})
    else:
        for name in names_list:
            file_blobs.append({"name": name, "bytes": None})

    if not file_blobs:
        raise HTTPException(status_code=400, detail="Pilih minimal satu file.")

    file_summary_name = (
        file_blobs[0]["name"]
        if len(file_blobs) == 1
        else f"{len(file_blobs)} file kartu stok ({', '.join(f['name'] for f in file_blobs)})"
    )

    job_id = f"job-upl-{uuid.uuid4().hex[:10]}"
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO process_jobs (id, kind, status, progress, current_step, total_steps)
            VALUES (%s, 'upload_check', 'running', 0, 0, 5)
            """,
            (job_id,),
        )
        conn.commit()
        cursor.close()
    finally:
        conn.close()

    background_tasks.add_task(
        run_upload_check_job,
        job_id,
        file_blobs,
        scenario,
        forceFailure or (scenario == "failure"),
        file_summary_name,
    )
    return {"jobId": job_id, "status": "running", "progress": 0, "currentStep": 0}


class SaveUploadRequest(BaseModel):
    fileName: str
    saveMode: str = "june"
    readyRows: int = 93977
    discardedRows: int = 702


@app.post("/api/uploads/save")
def save_upload(req: SaveUploadRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT classification_running FROM system_state WHERE id = 1")
        st = cursor.fetchone()
        if st and st["classification_running"]:
            raise HTTPException(status_code=409, detail="Tunggu sampai klasifikasi selesai.")

        cursor.execute("SELECT id, stock FROM sku_profiles ORDER BY sort_order ASC")
        sku_rows = cursor.fetchall()

        # Jika saveMode == 'replace', perbaiki bulan 2026-05 untuk KMJDENIM-HITAM-L
        if req.saveMode == "replace":
            cursor.execute(
                "SELECT * FROM monthly_movements WHERE sku_id = %s AND month = '2026-05'",
                (FEATURED_SKU_ID,),
            )
            may_row = cursor.fetchone()
            if may_row:
                tx_list = (
                    json.loads(may_row["transactions_json"])
                    if may_row["transactions_json"]
                    else get_daily_movements(
                        FEATURED_SKU_ID,
                        {
                            "month": may_row["month"],
                            "openingStock": may_row["opening_stock"],
                            "incoming": may_row["incoming"],
                            "outgoing": may_row["outgoing"],
                            "closingStock": may_row["closing_stock"],
                        },
                    )
                )
                last_tx = next((t for t in tx_list if t["date"] == "2026-05-31"), None)
                if last_tx and last_tx["outgoing"] == 6 and last_tx["closingStock"] >= 4:
                    last_tx["outgoing"] += 4
                    last_tx["closingStock"] -= 4
                    new_out = may_row["outgoing"] + 4
                    new_close = may_row["closing_stock"] - 4
                    cursor.execute(
                        """
                        UPDATE monthly_movements
                        SET outgoing = %s, closing_stock = %s, transactions_json = %s
                        WHERE id = %s
                        """,
                        (new_out, new_close, json.dumps(tx_list), may_row["id"]),
                    )

        # Tambahkan atau perbarui pergerakan bulan Juni 2026 (2026-06) untuk setiap SKU
        for index, s in enumerate(sku_rows):
            sku_id = s["id"]
            cursor.execute(
                """
                SELECT closing_stock FROM monthly_movements
                WHERE sku_id = %s AND month < '2026-06'
                ORDER BY month DESC LIMIT 1
                """,
                (sku_id,),
            )
            prev = cursor.fetchone()
            opening_stock = prev["closing_stock"] if prev else s["stock"]
            incoming = (index % 4) + 3
            outgoing = min(opening_stock + incoming, (index % 5) + 2)
            closing_stock = opening_stock + incoming - outgoing
            tx_june = [
                {"date": "2026-06-04", "incoming": incoming, "outgoing": 0, "closingStock": opening_stock + incoming},
                {"date": "2026-06-21", "incoming": 0, "outgoing": outgoing, "closingStock": closing_stock},
            ]
            cursor.execute(
                """
                INSERT INTO monthly_movements
                (sku_id, month, opening_stock, incoming, outgoing, closing_stock, transactions_json)
                VALUES (%s, '2026-06', %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  opening_stock = VALUES(opening_stock),
                  incoming = VALUES(incoming),
                  outgoing = VALUES(outgoing),
                  closing_stock = VALUES(closing_stock),
                  transactions_json = VALUES(transactions_json)
                """,
                (sku_id, opening_stock, incoming, outgoing, closing_stock, json.dumps(tx_june)),
            )
            cursor.execute("UPDATE sku_profiles SET stock = %s WHERE id = %s", (closing_stock, sku_id))

        now = datetime.now()
        upl_id = f"upload-{int(now.timestamp() * 1000)}"
        cursor.execute(
            """
            INSERT INTO uploads (id, name, at, status, ready_rows, sku_count, discarded_rows, fixed_rows)
            VALUES (%s, %s, %s, 'berhasil', %s, %s, %s, 1642)
            """,
            (
                upl_id,
                req.fileName,
                now.strftime("%Y-%m-%d %H:%M:%S"),
                req.readyRows,
                len(sku_rows),
                req.discardedRows,
            ),
        )
        cursor.execute(
            """
            UPDATE system_state
            SET last_upload = %s, period_end = '2026-06-30'
            WHERE id = 1
            """,
            (now.strftime("%Y-%m-%d %H:%M:%S"),),
        )
        conn.commit()
        cursor.close()
        return fetch_full_state()
    finally:
        conn.close()


class SkuFeatureInput(BaseModel):
    skuId: str
    productId: str
    variant: str
    sizeType: str = "angka"
    totalIncoming: float
    stockFluctuation: float
    maxStock: float
    avgStock: float
    minStock: float
    historyMonths: int = 37
    recognizedByModel: bool = True


class PredictRequest(BaseModel):
    skuFeatures: List[SkuFeatureInput]
    withoutLeakage: bool = False


def predict_from_feature_inputs(
    sku_features: List[SkuFeatureInput],
    medians: Dict[str, int],
    without_leakage: bool = False,
) -> List[Dict[str, Any]]:
    """Menerima ringkasan fitur per SKU, memanggil model rf_sikoshen.pkl (100 pohon, max_depth=10), lalu mengembalikan estimasi & label."""
    variant_map = {
        v: idx
        for idx, v in enumerate(["Hitam", "Biru Muda", "Biru Tua", "Navy", "Abu", "Putih", "Krem", "Cokelat"])
    }
    product_map = {"KMJDENIM": 0, "TJB": 1, "IHU": 2}
    artifact = load_rf_artifact()
    rf_model = artifact.get("model_no_leakage") if (without_leakage and "model_no_leakage" in artifact) else artifact["model"]

    X_rows = []
    for item in sku_features:
        if without_leakage and "model_no_leakage" in artifact:
            X_rows.append(
                [
                    item.stockFluctuation,
                    item.maxStock,
                    item.avgStock,
                    variant_map.get(item.variant, 99),
                    product_map.get(item.productId, 99),
                    0 if item.sizeType == "huruf" else 1,
                    item.minStock,
                ]
            )
        else:
            X_rows.append(
                [
                    item.totalIncoming,
                    item.stockFluctuation,
                    item.maxStock,
                    item.avgStock,
                    variant_map.get(item.variant, 99),
                    product_map.get(item.productId, 99),
                    0 if item.sizeType == "huruf" else 1,
                    item.minStock,
                ]
            )
    preds = rf_model.predict(np.array(X_rows, dtype=float)) if X_rows else []
    results = []
    for item, pred_val in zip(sku_features, preds):
        est = int(round(float(pred_val)))
        median = medians.get(item.productId, 480)
        label = get_movement_label(est, median, item.historyMonths, item.recognizedByModel)
        results.append(
            {
                "skuId": item.skuId,
                "productId": item.productId,
                "estimatedTotalOut": est,
                "median": median,
                "label": label,
            }
        )
    return results


@app.post("/api/model/predict")
def predict_sku_movements(req: PredictRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, median FROM products")
        medians = {r["id"]: r["median"] for r in cursor.fetchall()}
        cursor.close()
    finally:
        conn.close()
    predictions = predict_from_feature_inputs(req.skuFeatures, medians, without_leakage=req.withoutLeakage)
    return {
        "ok": True,
        "modelFile": MODEL_PATH.name,
        "withoutLeakage": req.withoutLeakage,
        "predictions": predictions,
    }


async def run_classification_job(
    job_id: str,
    force_failure: bool,
    sku_features: Optional[List[SkuFeatureInput]] = None,
):
    """Menjalankan pipeline klasifikasi Random Forest Regressor (scikit-learn) pada data MySQL."""
    total_steps = 4
    duration_sec = 3.2
    ticks = 20
    sleep_per_tick = duration_sec / ticks

    for tick in range(1, ticks + 1):
        await asyncio.sleep(sleep_per_tick)
        if job_id in CANCELLED_JOBS:
            conn = get_db_connection()
            try:
                cur = conn.cursor()
                cur.execute("UPDATE system_state SET classification_running = 0 WHERE id = 1")
                conn.commit()
                cur.close()
            finally:
                conn.close()
            update_job_in_db(job_id, status="cancelled", progress=0, current_step=0)
            return

        progress = min(100.0, (tick / ticks) * 100.0)
        step = min(total_steps - 1, int((progress / 100.0) * total_steps))

        if force_failure and progress >= 64.0:
            err_code = f"KLS-{ hex(int(time.time() * 1000))[2:].upper() }"
            conn = get_db_connection()
            try:
                cur = conn.cursor()
                cur.execute("UPDATE system_state SET classification_running = 0 WHERE id = 1")
                conn.commit()
                cur.close()
            finally:
                conn.close()
            update_job_in_db(
                job_id,
                status="failed",
                progress=progress,
                current_step=step,
                error_code=err_code,
                reason="Tidak ada data yang berubah.",
            )
            return

        if tick < ticks:
            update_job_in_db(job_id, status="running", progress=progress, current_step=step)

    # Tahap akhir: jalankan model Random Forest Regressor & perbarui label di MySQL
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, median FROM products")
        medians = {r["id"]: r["median"] for r in cursor.fetchall()}

        cursor.execute("SELECT * FROM sku_profiles ORDER BY sort_order ASC")
        sku_rows = cursor.fetchall()

        cursor.execute("SELECT * FROM monthly_movements ORDER BY id ASC")
        mov_rows = cursor.fetchall()
        movements_by_sku: Dict[str, List[Dict[str, Any]]] = {r["id"]: [] for r in sku_rows}
        for m in mov_rows:
            movements_by_sku.setdefault(m["sku_id"], []).append(
                {
                    "month": m["month"],
                    "openingStock": m["opening_stock"],
                    "incoming": m["incoming"],
                    "outgoing": m["outgoing"],
                    "closingStock": m["closing_stock"],
                }
            )

        profiles_for_ml = [
            {
                "id": r["id"],
                "productId": r["product_id"],
                "variant": r["variant"],
                "size": r["size"],
                "stock": r["stock"],
                "averageStockTarget": r["average_stock_target"],
                "estimatedTotalOut": r["estimated_total_out"],
                "label": r["label"],
                "recognizedByModel": bool(r["recognized_by_model"]),
                "sampleMonthlyOut": r["sample_monthly_out"],
            }
            for r in sku_rows
        ]

        # Muat model RandomForestRegressor (.pkl) dengan joblib & jalankan inferensi dari fitur SKU
        if sku_features:
            preds_list = predict_from_feature_inputs(sku_features, medians)
            rf_pred_map = {item["skuId"]: item["estimatedTotalOut"] for item in preds_list}
        else:
            artifact = load_rf_artifact(profiles_for_ml, movements_by_sku)
            rf_model = artifact["model"]
            feat_df = extract_sku_features(profiles_for_ml, movements_by_sku)
            rf_preds = rf_model.predict(feat_df[FEATURE_COLS].values)
            rf_pred_map = {
                sku_id: int(round(pred))
                for sku_id, pred in zip(feat_df["sku_id"].tolist(), rf_preds.tolist())
            }

        # Cari kandidat di sekitar median yang berubah label ketika klasifikasi ulang dijalankan
        candidates = []
        for r in sku_rows:
            sku_id = r["id"]
            median = medians.get(r["product_id"])
            hist_months = len({m["month"] for m in movements_by_sku.get(sku_id, [])})
            if (
                median is not None
                and r["label"]
                and r["sample_monthly_out"] is None
                and bool(r["recognized_by_model"])
                and hist_months >= 3
            ):
                candidates.append({"sku": r, "median": median, "hist_months": hist_months})

        candidates.sort(
            key=lambda item: (
                abs(item["sku"]["estimated_total_out"] - item["median"]),
                item["sku"]["id"],
            )
        )
        fast_count = sum(1 for r in sku_rows if r["label"] == "fast")
        fast_to_slow = 2 if fast_count >= 61 else 1
        selected = [
            *[c for c in candidates if c["sku"]["label"] == "fast"][:fast_to_slow],
            *[c for c in candidates if c["sku"]["label"] == "slow"][: 3 - fast_to_slow],
        ]
        adjusted = {
            c["sku"]["id"]: (c["median"] if c["sku"]["label"] == "fast" else c["median"] + 1)
            for c in selected
        }

        changes = []
        new_fast = 0
        new_slow = 0
        for r in sku_rows:
            sku_id = r["id"]
            median = medians.get(r["product_id"])
            hist_months = len({m["month"] for m in movements_by_sku.get(sku_id, [])})
            est = adjusted.get(sku_id, r["estimated_total_out"])
            # Jika SKU baru dikenali model tetapi belum punya estimasi, gunakan prediksi Random Forest
            if est == 0 and bool(r["recognized_by_model"]) and hist_months >= 3:
                est = rf_pred_map.get(sku_id, est)

            new_label = (
                None
                if median is None
                else get_movement_label(est, median, hist_months, bool(r["recognized_by_model"]))
            )
            prev_label = r["label"]
            if prev_label != new_label:
                changes.append({"skuId": sku_id, "previous": prev_label, "current": new_label})
            if new_label == "fast":
                new_fast += 1
            elif new_label == "slow":
                new_slow += 1

            cursor.execute(
                "UPDATE sku_profiles SET estimated_total_out = %s, label = %s WHERE id = %s",
                (est, new_label, sku_id),
            )

        cursor.execute("SELECT period_start, period_end FROM system_state WHERE id = 1")
        sys_dates = cursor.fetchone()
        now = datetime.now()
        cls_id = f"classification-{int(now.timestamp() * 1000)}"
        cursor.execute(
            """
            INSERT INTO classifications (id, at, period_start, period_end, fast, slow, changes_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                cls_id,
                now.strftime("%Y-%m-%d %H:%M:%S"),
                sys_dates["period_start"] if sys_dates else "2023-05-01",
                sys_dates["period_end"] if sys_dates else "2026-05-31",
                new_fast,
                new_slow,
                json.dumps(changes),
            ),
        )
        cursor.execute(
            "UPDATE system_state SET classification_running = 0, last_classification = %s WHERE id = 1",
            (now.strftime("%Y-%m-%d %H:%M:%S"),),
        )
        conn.commit()
        cursor.close()
    finally:
        conn.close()

    fresh_state = fetch_full_state()
    update_job_in_db(
        job_id,
        status="success",
        progress=100.0,
        current_step=total_steps - 1,
        result_obj=fresh_state,
    )


class StartClassificationRequest(BaseModel):
    forceFailure: bool = False
    skuFeatures: Optional[List[SkuFeatureInput]] = None


@app.post("/api/classifications/start")
async def start_classification(req: StartClassificationRequest, background_tasks: BackgroundTasks):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT classification_running FROM system_state WHERE id = 1")
        st = cursor.fetchone()
        if st and st["classification_running"]:
            raise HTTPException(status_code=409, detail="Klasifikasi sedang berjalan.")

        job_id = f"job-cls-{uuid.uuid4().hex[:10]}"
        cursor.execute("UPDATE system_state SET classification_running = 1 WHERE id = 1")
        cursor.execute(
            """
            INSERT INTO process_jobs (id, kind, status, progress, current_step, total_steps)
            VALUES (%s, 'classification', 'running', 0, 0, 4)
            """,
            (job_id,),
        )
        conn.commit()
        cursor.close()
    finally:
        conn.close()

    background_tasks.add_task(run_classification_job, job_id, req.forceFailure, req.skuFeatures)
    return {"jobId": job_id, "status": "running", "progress": 0, "currentStep": 0}


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM process_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        cursor.close()
        if not row:
            raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
        return {
            "id": row["id"],
            "kind": row["kind"],
            "status": row["status"],
            "progress": row["progress"],
            "currentStep": row["current_step"],
            "totalSteps": row["total_steps"],
            "errorCode": row["error_code"],
            "reason": row["reason"],
            "result": json.loads(row["result_json"]) if row["result_json"] else None,
        }
    finally:
        conn.close()


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    CANCELLED_JOBS.add(job_id)
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT kind, status FROM process_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
        if row["kind"] == "classification":
            cursor.execute("UPDATE system_state SET classification_running = 0 WHERE id = 1")
        cursor.execute(
            "UPDATE process_jobs SET status = 'cancelled', progress = 0, current_step = 0 WHERE id = %s",
            (job_id,),
        )
        conn.commit()
        cursor.close()
        return {"ok": True, "id": job_id, "status": "cancelled"}
    finally:
        conn.close()


class ReviewRequest(BaseModel):
    id: str
    skuIds: List[str]
    classificationAt: str


@app.post("/api/recommendations/review")
def create_recommendation_review(req: ReviewRequest):
    now = datetime.now()
    cls_dt = req.classificationAt.replace("Z", "").split(".")[0].replace("T", " ")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO recommendation_reviews (id, at, sku_ids_json, classification_at)
            VALUES (%s, %s, %s, %s)
            """,
            (req.id, now.strftime("%Y-%m-%d %H:%M:%S"), json.dumps(req.skuIds), cls_dt),
        )
        conn.commit()
        cursor.close()
        return {
            "id": req.id,
            "at": now.isoformat(),
            "skuIds": req.skuIds,
            "classificationAt": req.classificationAt,
        }
    finally:
        conn.close()


@app.delete("/api/recommendations/review/{review_id}")
def delete_recommendation_review(review_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM recommendation_reviews WHERE id = %s", (review_id,))
        conn.commit()
        cursor.close()
        return {"ok": True, "id": review_id}
    finally:
        conn.close()


# Sajikan hasil build produksi Frontend React (folder dist/) jika tersedia
DIST_DIR = Path(__file__).parent.parent / "dist"
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        candidate = DIST_DIR / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(DIST_DIR / "index.html"))


