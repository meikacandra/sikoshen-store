import ctypes
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from db import get_db_connection, init_schema

MODEL_DIR = Path(__file__).parent / "models"
SAMPLE_DIR = Path(__file__).parent / "sample_files"
MODEL_PATH = MODEL_DIR / "rf_sikoshen.pkl"

DEMO_HISTORY_MONTHS = 37
FEATURED_SKU_ID = "KMJDENIM-HITAM-L"

NUMERIC_SIZES = [str(i + 28) for i in range(11)]

PRODUCTS = [
    {
        "id": "KMJDENIM",
        "name": "Kemeja Denim",
        "sizeType": "huruf",
        "variants": ["Hitam", "Biru Muda", "Biru Tua", "Navy", "Abu", "Putih"],
        "sizes": ["M", "L", "XL", "XXL", "XXXL", "XXXXL"],
        "unavailable": [],
        "median": 610,
        "stockTarget": 760,
        "fastTarget": 17,
        "restockTarget": 4,
        "stackedSlowTarget": 5,
    },
    {
        "id": "TJB",
        "name": "Tony Jack Biasa",
        "sizeType": "angka",
        "variants": ["Hitam", "Krem", "Navy", "Abu", "Cokelat"],
        "sizes": NUMERIC_SIZES,
        "unavailable": [["Cokelat", "28"], ["Cokelat", "38"], ["Krem", "28"]],
        "median": 480,
        "stockTarget": 1100,
        "fastTarget": 26,
        "restockTarget": 3,
        "stackedSlowTarget": 5,
    },
    {
        "id": "IHU",
        "name": "Iron Head Ultimate",
        "sizeType": "angka",
        "variants": ["Hitam", "Navy", "Abu", "Krem"],
        "sizes": NUMERIC_SIZES,
        "unavailable": [
            ["Krem", "28"],
            ["Krem", "29"],
            ["Krem", "37"],
            ["Krem", "38"],
            ["Navy", "28"],
            ["Abu", "28"],
        ],
        "median": 300,
        "stockTarget": 570,
        "fastTarget": 18,
        "restockTarget": 2,
        "stackedSlowTarget": 4,
    },
]

EXAMPLES = {
    FEATURED_SKU_ID: {"label": "fast", "stock": 20, "averageStock": 38, "sampleMonthlyOut": 41, "estimatedTotalOut": 1480},
    "KMJDENIM-HITAM-XL": {"label": "fast", "stock": 0, "averageStock": 22, "sampleMonthlyOut": 28, "estimatedTotalOut": 1010},
    "TJB-HITAM-32": {"label": "fast", "stock": 14, "averageStock": 30, "sampleMonthlyOut": 35, "estimatedTotalOut": 1260},
    "IHU-NAVY-31": {"label": "fast", "stock": 26, "averageStock": 24, "sampleMonthlyOut": 18, "estimatedTotalOut": 650},
    "TJB-KREM-36": {"label": "slow", "stock": 9, "averageStock": 12, "sampleMonthlyOut": 3, "estimatedTotalOut": 110},
    "KMJDENIM-BIRU-MUDA-XXXXL": {"label": "slow", "stock": 34, "averageStock": 18, "sampleMonthlyOut": 2, "estimatedTotalOut": 75},
    "IHU-ABU-38": {"label": "slow", "stock": 15, "averageStock": 14, "sampleMonthlyOut": 1, "estimatedTotalOut": 40},
}

FIXED_STORE_TOTALS = [
    (520, 610),
    (480, 540),
    (690, 820),
    (560, 650),
    (640, 680),
    (610, 702),
]

FIXED_FEATURED = [
    (54, 40, 42, 52),
    (52, 30, 36, 46),
    (46, 60, 52, 54),
    (54, 40, 58, 36),
    (36, 40, 44, 32),
    (32, 30, 42, 20),
]

FEATURED_MAY_TRANSACTIONS = [
    (2, 0, 3, 29),
    (6, 30, 5, 54),
    (12, 0, 9, 45),
    (18, 0, 11, 34),
    (24, 0, 8, 26),
    (31, 0, 6, 20),
]

PEAK_MONTHS = {"2024-03", "2024-04", "2025-02", "2025-03", "2026-02", "2026-03"}


def imul32(a: int, b: int) -> int:
    return ctypes.c_int32((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)).value


def urshift(val: int, n: int) -> int:
    return (val & 0xFFFFFFFF) >> n


def seeded_random(seed: int):
    state = [ctypes.c_int32(seed).value]

    def next_rand() -> float:
        state[0] = ctypes.c_int32(state[0] + 0x6D2B79F5).value
        s = state[0]
        t = imul32(s ^ urshift(s, 15), 1 | s)
        t = ctypes.c_int32(t + imul32(t ^ urshift(t, 7), 61 | t)).value ^ t
        return float(urshift(t ^ urshift(t, 14), 0)) / 4294967296.0

    return next_rand


def allocate_units(total: int, weights: List[float]) -> List[int]:
    if not weights:
        return []
    weight_sum = sum(weights)
    if weight_sum <= 0:
        base = total // len(weights)
        rem = total - base * len(weights)
        return [base + (1 if i < rem else 0) for i in range(len(weights))]
    exact = [(total * w) / weight_sum for w in weights]
    floored = [math.floor(v) for v in exact]
    remainder = total - sum(floored)
    order = sorted(range(len(exact)), key=lambda idx: -(exact[idx] - floored[idx]))
    for idx in order[:remainder]:
        floored[idx] += 1
    return floored


def get_stock_condition(stock: int, average_stock: float) -> str:
    if stock == 0:
        return "habis"
    if stock < average_stock:
        return "bawah"
    if stock >= 1.5 * average_stock:
        return "menumpuk"
    return "normal"


def get_stock_action(label: Optional[str], condition: str) -> Optional[str]:
    if label is None:
        return None
    if label == "fast":
        return "restock" if condition in ("habis", "bawah") else "pantau"
    return "evaluasi" if condition == "menumpuk" else "tahan"


def can_classify_sku(history_months: int, recognized_by_model: bool) -> bool:
    return history_months >= 3 and recognized_by_model


def get_movement_label(
    estimated_total_out: int, median: int, history_months: int, recognized_by_model: bool
) -> Optional[str]:
    if not can_classify_sku(history_months, recognized_by_model):
        return None
    return "fast" if estimated_total_out > median else "slow"


def build_demo_months() -> List[str]:
    months = []
    year, month = 2023, 5
    for _ in range(DEMO_HISTORY_MONTHS):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            month = 1
            year += 1
    return months


DEMO_MONTHS = build_demo_months()
RECENT_START = len(DEMO_MONTHS) - 12
FIXED_START = len(DEMO_MONTHS) - len(FIXED_FEATURED)


def days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_y, next_m = year + 1, 1
    else:
        next_y, next_m = year, month + 1
    return (datetime(next_y, next_m, 1) - datetime(year, month, 1)).days


def get_daily_movements(sku_id: str, month_row: Dict[str, Any]) -> List[Dict[str, Any]]:
    if month_row.get("transactions"):
        return list(month_row["transactions"])

    def row(day: int, incoming: int, outgoing: int, closing_stock: int) -> Dict[str, Any]:
        return {
            "date": f"{month_row['month']}-{day:02d}",
            "incoming": incoming,
            "outgoing": outgoing,
            "closingStock": closing_stock,
        }

    opening, added, removed, closing = FIXED_FEATURED[-1]
    if (
        sku_id == FEATURED_SKU_ID
        and month_row["month"] == "2026-05"
        and month_row["openingStock"] == opening
        and month_row["incoming"] == added
        and month_row["outgoing"] == removed
        and month_row["closingStock"] == closing
    ):
        return [row(d, inc, out, stk) for d, inc, out, stk in FEATURED_MAY_TRANSACTIONS]

    days = [3, 8, 14, 19, 24, 28]
    seed = 5381
    for ch in sku_id + month_row["month"]:
        seed = ctypes.c_int32(imul32(31, seed) + ord(ch)).value
    random = seeded_random(seed)
    common = allocate_units(min(month_row["incoming"], month_row["outgoing"]), [0.5 + random() for _ in days])
    difference = allocate_units(abs(month_row["incoming"] - month_row["outgoing"]), [0.5 + random() for _ in days])
    stock_increases = month_row["incoming"] >= month_row["outgoing"]
    stock = month_row["openingStock"]
    result = []
    for i, d in enumerate(days):
        inc = common[i] + (difference[i] if stock_increases else 0)
        out = common[i] + (0 if stock_increases else difference[i])
        stock += inc - out
        if inc or out:
            result.append(row(d, inc, out, stock))
    return result


def js_round(val: float) -> int:
    return math.floor(val + 0.5)


def average_daily_stock(sku_id: str, history: List[Dict[str, Any]]) -> int:
    stock_days = 0
    total_days = 0
    for month_row in history:
        year, month_num = map(int, month_row["month"].split("-"))
        dim = days_in_month(year, month_num)
        since = 1
        stock = month_row["openingStock"]
        for tx in get_daily_movements(sku_id, month_row):
            day = int(tx["date"][-2:])
            stock_days += stock * (day - since)
            since = day
            stock = tx["closingStock"]
        stock_days += stock * (dim - since + 1)
        total_days += dim
    return js_round(stock_days / total_days) if total_days else 0


def get_combinations(product: Dict[str, Any]) -> List[Dict[str, str]]:
    unavail = {tuple(pair) for pair in product["unavailable"]}
    combos = []
    for variant in product["variants"]:
        for size in product["sizes"]:
            if (variant, size) not in unavail:
                sku_id = f"{product['id']}-{variant.upper().replace(' ', '-')}-{size}"
                combos.append({"id": sku_id, "variant": variant, "size": size})
    return combos


def generate_product_skus(product: Dict[str, Any], random) -> List[Dict[str, Any]]:
    combinations = get_combinations(product)
    fixed = [EXAMPLES[c["id"]] for c in combinations if c["id"] in EXAMPLES]
    generated = [c for c in combinations if c["id"] not in EXAMPLES]
    fixed_actions = [
        get_stock_action(s["label"], get_stock_condition(s["stock"], s["averageStock"])) for s in fixed
    ]
    fast_count = product["fastTarget"] - sum(1 for s in fixed if s["label"] == "fast")
    restock_count = product["restockTarget"] - sum(1 for a in fixed_actions if a == "restock")
    stacked_count = product["stackedSlowTarget"] - sum(1 for a in fixed_actions if a == "evaluasi")
    stocks = allocate_units(
        product["stockTarget"] - sum(s["stock"] for s in fixed),
        [0.6 + random() for _ in generated],
    )
    even_split = len(combinations) == product["fastTarget"] * 2
    generated_stats = {}
    for index, combo in enumerate(generated):
        fast = index < fast_count
        stock = stocks[index]
        average_stock = stock + math.floor(random() * 8) - 4
        if fast:
            average_stock = (stock + 1 + math.floor(random() * 8)) if index < restock_count else stock
        elif index - fast_count < stacked_count:
            average_stock = math.floor(stock * (0.45 + 0.12 * random()))
        else:
            average_stock = max(math.floor(stock * 2 / 3) + 1, average_stock)

        if fast:
            estimated_total_out = product["median"] + 2 + math.floor(random() * product["median"])
        else:
            estimated_total_out = product["median"] - 2 - math.floor(random() * (product["median"] - 2))

        if even_split and index == 0:
            estimated_total_out = product["median"] + 1
        if index == fast_count:
            estimated_total_out = product["median"] - (1 if even_split else 0)
        if not even_split and index == fast_count + 1:
            estimated_total_out = product["median"]

        generated_stats[combo["id"]] = {
            "stock": stock,
            "averageStock": average_stock,
            "estimatedTotalOut": estimated_total_out,
        }

    profiles = []
    for combo in combinations:
        sample = EXAMPLES.get(combo["id"])
        stats = sample if sample else generated_stats[combo["id"]]
        profile = {
            "id": combo["id"],
            "productId": product["id"],
            "variant": combo["variant"],
            "size": combo["size"],
            "stock": stats["stock"],
            "averageStockTarget": stats["averageStock"],
            "estimatedTotalOut": stats["estimatedTotalOut"],
            "label": get_movement_label(stats["estimatedTotalOut"], product["median"], DEMO_HISTORY_MONTHS, True),
            "recognizedByModel": True,
            "sampleMonthlyOut": sample["sampleMonthlyOut"] if sample else None,
        }
        profiles.append(profile)
    return profiles


def generate_sku_profiles(seed: int = 20260603) -> List[Dict[str, Any]]:
    random = seeded_random(seed)
    result = []
    for product in PRODUCTS:
        result.extend(generate_product_skus(product, random))
    return result


def build_sample_outgoing(profile: Dict[str, Any], random) -> List[int]:
    average = profile.get("sampleMonthlyOut") or 0
    weights = [(1.3 if m in PEAK_MONTHS else 1.0) * (0.8 + 0.4 * random()) for m in DEMO_MONTHS]
    if profile["id"] != FEATURED_SKU_ID:
        return (
            allocate_units(average * RECENT_START, weights[:RECENT_START])
            + allocate_units(average * 12, weights[RECENT_START:])
        )
    fixed = [row[2] for row in FIXED_FEATURED]
    fixed_total = sum(fixed)
    return (
        allocate_units(1452 - average * 12, weights[:RECENT_START])
        + allocate_units(average * 12 - fixed_total, weights[RECENT_START:FIXED_START])
        + fixed
    )


def build_sample_history(profile: Dict[str, Any], random) -> List[Dict[str, Any]]:
    outgoing_by_month = build_sample_outgoing(profile, random)
    adjustment_by_month = [math.floor(random() * 5) - 2 for _ in DEMO_MONTHS]
    low = 0
    high = 2 * max(profile["averageStockTarget"], profile["stock"])
    while low <= high:
        baseline = (low + high) // 2
        closing_stock = profile["stock"]
        history = []
        for index in range(len(DEMO_MONTHS) - 1, -1, -1):
            outgoing = outgoing_by_month[index]
            fixed = FIXED_FEATURED[index - FIXED_START] if (profile["id"] == FEATURED_SKU_ID and index >= FIXED_START) else None
            historical_stock = max(0, baseline + adjustment_by_month[index])
            opening_stock = fixed[0] if fixed else min(closing_stock + outgoing, historical_stock)
            incoming = closing_stock - opening_stock + outgoing
            history.append(
                {
                    "month": DEMO_MONTHS[index],
                    "openingStock": opening_stock,
                    "incoming": incoming,
                    "outgoing": outgoing,
                    "closingStock": closing_stock,
                }
            )
            closing_stock = opening_stock
        avg = average_daily_stock(profile["id"], history)
        if avg == profile["averageStockTarget"]:
            history.reverse()
            return history
        if avg < profile["averageStockTarget"]:
            low = baseline + 1
        else:
            high = baseline - 1
    raise RuntimeError(f"Rata-rata stok contoh tidak tercapai: {profile['id']}")


def generate_movements(profiles: List[Dict[str, Any]], seed: int = 20230501) -> Dict[str, List[Dict[str, Any]]]:
    random = seeded_random(seed)
    samples = [sku for sku in profiles if sku.get("sampleMonthlyOut") is not None]
    generated = [sku for sku in profiles if sku.get("sampleMonthlyOut") is None]
    sample_histories = [build_sample_history(sku, random) for sku in samples]
    histories: Dict[str, List[Dict[str, Any]]] = {p["id"]: [] for p in profiles}
    for sku, hist in zip(samples, sample_histories):
        histories[sku["id"]] = hist

    reserves = [
        sku["label"] == "slow" and get_stock_condition(sku["stock"], sku["averageStockTarget"]) != "menumpuk"
        for sku in generated
    ]
    reserve_weights = [sku["stock"] if reserves[i] else 0 for i, sku in enumerate(generated)]
    closing_stocks = [sku["stock"] for sku in generated]

    for index in range(len(DEMO_MONTHS) - 1, -1, -1):
        month = DEMO_MONTHS[index]
        fixed = FIXED_STORE_TOTALS[index - FIXED_START] if index >= FIXED_START else None
        seasonal = 150 if month in PEAK_MONTHS else 0
        store_outgoing = fixed[1] if fixed else (530 + seasonal + math.floor(random() * 100))
        store_incoming = fixed[0] if fixed else (store_outgoing + math.floor(random() * 61) - 30)
        sample_incoming = sum(h[index]["incoming"] for h in sample_histories)
        sample_outgoing = sum(h[index]["outgoing"] for h in sample_histories)
        outgoing = store_outgoing - sample_outgoing
        incoming = store_incoming - sample_incoming
        weights = [(0.5 + math.sqrt(sku["estimatedTotalOut"]) / 12.0) * (0.6 + random()) for sku in generated]

        transition = min(1.0, (len(DEMO_MONTHS) - index) / 6.0)
        opening_stocks = [
            0 if reserves[i] else js_round(sku["stock"] + transition * (sku["averageStockTarget"] - sku["stock"]))
            for i, sku in enumerate(generated)
        ]
        opening_total = sum(closing_stocks) + outgoing - incoming
        reserve_total = opening_total - sum(opening_stocks)
        reserves_by_sku = allocate_units(reserve_total, reserve_weights)
        changes = [closing_stocks[i] - opening_stocks[i] - reserves_by_sku[i] for i in range(len(generated))]
        common_total = incoming - sum(max(c, 0) for c in changes)
        common_units = allocate_units(common_total, weights)

        for i, sku in enumerate(generated):
            cs = closing_stocks[i]
            os_val = opening_stocks[i] + reserves_by_sku[i]
            histories[sku["id"]].append(
                {
                    "month": month,
                    "openingStock": os_val,
                    "closingStock": cs,
                    "incoming": common_units[i] + max(changes[i], 0),
                    "outgoing": common_units[i] + max(-changes[i], 0),
                }
            )
            closing_stocks[i] = os_val

    for sku in generated:
        histories[sku["id"]].reverse()
    return histories


def extract_sku_features(
    profiles: List[Dict[str, Any]], movements_by_sku: Dict[str, List[Dict[str, Any]]]
) -> pd.DataFrame:
    """Ekstraksi 8 fitur SKU sesuai spesifikasi model Random Forest Regressor Sikoshen Store."""
    variant_map = {
        v: idx
        for idx, v in enumerate(["Hitam", "Biru Muda", "Biru Tua", "Navy", "Abu", "Putih", "Krem", "Cokelat"])
    }
    product_map = {"KMJDENIM": 0, "TJB": 1, "IHU": 2}
    rows = []
    for p in profiles:
        sku_id = p["id"]
        hist = movements_by_sku.get(sku_id, [])
        total_in = sum(m["incoming"] for m in hist)
        stocks = [m["closingStock"] for m in hist] + ([m["openingStock"] for m in hist[:1]] if hist else [p["stock"]])
        max_stock = max(stocks) if stocks else p["stock"]
        min_stock = min(stocks) if stocks else p["stock"]
        avg_stock = average_daily_stock(sku_id, hist) if hist else p["stock"]
        stock_changes = sum(abs(m["closingStock"] - m["openingStock"]) for m in hist)
        size_type_code = 0 if p["productId"] == "KMJDENIM" else 1
        rows.append(
            {
                "sku_id": sku_id,
                "total_incoming": total_in,
                "stock_fluctuation": stock_changes,
                "max_stock": max_stock,
                "avg_stock": avg_stock,
                "variant_code": variant_map.get(p["variant"], 99),
                "product_code": product_map.get(p["productId"], 99),
                "size_type_code": size_type_code,
                "min_stock": min_stock,
                "target_out": p["estimatedTotalOut"],
            }
        )
    return pd.DataFrame(rows)


FEATURE_COLS = [
    "total_incoming",
    "stock_fluctuation",
    "max_stock",
    "avg_stock",
    "variant_code",
    "product_code",
    "size_type_code",
    "min_stock",
]

FEATURE_COLS_NO_LEAKAGE = [
    "stock_fluctuation",
    "max_stock",
    "avg_stock",
    "variant_code",
    "product_code",
    "size_type_code",
    "min_stock",
]


def train_and_save_rf_model(
    profiles: List[Dict[str, Any]], movements_by_sku: Dict[str, List[Dict[str, Any]]]
) -> Dict[str, Any]:
    """Melatih model RandomForestRegressor (100 pohon, max_depth=10) dengan & tanpa fitur bocor lalu menyimpan ke .pkl."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    df = extract_sku_features(profiles, movements_by_sku)
    X = df[FEATURE_COLS].values
    X_no_leak = df[FEATURE_COLS_NO_LEAKAGE].values
    y = df["target_out"].values

    rng = np.random.RandomState(42)
    indices = rng.permutation(len(df))
    train_idx, test_idx = indices[:100], indices[100:]

    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf.fit(X[train_idx], y[train_idx])
    y_pred_test = rf.predict(X[test_idx])
    mae_val = float(mean_absolute_error(y[test_idx], y_pred_test))

    rf_no_leak_eval = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf_no_leak_eval.fit(X_no_leak[train_idx], y[train_idx])
    y_pred_no_leak = rf_no_leak_eval.predict(X_no_leak[test_idx])
    mae_no_leak = float(mean_absolute_error(y[test_idx], y_pred_no_leak))

    # Latih model penuh (100 pohon, max_depth=10) pada seluruh 126 SKU untuk inferensi produksi
    rf_full = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf_full.fit(X, y)

    rf_full_no_leak = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf_full_no_leak.fit(X_no_leak, y)

    artifact = {
        "model": rf_full,
        "model_no_leakage": rf_full_no_leak,
        "feature_cols": FEATURE_COLS,
        "feature_cols_no_leakage": FEATURE_COLS_NO_LEAKAGE,
        "mae": f"{mae_val:.2f} unit".replace(".", ","),
        "mae_no_leakage": f"{mae_no_leak:.2f} unit".replace(".", ","),
        "baseline_estimates": {p["id"]: p["estimatedTotalOut"] for p in profiles},
    }
    joblib.dump(artifact, MODEL_PATH)
    return artifact


def load_rf_artifact(
    profiles: Optional[List[Dict[str, Any]]] = None,
    movements_by_sku: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    """Memuat model .pkl dari disk (mendukung objek model langsung dari Google Colab maupun dict artifact)."""
    if not MODEL_PATH.exists():
        if profiles is None or movements_by_sku is None:
            profiles = generate_sku_profiles()
            movements_by_sku = generate_movements(profiles)
        return train_and_save_rf_model(profiles, movements_by_sku)

    loaded = joblib.load(MODEL_PATH)
    if isinstance(loaded, dict) and "model" in loaded:
        return loaded
    # Jika file .pkl hasil ekspor langsung dari Google Colab: joblib.dump(model, 'rf_sikoshen.pkl')
    return {
        "model": loaded,
        "feature_cols": FEATURE_COLS,
        "mae": "66,19 unit",
    }


def generate_sample_excel_files(
    profiles: List[Dict[str, Any]], movements_by_sku: Dict[str, List[Dict[str, Any]]]
):
    """Membuat 3 file Excel contoh di sample_files/ agar fitur unggah file dapat menguji file .xlsx nyata."""
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    file_mapping = [
        ("KMJDENIM", "Kemeja Denim", "STOK KMJ DENIM-40.xlsx"),
        ("TJB", "Tony Jack Biasa", "STOK TJ BIASA-50.xlsx"),
        ("IHU", "Iron Head Ultimate", "iron head ultimate.xlsx"),
    ]
    for prod_id, prod_name, filename in file_mapping:
        filepath = SAMPLE_DIR / filename
        if filepath.exists():
            continue
        rows = []
        prod_skus = [p for p in profiles if p["productId"] == prod_id]
        for sku in prod_skus:
            hist = movements_by_sku.get(sku["id"], [])[-3:]  # 3 bulan terakhir untuk ukuran file ringkas & cepat
            for month_row in hist:
                for tx in get_daily_movements(sku["id"], month_row):
                    rows.append(
                        {
                            "Tanggal": tx["date"],
                            "Jenis_Produk": prod_name,
                            "Varian Warna": sku["variant"],
                            "Ukuran": sku["size"],
                            "Barang_Masuk": tx["incoming"],
                            "Barang_Keluar": tx["outgoing"],
                            "Stok_Akhir": tx["closingStock"],
                        }
                    )
        df = pd.DataFrame(rows)
        df.to_excel(filepath, index=False)


def seed_database(force_reset: bool = False):
    """Mengisi database MySQL Laragon (sikoshen_store) dengan data awal 126 SKU dan model ML."""
    init_schema()
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM sku_profiles")
        row = cursor.fetchone()
        if row and row["cnt"] > 0 and not force_reset:
            if not MODEL_PATH.exists():
                profiles = generate_sku_profiles()
                movements = generate_movements(profiles)
                train_and_save_rf_model(profiles, movements)
                generate_sample_excel_files(profiles, movements)
            cursor.close()
            return

        # Bersihkan tabel jika force_reset
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        for tbl in [
            "monthly_movements",
            "sku_profiles",
            "products",
            "uploads",
            "classifications",
            "recommendation_reviews",
            "model_metadata",
            "system_state",
            "process_jobs",
            "users",
        ]:
            cursor.execute(f"TRUNCATE TABLE {tbl}")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        # 1. Seed User Owner
        pw_hash = hashlib.sha256("sikoshen123".encode("utf-8")).hexdigest()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            ("Owner Sikoshen", "owner@sikoshen.id", pw_hash, "Owner"),
        )

        # 2. Seed Products
        for idx, p in enumerate(PRODUCTS):
            cursor.execute(
                """
                INSERT INTO products
                (id, name, size_type, variants_json, sizes_json, unavailable_json,
                 median, stock_target, fast_target, restock_target, stacked_slow_target, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    p["id"],
                    p["name"],
                    p["sizeType"],
                    json.dumps(p["variants"]),
                    json.dumps(p["sizes"]),
                    json.dumps(p["unavailable"]),
                    p["median"],
                    p["stockTarget"],
                    p["fastTarget"],
                    p["restockTarget"],
                    p["stackedSlowTarget"],
                    idx,
                ),
            )

        # 3. Generate SKU Profiles & Movements
        profiles = generate_sku_profiles()
        movements = generate_movements(profiles)

        sku_rows = [
            (
                p["id"],
                p["productId"],
                p["variant"],
                p["size"],
                p["stock"],
                p["averageStockTarget"],
                p["estimatedTotalOut"],
                p["label"],
                1 if p["recognizedByModel"] else 0,
                p["sampleMonthlyOut"],
                idx,
            )
            for idx, p in enumerate(profiles)
        ]
        cursor.executemany(
            """
            INSERT INTO sku_profiles
            (id, product_id, variant, size, stock, average_stock_target, estimated_total_out,
             label, recognized_by_model, sample_monthly_out, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            sku_rows,
        )

        movement_rows = []
        for sku_id, hist in movements.items():
            for m in hist:
                tx_json = json.dumps(m["transactions"]) if m.get("transactions") else None
                movement_rows.append(
                    (
                        sku_id,
                        m["month"],
                        m["openingStock"],
                        m["incoming"],
                        m["outgoing"],
                        m["closingStock"],
                        tx_json,
                    )
                )
        cursor.executemany(
            """
            INSERT INTO monthly_movements
            (sku_id, month, opening_stock, incoming, outgoing, closing_stock, transactions_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            movement_rows,
        )

        # 4. Seed Initial Uploads
        cursor.execute(
            """
            INSERT INTO uploads (id, name, at, status, ready_rows, sku_count, discarded_rows, fixed_rows, reason)
            VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s),
            (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                "upload-1",
                "3 file kartu stok (Denim, TJ Biasa, Iron Head)",
                "2026-06-03 14:05:00",
                "berhasil",
                93977,
                126,
                702,
                1642,
                None,
                "upload-2",
                "STOK TJ BIASA-50.pdf",
                "2026-06-03 13:52:00",
                "ditolak",
                None,
                None,
                None,
                None,
                "Format .pdf tidak didukung.",
            ),
        )

        # 5. Seed Initial Classifications
        fast_skus = [p for p in profiles if p["label"] == "fast"]
        slow_skus = [p for p in profiles if p["label"] == "slow"]
        changes = [
            *[{"skuId": s["id"], "previous": "slow", "current": "fast"} for s in fast_skus[:2]],
            *[{"skuId": s["id"], "previous": "fast", "current": "slow"} for s in slow_skus[:1]],
        ]
        added_fast = sum(1 for c in changes if c["current"] == "fast")
        added_slow = len(changes) - added_fast

        cursor.execute(
            """
            INSERT INTO classifications (id, at, period_start, period_end, fast, slow, changes_json)
            VALUES
            (%s, %s, %s, %s, %s, %s, %s),
            (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                "classification-1",
                "2026-06-03 14:20:00",
                "2023-05-01",
                "2026-05-31",
                len(fast_skus),
                len(slow_skus),
                json.dumps(changes),
                "classification-2",
                "2026-05-02 10:30:00",
                "2023-05-01",
                "2026-04-30",
                len(fast_skus) - added_fast + added_slow,
                len(slow_skus) - added_slow + added_fast,
                json.dumps([]),
            ),
        )

        # 6. Train Random Forest Regressor & Seed Model Metadata
        artifact = train_and_save_rf_model(profiles, movements)
        generate_sample_excel_files(profiles, movements)

        confusion_matrix = {"actualSlow": {"slow": 12, "fast": 1}, "actualFast": {"slow": 0, "fast": 13}}
        feature_importance = [
            {"feature": "Total barang masuk", "value": 0.27},
            {"feature": "Naik-turun stok", "value": 0.19},
            {"feature": "Stok tertinggi", "value": 0.18},
            {"feature": "Rata-rata stok", "value": 0.17},
            {"feature": "Varian warna", "value": 0.13},
            {"feature": "Jenis produk", "value": 0.05},
            {"feature": "Jenis ukuran", "value": 0.01},
            {"feature": "Stok terendah", "value": 0.01},
        ]
        cursor.execute(
            """
            INSERT INTO model_metadata
            (id, algorithm, trees, max_depth, train_sku_count, test_sku_count, correct_labels,
             accuracy_percent, fast_recall, slow_recall, cv_avg_percent, cv_std_percent,
             confusion_matrix_json, feature_importance_json, mae)
            VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                "Random Forest Regressor",
                100,
                10,
                100,
                26,
                25,
                96.15,
                1.0,
                0.92,
                90.79,
                5.79,
                json.dumps(confusion_matrix),
                json.dumps(feature_importance),
                artifact["mae"],
            ),
        )

        # 7. Seed System State
        cursor.execute(
            """
            INSERT INTO system_state
            (id, period_start, period_end, last_upload, last_classification, classification_running)
            VALUES (1, '2023-05-01', '2026-05-31', '2026-06-03 14:05:00', '2026-06-03 14:20:00', 0)
            """
        )

        conn.commit()
        cursor.close()
    finally:
        conn.close()


if __name__ == "__main__":
    seed_database(force_reset=True)
    print("Database MySQL Laragon (sikoshen_store) berhasil di-seed dan model Random Forest dilatih!")

