"""Iteration-2 feature tests for E-IZICUT.

Covers:
- GET /api/recap (monthly / satfung / top, and satfung scoping)
- GET /api/personnel?jenis=... filter
- POST /api/auth/change-password (happy path, wrong current, weak new)
- POST /api/personnel with a brand new tahun (2027) -> /api/years reflects it
"""

import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ADMIN_USER = "admin"
ADMIN_PASS = "Mimika2026!"


# ---------- helpers ----------
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(tk):
    return {"Authorization": f"Bearer {tk}"}


# ---------- Recap ----------
class TestRecap:
    def test_recap_2025_shape(self):
        r = requests.get(f"{BASE_URL}/api/recap", params={"tahun": 2025}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["tahun"] == 2025
        assert isinstance(data["monthly"], list) and len(data["monthly"]) == 12
        for i, m in enumerate(data["monthly"], start=1):
            assert m["bulan"] == i
            assert "izin" in m and "cuti" in m
            assert isinstance(m["izin"], int) and isinstance(m["cuti"], int)
        assert isinstance(data["satfung"], list) and len(data["satfung"]) > 0
        # ordering by total_pengajuan desc
        totals = [s["total_pengajuan"] for s in data["satfung"]]
        assert totals == sorted(totals, reverse=True)
        for s in data["satfung"]:
            assert {"satfung", "total_personil", "total_pengajuan", "izin", "cuti"} <= set(s.keys())
        assert isinstance(data["top"], list)
        assert len(data["top"]) <= 15
        for t in data["top"]:
            assert t["total"] == t["izin"] + t["cuti"]
            assert {"personnel_id", "nama", "satfung"} <= set(t.keys())

    def test_recap_scoped_by_satfung(self):
        # pick a satfung from the unscoped call
        base = requests.get(f"{BASE_URL}/api/recap", params={"tahun": 2025}, timeout=30).json()
        assert base["satfung"], "expected at least one satfung"
        sf = base["satfung"][0]["satfung"]

        r = requests.get(f"{BASE_URL}/api/recap", params={"tahun": 2025, "satfung": sf}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["satfung_filter"] == sf
        # top personnel must all be from that satfung
        for t in data["top"]:
            assert t["satfung"] == sf
        # monthly totals should be <= unscoped monthly totals (subset)
        for scoped, full in zip(data["monthly"], base["monthly"]):
            assert scoped["izin"] <= full["izin"]
            assert scoped["cuti"] <= full["cuti"]


# ---------- Personnel jenis filter ----------
class TestJenisFilter:
    @pytest.mark.parametrize("jenis", ["CUTI_BEROBAT", "CUTI_IBADAH_UMROH", "IZIN", "EMERGENCY"])
    def test_filter_returns_only_matching(self, jenis):
        r = requests.get(f"{BASE_URL}/api/personnel",
                         params={"tahun": 2025, "jenis": jenis, "limit": 500}, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        # every returned personnel must have at least one leave of that jenis
        for p in rows:
            leaves = p.get("leaves", [])
            assert any(lv.get("jenis") == jenis for lv in leaves), (
                f"personnel {p.get('id')} has no {jenis} leave: {[lv.get('jenis') for lv in leaves]}"
            )

    def test_no_jenis_returns_more_or_equal(self):
        all_r = requests.get(f"{BASE_URL}/api/personnel", params={"tahun": 2025, "limit": 500}, timeout=30)
        filt_r = requests.get(f"{BASE_URL}/api/personnel",
                              params={"tahun": 2025, "jenis": "CUTI_BEROBAT", "limit": 500}, timeout=30)
        assert all_r.status_code == 200 and filt_r.status_code == 200
        assert len(filt_r.json()) <= len(all_r.json())


# ---------- Change password ----------
class TestChangePassword:
    def test_change_password_flow(self, token):
        new_pw = "TempPass2026!"
        # 1) happy path
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          json={"current_password": ADMIN_PASS, "new_password": new_pw},
                          headers=auth(token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # 2) login with the new password works
        r2 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"username": ADMIN_USER, "password": new_pw}, timeout=15)
        assert r2.status_code == 200, r2.text
        new_token = r2.json()["access_token"]

        # 3) wrong current -> 400
        r3 = requests.post(f"{BASE_URL}/api/auth/change-password",
                           json={"current_password": "wrong-pw", "new_password": "SomethingElse123"},
                           headers=auth(new_token), timeout=15)
        assert r3.status_code == 400

        # 4) new pw too short -> 422
        r4 = requests.post(f"{BASE_URL}/api/auth/change-password",
                           json={"current_password": new_pw, "new_password": "abc"},
                           headers=auth(new_token), timeout=15)
        assert r4.status_code == 422

        # 5) CRITICAL: restore the original password so test_credentials.md stays valid
        r5 = requests.post(f"{BASE_URL}/api/auth/change-password",
                           json={"current_password": new_pw, "new_password": ADMIN_PASS},
                           headers=auth(new_token), timeout=15)
        assert r5.status_code == 200, f"FAILED TO RESTORE PASSWORD: {r5.text}"

        # 6) confirm original login works again
        r6 = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
        assert r6.status_code == 200, "Admin password not restored!"

    def test_login_still_works(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
        assert r.status_code == 200
        assert "access_token" in r.json()


# ---------- New-year personnel ----------
class TestNewYear:
    def test_create_personnel_new_year(self, token):
        # First: confirm 2027 is not already in /years (or note it)
        years_before = requests.get(f"{BASE_URL}/api/years", timeout=15).json()

        payload = {
            "nama": "TEST_ITER2 NEW YEAR",
            "pangkat": "BRIPKA",
            "nrp": "TEST_ITER2_2027",
            "jabatan": "QA",
            "satfung": "LAINNYA",
            "tahun": 2027,
        }
        r = requests.post(f"{BASE_URL}/api/personnel", json=payload,
                          headers=auth(token), timeout=15)
        assert r.status_code == 200, r.text
        person = r.json()
        pid = person["id"]
        assert person["tahun"] == 2027
        assert person["nama"] == "TEST_ITER2 NEW YEAR"

        try:
            # /api/years should now include 2027
            years_after = requests.get(f"{BASE_URL}/api/years", timeout=15).json()
            assert 2027 in years_after, f"2027 missing from /years after create: {years_after}"

            # And the person should be listable via /api/personnel?tahun=2027
            r2 = requests.get(f"{BASE_URL}/api/personnel", params={"tahun": 2027}, timeout=15)
            assert r2.status_code == 200
            ids = [p["id"] for p in r2.json()]
            assert pid in ids

            # Add a leave to confirm the optional first-leave flow works
            r3 = requests.post(f"{BASE_URL}/api/personnel/{pid}/leaves",
                               json={"jenis": "CUTI_TAHUNAN", "tanggal": "2027-01-15", "alasan": "test"},
                               headers=auth(token), timeout=15)
            assert r3.status_code == 200, r3.text
            assert r3.json()["jenis"] == "CUTI_TAHUNAN"
        finally:
            # cleanup: soft-delete the test personnel
            requests.delete(f"{BASE_URL}/api/personnel/{pid}", headers=auth(token), timeout=15)

        # Also verify years_before either lacked 2027 or already had it (informational)
        assert isinstance(years_before, list)
