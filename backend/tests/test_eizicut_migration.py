"""E-IZICUT migration verification tests.

Covers:
- Auth: login, /auth/me, change-password validation (no permanent change)
- Meta: /leave-types
- Template download (admin-guarded)
- Admin guards (401 without token) on write endpoints
- Personnel CRUD + leaves lifecycle
- Aggregates: /years /satfung /stats /recap
"""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
# Fallback: read frontend .env directly
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

API = f"{BASE_URL}/api"
ADMIN_U = "admin"
ADMIN_P = "Mimika2026!"

LEAVE_TYPES = {
    "IZIN", "EMERGENCY", "CUTI_TAHUNAN", "CUTI_BEROBAT",
    "CUTI_IBADAH_UMROH", "CUTI_IBADAH_HAJI", "CUTI_IBADAH_LAINNYA",
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(f"{API}/auth/login", json={"username": ADMIN_U, "password": ADMIN_P}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data.get("username") == ADMIN_U
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --------- Auth ---------
class TestAuth:
    def test_login_bad_password(self, session):
        r = session.post(f"{API}/auth/login", json={"username": ADMIN_U, "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_auth_me(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body == {"username": "admin", "role": "admin"}

    def test_auth_me_no_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_change_password_wrong_old(self, session, auth_headers):
        r = session.post(f"{API}/auth/change-password", json={"current_password": "nope", "new_password": "Mimika2026!"}, headers=auth_headers, timeout=10)
        assert r.status_code == 400

    def test_change_password_same_as_old(self, session, auth_headers):
        r = session.post(f"{API}/auth/change-password", json={"current_password": ADMIN_P, "new_password": ADMIN_P}, headers=auth_headers, timeout=10)
        assert r.status_code == 400

    def test_change_password_too_short(self, session, auth_headers):
        r = session.post(f"{API}/auth/change-password", json={"current_password": ADMIN_P, "new_password": "abc"}, headers=auth_headers, timeout=10)
        assert r.status_code == 422


# --------- Meta ---------
class TestMeta:
    def test_leave_types(self, session):
        r = session.get(f"{API}/leave-types", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 7
        keys = {d["key"] for d in data}
        assert keys == LEAVE_TYPES
        for d in data:
            assert d.get("label")

    def test_template_download_requires_admin(self, session):
        r = session.get(f"{API}/template", timeout=15)
        assert r.status_code == 401

    def test_template_download_ok(self, session, auth_headers):
        r = session.get(f"{API}/template", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert len(r.content) > 1000
        # xlsx starts with PK (zip signature)
        assert r.content[:2] == b"PK"


# --------- Admin guard on writes ---------
class TestAdminGuards:
    def test_create_personnel_no_token(self, session):
        r = session.post(f"{API}/personnel", json={"nama": "X", "tahun": 2025}, timeout=10)
        assert r.status_code == 401

    def test_patch_personnel_no_token(self, session):
        r = session.patch(f"{API}/personnel/does-not-exist", json={"nama": "X"}, timeout=10)
        assert r.status_code == 401

    def test_delete_personnel_no_token(self, session):
        r = session.delete(f"{API}/personnel/does-not-exist", timeout=10)
        assert r.status_code == 401

    def test_add_leave_no_token(self, session):
        r = session.post(f"{API}/personnel/x/leaves", json={"jenis": "IZIN", "tanggal": "2025-01-01"}, timeout=10)
        assert r.status_code == 401

    def test_patch_leave_no_token(self, session):
        r = session.patch(f"{API}/personnel/x/leaves/y", json={"jenis": "IZIN"}, timeout=10)
        assert r.status_code == 401

    def test_delete_leave_no_token(self, session):
        r = session.delete(f"{API}/personnel/x/leaves/y", timeout=10)
        assert r.status_code == 401

    def test_import_no_token(self, session):
        # send with an empty multipart to hit auth first
        r = requests.post(f"{API}/import", files={"file": ("t.xlsx", b"PK\x03\x04", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}, timeout=10)
        assert r.status_code == 401

    def test_invalid_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}, timeout=10)
        assert r.status_code == 401


# --------- Personnel CRUD + Leaves lifecycle ---------
class TestPersonnelLifecycle:
    created_id = None
    leave_id = None
    year = 2099  # far year so we don't collide with real seed data

    def test_a_create(self, session, auth_headers):
        payload = {
            "nama": "TEST_Migration User",
            "pangkat": "BRIPKA",
            "nrp": "TEST99999",
            "jabatan": "Bamin",
            "satfung": "TEST_SATFUNG",
            "tahun": self.year,
        }
        r = session.post(f"{API}/personnel", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "id" in body
        assert body["nama"] == payload["nama"]
        assert body["satfung"] == "TEST_SATFUNG"
        assert body["leaves"] == []
        TestPersonnelLifecycle.created_id = body["id"]

    def test_b_list_contains(self, session, auth_headers):
        r = session.get(f"{API}/personnel?tahun={self.year}", timeout=15)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TestPersonnelLifecycle.created_id in ids

    def test_c_get_detail(self, session):
        r = session.get(f"{API}/personnel/{TestPersonnelLifecycle.created_id}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == TestPersonnelLifecycle.created_id
        assert body["nama"] == "TEST_Migration User"

    def test_d_patch(self, session, auth_headers):
        r = session.patch(
            f"{API}/personnel/{TestPersonnelLifecycle.created_id}",
            json={"jabatan": "Kanit Test"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["jabatan"] == "Kanit Test"

    def test_e_add_leave(self, session, auth_headers):
        r = session.post(
            f"{API}/personnel/{TestPersonnelLifecycle.created_id}/leaves",
            json={"jenis": "IZIN", "tanggal": "2099-03-15", "alasan": "Test"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["jenis"] == "IZIN"
        assert body["tanggal"] == "2099-03-15"
        TestPersonnelLifecycle.leave_id = body["id"]

    def test_f_add_invalid_leave_type(self, session, auth_headers):
        r = session.post(
            f"{API}/personnel/{TestPersonnelLifecycle.created_id}/leaves",
            json={"jenis": "INVALID_TYPE", "tanggal": "2099-03-15"},
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 400

    def test_g_patch_leave(self, session, auth_headers):
        r = session.patch(
            f"{API}/personnel/{TestPersonnelLifecycle.created_id}/leaves/{TestPersonnelLifecycle.leave_id}",
            json={"alasan": "Updated reason"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        # verify via GET
        r2 = session.get(f"{API}/personnel/{TestPersonnelLifecycle.created_id}", timeout=10)
        lv = next(x for x in r2.json()["leaves"] if x["id"] == TestPersonnelLifecycle.leave_id)
        assert lv["alasan"] == "Updated reason"

    def test_h_years_and_satfung_populated(self, session):
        yrs = session.get(f"{API}/years", timeout=10).json()
        assert self.year in yrs
        sf = session.get(f"{API}/satfung?tahun={self.year}", timeout=10).json()
        assert any(s["satfung"] == "TEST_SATFUNG" for s in sf)

    def test_i_stats_and_recap(self, session):
        st = session.get(f"{API}/stats?tahun={self.year}", timeout=10)
        assert st.status_code == 200
        s = st.json()
        assert s["total_personil"] >= 1
        assert s["total_pengajuan"] >= 1

        rc = session.get(f"{API}/recap?tahun={self.year}", timeout=10)
        assert rc.status_code == 200
        rj = rc.json()
        assert len(rj["monthly"]) == 12
        assert any(x["satfung"] == "TEST_SATFUNG" for x in rj["satfung"])

    def test_j_delete_leave(self, session, auth_headers):
        r = session.delete(
            f"{API}/personnel/{TestPersonnelLifecycle.created_id}/leaves/{TestPersonnelLifecycle.leave_id}",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        r2 = session.get(f"{API}/personnel/{TestPersonnelLifecycle.created_id}", timeout=10)
        assert all(x["id"] != TestPersonnelLifecycle.leave_id for x in r2.json()["leaves"])

    def test_k_soft_delete_personnel(self, session, auth_headers):
        r = session.delete(
            f"{API}/personnel/{TestPersonnelLifecycle.created_id}",
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200
        # not in list
        lst = session.get(f"{API}/personnel?tahun={self.year}", timeout=10).json()
        assert all(p["id"] != TestPersonnelLifecycle.created_id for p in lst)
        # detail returns 404
        g = session.get(f"{API}/personnel/{TestPersonnelLifecycle.created_id}", timeout=10)
        assert g.status_code == 404


# --------- Password change (validation only, do NOT persist a real change) ---------
class TestNoPasswordChange:
    def test_password_is_still_the_original(self, session):
        r = session.post(f"{API}/auth/login", json={"username": ADMIN_U, "password": ADMIN_P}, timeout=10)
        assert r.status_code == 200
