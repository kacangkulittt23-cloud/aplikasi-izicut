# PRD — E-IZICUT by Watpers Bag SDM Polres Mimika

## Problem Statement
Aplikasi database untuk Bag SDM Polres Mimika menyimpan data izin, izin emergency, cuti tahunan, cuti berobat, dan cuti ibadah (Umroh/Haji/Lainnya) anggota. Cukup ketik nama atau NRP untuk melihat data lengkap (Nama, Pangkat, NRP/NIP, Jabatan, Satfung, Tahun) beserta riwayat izin/cuti (tanggal + alasan). Data mudah di-update, dipisah per tahun & per satfung, dan admin dapat upload Excel sebagai basis data.

## Users / Personas
- **Publik (anggota/staf)**: mencari & melihat data tanpa login.
- **Admin (Watpers Bag SDM)**: login untuk upload Excel dan mengedit data personil & izin/cuti secara bebas.

## Architecture
- **Frontend**: Expo Router (React Native), tema hitam-emas (Oswald + DM Sans), React Query, phosphor-react-native icons.
- **Backend**: FastAPI + MongoDB (motor). Auth JWT (pyjwt), 1 admin di seed dari env.
- **Excel**: parsing & template via openpyxl (`excel_utils.py`). Deteksi seksi via kolom nomor yang reset (mendukung format 2025 dgn header & 2026 tanpa header). Satfung diturunkan dari jabatan pemimpin seksi.

## Core Requirements (static)
- Cari by Nama/NRP → profil lengkap dengan riwayat izin/cuti bertanggal + alasan.
- Filter per Tahun & per Satfung.
- Admin: upload Excel (gabung/upsert by NRP+tahun; entri manual tetap dipertahankan), CRUD personil, CRUD entri izin/cuti.
- Cuti Ibadah dipisah: Umroh, Haji, Lainnya.
- Template Excel dengan kolom Alasan tersedia untuk diunduh admin.

## Implemented (2026-06)
- Backend API: /years, /satfung, /stats, /personnel (list+search+detail), /auth/login+me, /leave-types, /template, /import, personil & leaves CRUD (admin-guarded).
- Excel parser mendukung 2 format; seed dari file user: 2025 = 711 personil / 224 catatan, 2026 = 721 personil / 34 satfung.
- Frontend: Dashboard/Search (hero, chips tahun & satfung, bento stats, aktivitas terbaru), Profil personil (identitas + section izin/cuti), Login admin, Panel admin (upload Excel, unduh template, tambah personil), form tambah/edit izin & personil, toast, hapus dengan konfirmasi.
- Auth: admin/Mimika2026! (di /app/memory/test_credentials.md).
- Diuji end-to-end via testing agent — semua lulus.

## Backlog (prioritized)
- P1: Date picker native untuk input tanggal (kini input DD-MM-YYYY manual).
- P1: Statistik per-satfung yang bisa di-tap (drill-down).
- P2: Ekspor profil/rekap per satfung ke PDF/Excel.
- P2: Riwayat upload Excel & undo import.
- P2: Migrasi shadow* → boxShadow untuk RN Web.

## Next Tasks
- Tambahkan filter jenis izin/cuti di pencarian.
- Rekap tahunan per satfung (siapa paling sering izin/cuti).
