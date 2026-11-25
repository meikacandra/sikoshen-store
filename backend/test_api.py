import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def run_tests():
    # 1. Reset ke kondisi awal
    r = client.post("/api/demo/reset")
    assert r.status_code == 200, r.text
    state = r.json()
    assert len(state["products"]) == 3
    assert len(state["profiles"]) == 126
    assert sum(p["stock"] for p in state["profiles"]) == 2430
    assert sum(1 for p in state["profiles"] if p["label"] == "fast") == 61
    assert sum(1 for p in state["profiles"] if p["label"] == "slow") == 65
    print("[OK] /api/state & /api/demo/reset: 126 SKU, 61 Fast / 65 Slow, 2.430 stok, MAE:", state["model"]["mae"])

    # 2. Test Login
    r_login = client.post("/api/auth/login", json={"email": "owner@sikoshen.id", "password": "sikoshen123"})
    assert r_login.status_code == 200
    assert r_login.json()["ok"] is True

    r_bad = client.post("/api/auth/login", json={"email": "owner@sikoshen.id", "password": "wrong"})
    assert r_bad.status_code == 401
    print("[OK] /api/auth/login: validasi kredensial MySQL berhasil")

    # 3. Test Upload Check Job (menggunakan 3 file contoh Excel di backend)
    r_chk = client.post(
        "/api/uploads/check",
        data={
            "scenario": "normal",
            "forceFailure": "false",
            "fileNamesJson": '["STOK KMJ DENIM-40.xlsx", "STOK TJ BIASA-50.xlsx", "iron head ultimate.xlsx"]',
        },
    )
    assert r_chk.status_code == 200
    job_id = r_chk.json()["jobId"]

    for _ in range(40):
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] in ("success", "failed", "cancelled"):
            break
        time.sleep(0.15)
    assert j["status"] == "success", j
    assert j["result"]["summary"]["readyRows"] == 93977
    assert j["result"]["summary"]["parsedFileRows"] > 0
    print("[OK] /api/uploads/check: pemeriksaan 3 file Excel selesai, baris terbaca:", j["result"]["summary"]["parsedFileRows"])

    # 4. Test Save Upload
    r_save = client.post(
        "/api/uploads/save",
        json={
            "fileName": "3 file kartu stok contoh",
            "saveMode": "june",
            "readyRows": 93977,
            "discardedRows": 702,
        },
    )
    assert r_save.status_code == 200
    saved_state = r_save.json()
    assert saved_state["status"]["periodEnd"] == "2026-06-30"
    print("[OK] /api/uploads/save: data Juni 2026 tersimpan di MySQL")

    # 5. Test Classification Job (Random Forest Regressor)
    r_cls = client.post("/api/classifications/start", json={"forceFailure": False})
    assert r_cls.status_code == 200
    cls_job_id = r_cls.json()["jobId"]
    for _ in range(45):
        cj = client.get(f"/api/jobs/{cls_job_id}").json()
        if cj["status"] in ("success", "failed", "cancelled"):
            break
        time.sleep(0.15)
    assert cj["status"] == "success", cj
    latest_cls = cj["result"]["classifications"][0]
    assert len(latest_cls["changes"]) == 3
    print("[OK] /api/classifications/start: klasifikasi Random Forest selesai, perubahan label:", len(latest_cls["changes"]))

    # 6. Kembalikan database MySQL ke kondisi awal bersih untuk pengguna
    client.post("/api/demo/reset")
    print("[OK] Database MySQL Laragon dikembalikan ke kondisi awal siap pakai!")


if __name__ == "__main__":
    run_tests()

