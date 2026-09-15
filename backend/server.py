from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
from pydantic import BaseModel, Field

from excel_utils import parse_workbook, build_template, LEAVE_TYPES, LEAVE_LABELS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
TOKEN_DAYS = int(os.getenv("ACCESS_TOKEN_DAYS", "7"))
ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
ADMIN_ID = "admin-credential"
MIN_PW = 6

IZIN_GROUP = {"IZIN", "EMERGENCY"}
CUTI_GROUP = {"CUTI_TAHUNAN", "CUTI_BEROBAT", "CUTI_IBADAH_UMROH", "CUTI_IBADAH_HAJI", "CUTI_IBADAH_LAINNYA"}

app = FastAPI(title="E-IZICUT API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("eizicut")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean(doc):
    doc.pop("_id", None)
    return doc


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), h.encode("utf-8"))
    except (ValueError, TypeError):
        return False


async def ensure_admin_credential():
    """Idempotent seed. A password changed from inside the app is never reset."""
    existing = await db.admin_credentials.find_one({"_id": ADMIN_ID})
    if not existing:
        await db.admin_credentials.insert_one({
            "_id": ADMIN_ID,
            "username": ADMIN_USERNAME,
            "password_hash": hash_pw(ADMIN_PASSWORD),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })


def make_token(username: str) -> str:
    payload = {
        "sub": username,
        "role": "admin",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def require_admin(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if creds is None:
        raise HTTPException(status_code=401, detail="Butuh login admin")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Akses ditolak")
        return payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login ulang")


def match_key(nrp: str, nama: str, tahun: int):
    nrp = (nrp or "").strip()
    if nrp:
        return {"nrp": nrp, "tahun": tahun, "deleted_at": None}
    return {"nama": (nama or "").strip(), "tahun": tahun, "deleted_at": None}


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class LeaveIn(BaseModel):
    jenis: str
    tanggal: str  # ISO date YYYY-MM-DD
    alasan: str = ""


class LeaveUpdate(BaseModel):
    jenis: Optional[str] = None
    tanggal: Optional[str] = None
    alasan: Optional[str] = None


class PersonnelIn(BaseModel):
    nama: str
    pangkat: str = ""
    nrp: str = ""
    jabatan: str = ""
    satfung: str = "LAINNYA"
    tahun: int


class PersonnelUpdate(BaseModel):
    nama: Optional[str] = None
    pangkat: Optional[str] = None
    nrp: Optional[str] = None
    jabatan: Optional[str] = None
    satfung: Optional[str] = None
    tahun: Optional[int] = None


# --------------------------------------------------------------------------- #
# Meta
# --------------------------------------------------------------------------- #
@api_router.get("/")
async def root():
    return {"app": "E-IZICUT by Watpers Bag SDM Polres Mimika", "ok": True}


@api_router.get("/leave-types")
async def leave_types():
    return [{"key": k, "label": LEAVE_LABELS[k]} for k in LEAVE_TYPES]


@api_router.get("/years")
async def years():
    vals = await db.personnel.distinct("tahun", {"deleted_at": None})
    return sorted([int(v) for v in vals if v is not None], reverse=True)


@api_router.get("/satfung")
async def satfung(tahun: Optional[int] = None):
    q = {"deleted_at": None}
    if tahun is not None:
        q["tahun"] = tahun
    pipeline = [
        {"$match": q},
        {"$group": {"_id": "$satfung", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    out = []
    async for row in db.personnel.aggregate(pipeline):
        out.append({"satfung": row["_id"] or "LAINNYA", "count": row["count"]})
    return out


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
@api_router.post("/auth/login")
async def login(data: LoginIn):
    if data.username != ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    record = await db.admin_credentials.find_one({"_id": ADMIN_ID})
    if record and record.get("password_hash"):
        ok = verify_pw(data.password, record["password_hash"])
    else:
        ok = data.password == ADMIN_PASSWORD
    if not ok:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    return {"access_token": make_token(data.username), "token_type": "bearer", "username": data.username}


@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordIn, admin: str = Depends(require_admin)):
    record = await db.admin_credentials.find_one({"_id": ADMIN_ID})
    current_hash = record.get("password_hash") if record else None
    valid = verify_pw(data.current_password, current_hash) if current_hash else (data.current_password == ADMIN_PASSWORD)
    if not valid:
        raise HTTPException(status_code=400, detail="Password lama salah")
    if len(data.new_password) < MIN_PW:
        raise HTTPException(status_code=422, detail=f"Password baru minimal {MIN_PW} karakter")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="Password baru harus berbeda dari yang lama")
    await db.admin_credentials.update_one(
        {"_id": ADMIN_ID},
        {"$set": {"username": ADMIN_USERNAME, "password_hash": hash_pw(data.new_password), "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "message": "Password berhasil diubah"}


@api_router.get("/auth/me")
async def me(username: str = Depends(require_admin)):
    return {"username": username, "role": "admin"}


# --------------------------------------------------------------------------- #
# Personnel (public reads)
# --------------------------------------------------------------------------- #
@api_router.get("/personnel")
async def list_personnel(
    tahun: Optional[int] = None,
    satfung: Optional[str] = None,
    q: Optional[str] = None,
    jenis: Optional[str] = None,
    limit: int = 500,
):
    query = {"deleted_at": None}
    if tahun is not None:
        query["tahun"] = tahun
    if satfung:
        query["satfung"] = satfung
    if jenis:
        query["leaves.jenis"] = jenis
    if q:
        rx = re.escape(q.strip())
        query["$or"] = [
            {"nama": {"$regex": rx, "$options": "i"}},
            {"nrp": {"$regex": rx, "$options": "i"}},
            {"jabatan": {"$regex": rx, "$options": "i"}},
        ]
    cursor = db.personnel.find(query).sort([("satfung", 1), ("order", 1)]).limit(limit)
    out = []
    async for doc in cursor:
        clean(doc)
        doc["leave_count"] = len(doc.get("leaves", []))
        out.append(doc)
    return out


@api_router.get("/personnel/{pid}")
async def get_personnel(pid: str):
    doc = await db.personnel.find_one({"id": pid, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Data personil tidak ditemukan")
    clean(doc)
    doc.get("leaves", []).sort(key=lambda x: x.get("tanggal") or "", reverse=True)
    return doc


@api_router.get("/stats")
async def stats(tahun: Optional[int] = None):
    q = {"deleted_at": None}
    if tahun is not None:
        q["tahun"] = tahun
    total = await db.personnel.count_documents(q)
    # satfung count
    satfung_count = len(await db.personnel.distinct("satfung", q))
    # leave counts + recent
    total_leaves = 0
    per_type = {k: 0 for k in LEAVE_TYPES}
    recent = []
    async for doc in db.personnel.find(q):
        for lv in doc.get("leaves", []):
            total_leaves += 1
            per_type[lv.get("jenis", "")] = per_type.get(lv.get("jenis", ""), 0) + 1
            recent.append({
                "personnel_id": doc.get("id"),
                "nama": doc.get("nama"),
                "pangkat": doc.get("pangkat"),
                "satfung": doc.get("satfung"),
                "jenis": lv.get("jenis"),
                "tanggal": lv.get("tanggal"),
                "alasan": lv.get("alasan"),
            })
    recent.sort(key=lambda x: x.get("tanggal") or "", reverse=True)
    return {
        "total_personil": total,
        "total_satfung": satfung_count,
        "total_pengajuan": total_leaves,
        "per_type": [{"key": k, "label": LEAVE_LABELS[k], "count": per_type.get(k, 0)} for k in LEAVE_TYPES],
        "recent": recent[:15],
    }


@api_router.get("/recap")
async def recap(tahun: Optional[int] = None, satfung: Optional[str] = None):
    q = {"deleted_at": None}
    if tahun is not None:
        q["tahun"] = tahun

    monthly = {m: {"bulan": m, "izin": 0, "cuti": 0} for m in range(1, 13)}
    sf_map = {}
    people = {}
    async for doc in db.personnel.find(q):
        sf = doc.get("satfung") or "LAINNYA"
        if sf not in sf_map:
            sf_map[sf] = {"satfung": sf, "total_personil": 0, "total_pengajuan": 0, "izin": 0, "cuti": 0}
        sf_map[sf]["total_personil"] += 1

        in_scope = (not satfung) or sf == satfung
        p_izin = p_cuti = 0
        for lv in doc.get("leaves", []):
            jenis = lv.get("jenis", "")
            is_izin = jenis in IZIN_GROUP
            is_cuti = jenis in CUTI_GROUP
            sf_map[sf]["total_pengajuan"] += 1
            sf_map[sf]["izin"] += 1 if is_izin else 0
            sf_map[sf]["cuti"] += 1 if is_cuti else 0
            if in_scope:
                p_izin += 1 if is_izin else 0
                p_cuti += 1 if is_cuti else 0
                t = lv.get("tanggal") or ""
                if len(t) >= 7 and t[5:7].isdigit():
                    mo = int(t[5:7])
                    if 1 <= mo <= 12:
                        monthly[mo]["izin"] += 1 if is_izin else 0
                        monthly[mo]["cuti"] += 1 if is_cuti else 0
        if in_scope and (p_izin + p_cuti) > 0:
            people[doc["id"]] = {
                "personnel_id": doc["id"],
                "nama": doc.get("nama"),
                "pangkat": doc.get("pangkat"),
                "satfung": sf,
                "izin": p_izin,
                "cuti": p_cuti,
                "total": p_izin + p_cuti,
            }

    satfung_list = sorted(sf_map.values(), key=lambda x: x["total_pengajuan"], reverse=True)
    top = sorted(people.values(), key=lambda x: x["total"], reverse=True)[:15]
    return {
        "tahun": tahun,
        "satfung_filter": satfung,
        "monthly": [monthly[m] for m in range(1, 13)],
        "satfung": satfung_list,
        "top": top,
    }


# --------------------------------------------------------------------------- #
# Personnel (admin writes)
# --------------------------------------------------------------------------- #
@api_router.post("/personnel")
async def create_personnel(data: PersonnelIn, admin: str = Depends(require_admin)):
    doc = data.model_dump()
    doc["satfung"] = (doc.get("satfung") or "LAINNYA").upper().strip()
    doc["id"] = str(uuid.uuid4())
    doc["order"] = 9999
    doc["leaves"] = []
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    doc["deleted_at"] = None
    await db.personnel.insert_one(doc)
    return clean(doc)


@api_router.patch("/personnel/{pid}")
async def update_personnel(pid: str, data: PersonnelUpdate, admin: str = Depends(require_admin)):
    changes = {k: v for k, v in data.model_dump().items() if v is not None}
    if "satfung" in changes:
        changes["satfung"] = changes["satfung"].upper().strip()
    if not changes:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    changes["updated_at"] = now_iso()
    res = await db.personnel.find_one_and_update(
        {"id": pid, "deleted_at": None}, {"$set": changes}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Data personil tidak ditemukan")
    return clean(res)


@api_router.delete("/personnel/{pid}")
async def delete_personnel(pid: str, admin: str = Depends(require_admin)):
    res = await db.personnel.find_one_and_update(
        {"id": pid, "deleted_at": None}, {"$set": {"deleted_at": now_iso()}}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Data personil tidak ditemukan")
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Leaves (admin writes)
# --------------------------------------------------------------------------- #
@api_router.post("/personnel/{pid}/leaves")
async def add_leave(pid: str, data: LeaveIn, admin: str = Depends(require_admin)):
    if data.jenis not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail="Jenis izin/cuti tidak valid")
    leave = {
        "id": str(uuid.uuid4()),
        "jenis": data.jenis,
        "tanggal": data.tanggal,
        "alasan": data.alasan or "",
        "source": "manual",
    }
    res = await db.personnel.find_one_and_update(
        {"id": pid, "deleted_at": None},
        {"$push": {"leaves": leave}, "$set": {"updated_at": now_iso()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Data personil tidak ditemukan")
    return leave


@api_router.patch("/personnel/{pid}/leaves/{lid}")
async def update_leave(pid: str, lid: str, data: LeaveUpdate, admin: str = Depends(require_admin)):
    changes = {k: v for k, v in data.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    if "jenis" in changes and changes["jenis"] not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail="Jenis izin/cuti tidak valid")
    set_fields = {f"leaves.$.{k}": v for k, v in changes.items()}
    set_fields["updated_at"] = now_iso()
    res = await db.personnel.find_one_and_update(
        {"id": pid, "leaves.id": lid, "deleted_at": None},
        {"$set": set_fields},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Entri tidak ditemukan")
    return clean(res)


@api_router.delete("/personnel/{pid}/leaves/{lid}")
async def delete_leave(pid: str, lid: str, admin: str = Depends(require_admin)):
    res = await db.personnel.find_one_and_update(
        {"id": pid, "deleted_at": None},
        {"$pull": {"leaves": {"id": lid}}, "$set": {"updated_at": now_iso()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Data personil tidak ditemukan")
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Excel import / template
# --------------------------------------------------------------------------- #
@api_router.get("/template")
async def template():
    data = build_template()
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Template_E-IZICUT.xlsx"},
    )


@api_router.post("/import")
async def import_excel(file: UploadFile = File(...), admin: str = Depends(require_admin)):
    fn = (file.filename or "").lower()
    if not fn.endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=415, detail="Hanya file .xlsx yang diterima")
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Ukuran file melebihi 15 MB")
    try:
        parsed = parse_workbook(data)
    except Exception as e:
        logger.exception("parse error")
        raise HTTPException(status_code=400, detail=f"File Excel tidak valid: {e}")
    if not parsed:
        raise HTTPException(status_code=400, detail="Tidak ada data personil ditemukan di file")

    inserted = 0
    updated = 0
    years_seen = set()
    for p in parsed:
        years_seen.add(p["tahun"])
        # assign ids to excel leaves
        for lv in p["leaves"]:
            lv["id"] = str(uuid.uuid4())
        existing = await db.personnel.find_one(match_key(p["nrp"], p["nama"], p["tahun"]))
        if existing:
            manual_leaves = [lv for lv in existing.get("leaves", []) if lv.get("source") == "manual"]
            merged = manual_leaves + p["leaves"]
            await db.personnel.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "nama": p["nama"],
                    "pangkat": p["pangkat"],
                    "nrp": p["nrp"],
                    "jabatan": p["jabatan"],
                    "satfung": p["satfung"],
                    "order": p["order"],
                    "leaves": merged,
                    "updated_at": now_iso(),
                }},
            )
            updated += 1
        else:
            doc = dict(p)
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now_iso()
            doc["updated_at"] = now_iso()
            doc["deleted_at"] = None
            await db.personnel.insert_one(doc)
            inserted += 1

    return {
        "ok": True,
        "total": len(parsed),
        "ditambahkan": inserted,
        "diperbarui": updated,
        "tahun": sorted(years_seen),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_seed():
    await ensure_admin_credential()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
