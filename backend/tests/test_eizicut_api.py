"""E-IZICUT backend API tests (public reads + admin writes)."""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # fallback to reading frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

API = f"{BASE_URL}/api"
ADMIN = {"username": "admin", "password": "Mimika2026!"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---- Meta / public reads ----
class TestPublicMeta:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_years(self):
        r = requests.get(f"{API}/years", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert 2025 in data and 2026 in data
        # returned sorted desc
        assert data == sorted(data, reverse=True)

    def test_satfung_2025(self):
        r = requests.get(f"{API}/satfung", params={"tahun": 2025}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 30
        assert all("satfung" in x and "count" in x for x in data)

    def test_stats_2025(self):
        r = requests.get(f"{API}/stats", params={"tahun": 2025}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total_personil"] == 711
        assert d["total_satfung"] >= 30
        assert d["total_pengajuan"] > 0
        assert isinstance(d["recent"], list)

    def test_stats_2026_zero_leaves(self):
        r = requests.get(f"{API}/stats", params={"tahun": 2026}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total_personil"] > 0
        assert d["total_pengajuan"] == 0  # by design

    def test_leave_types(self):
        r = requests.get(f"{API}/leave-types", timeout=15)
        assert r.status_code == 200
        keys = [x["key"] for x in r.json()]
        assert len(keys) == 5


class TestPersonnelPublic:
    def test_search_by_name(self):
        r = requests.get(f"{API}/personnel", params={"tahun": 2025, "q": "MANAF"}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
        assert any("MANAF" in (x.get("nama") or "").upper() for x in rows)
        assert "leave_count" in rows[0]

    def test_detail(self):
        rows = requests.get(f"{API}/personnel", params={"tahun": 2025, "q": "MANAF"}, timeout=20).json()
        pid = rows[0]["id"]
        r = requests.get(f"{API}/personnel/{pid}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == pid
        assert "leaves" in d and isinstance(d["leaves"], list)

    def test_detail_not_found(self):
        r = requests.get(f"{API}/personnel/does-not-exist-xyz", timeout=15)
        assert r.status_code == 404


# ---- Auth ----
class TestAuth:
    def test_login_ok(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_admin_endpoints_require_token(self):
        # POST personnel no auth
        r = requests.post(f"{API}/personnel", json={"nama": "X", "tahun": 2025}, timeout=15)
        assert r.status_code == 401
        # POST import no auth
        r = requests.post(f"{API}/import", files={"file": ("t.xlsx", b"x")}, timeout=15)
        assert r.status_code == 401


# ---- Admin CRUD & leaves ----
class TestAdminCRUD:
    created_pid = None
    created_lid = None

    def test_a_create_personnel(self, auth_headers):
        payload = {"nama": "TEST_QA_USER", "pangkat": "BRIPKA", "nrp": "TESTQA001",
                   "jabatan": "QA", "satfung": "BAG SDM", "tahun": 2025}
        r = requests.post(f"{API}/personnel", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["nama"] == "TEST_QA_USER"
        assert d["satfung"] == "BAG SDM"
        TestAdminCRUD.created_pid = d["id"]

        # GET verify persisted
        g = requests.get(f"{API}/personnel/{d['id']}", timeout=15)
        assert g.status_code == 200 and g.json()["nrp"] == "TESTQA001"

    def test_b_patch_personnel(self, auth_headers):
        pid = TestAdminCRUD.created_pid
        assert pid
        r = requests.patch(f"{API}/personnel/{pid}", json={"jabatan": "QA LEAD"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["jabatan"] == "QA LEAD"

    def test_c_add_leave(self, auth_headers):
        pid = TestAdminCRUD.created_pid
        payload = {"jenis": "IZIN", "tanggal": "2025-06-15", "alasan": "Testing"}
        r = requests.post(f"{API}/personnel/{pid}/leaves", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        lv = r.json()
        assert lv["jenis"] == "IZIN"
        TestAdminCRUD.created_lid = lv["id"]

        g = requests.get(f"{API}/personnel/{pid}", timeout=15).json()
        assert any(x["id"] == lv["id"] for x in g.get("leaves", []))

    def test_c2_add_leave_invalid_type(self, auth_headers):
        pid = TestAdminCRUD.created_pid
        r = requests.post(f"{API}/personnel/{pid}/leaves",
                          json={"jenis": "BOGUS", "tanggal": "2025-01-01", "alasan": ""},
                          headers=auth_headers, timeout=15)
        assert r.status_code == 400

    def test_d_update_leave(self, auth_headers):
        pid, lid = TestAdminCRUD.created_pid, TestAdminCRUD.created_lid
        r = requests.patch(f"{API}/personnel/{pid}/leaves/{lid}",
                           json={"alasan": "Updated"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/personnel/{pid}", timeout=15).json()
        entry = next((x for x in g["leaves"] if x["id"] == lid), None)
        assert entry and entry["alasan"] == "Updated"

    def test_e_delete_leave(self, auth_headers):
        pid, lid = TestAdminCRUD.created_pid, TestAdminCRUD.created_lid
        r = requests.delete(f"{API}/personnel/{pid}/leaves/{lid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/personnel/{pid}", timeout=15).json()
        assert not any(x["id"] == lid for x in g.get("leaves", []))

    def test_f_delete_personnel(self, auth_headers):
        pid = TestAdminCRUD.created_pid
        r = requests.delete(f"{API}/personnel/{pid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/personnel/{pid}", timeout=15)
        assert g.status_code == 404


class TestTemplate:
    def test_template_returns_xlsx(self, auth_headers):
        # template endpoint isn't auth-protected per code; test both ways
        r = requests.get(f"{API}/template", timeout=20)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert len(r.content) > 500
