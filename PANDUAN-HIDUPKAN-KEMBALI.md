# Panduan Menghidupkan Kembali E-IZICUT (di luar Emergent)

Aplikasi terdiri dari 3 bagian. Semuanya bisa gratis untuk pemakaian kecil.

| Bagian | Fungsi | Tempat gratis yang disarankan |
|---|---|---|
| Database | Menyimpan data personil, izin, cuti | MongoDB Atlas (M0 gratis) |
| Backend | API, login admin, upload Excel | Render (paket Free) |
| Aplikasi | Tampilan di HP (APK) | Expo EAS Build (gratis, jumlah build terbatas) |

Penting: **data lama ada di database Emergent, tidak ikut di file GitHub.** Setelah aplikasi hidup, data diisi lagi dengan **upload file Excel** lewat panel admin (fitur ini sudah ada). Siapkan file Excel data personil Anda (format 2025/2026 yang lama masih terbaca).

---

## Langkah 1 — Database (MongoDB Atlas)

1. Daftar di https://www.mongodb.com/cloud/atlas lalu buat cluster **M0 (Free)**.
2. Menu **Database Access** → buat user database (catat username dan password).
3. Menu **Network Access** → **Add IP Address** → **Allow access from anywhere** (0.0.0.0/0), karena IP Render berubah-ubah.
4. Klik **Connect** → **Drivers** → salin alamat koneksi, bentuknya:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Ganti `USER` dan `PASSWORD` dengan milik Anda. Ini nilai untuk `MONGO_URL`.

## Langkah 2 — Backend (Render)

1. Pastikan folder proyek ini ada di GitHub Anda (ganti isi repo dengan isi folder ini, atau buat repo baru).
2. Daftar di https://render.com → **New** → **Blueprint** → pilih repo Anda. Render membaca file `render.yaml` otomatis.
   (Alternatif manual: **New → Web Service**, Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn server:app --host 0.0.0.0 --port $PORT`.)
3. Isi Environment Variables:
   - `MONGO_URL` = alamat dari Langkah 1
   - `ADMIN_PASSWORD` = **password baru** yang kuat (jangan pakai yang lama)
   - `JWT_SECRET` sudah dibuat otomatis oleh Render
4. Tunggu deploy selesai. Buka `https://NAMA-ANDA.onrender.com/api/` di browser. Kalau muncul pesan JSON, backend hidup.
5. Catat alamatnya (contoh `https://e-izicut-api.onrender.com`).

Catatan Render Free: server "tidur" kalau lama tidak dipakai, jadi akses pertama bisa lambat sekitar 30–60 detik. Ini normal.

## Langkah 3A — Versi web di Vercel (lebih mudah, tanpa APK)

1. Daftar di https://vercel.com dengan akun GitHub.
2. **Add New → Project** → pilih repo `aplikasi-izicut` → **Root Directory: `frontend`**.
3. Di **Environment Variables** tambahkan `EXPO_PUBLIC_BACKEND_URL` = alamat backend Render (tanpa `/api`, tanpa garis miring di akhir).
4. Klik **Deploy**. Hasilnya link web yang bisa dibuka di HP dan komputer.

## Langkah 3B — (Opsional) Bangun APK baru

Di komputer (perlu Node.js 20 atau lebih baru):

```bash
cd frontend
npm install
npm install -g eas-cli
eas login            # akun gratis di expo.dev
eas init             # menghubungkan proyek ke akun Expo
```

Lalu buka `frontend/eas.json` dan ganti `https://GANTI-DENGAN-ALAMAT-BACKEND-ANDA` dengan alamat backend dari Langkah 2. Setelah itu:

```bash
eas build --platform android --profile preview
```

Tunggu beberapa menit. EAS memberi tautan unduh file **.apk**. Pasang di HP (izinkan "instal dari sumber tidak dikenal").

Jika HP Anda sudah memasang APK lama dengan paket yang sama (`com.emergent.watpersizicut.laun2w`), APK baru bisa menimpanya hanya jika ditandatangani kunci yang sama. Kalau gagal, hapus aplikasi lama lalu pasang yang baru.

## Langkah 4 — Isi data

1. Buka aplikasi → login admin (username `admin`, password yang Anda set di Render).
2. Di panel admin, **Unduh template** untuk melihat formatnya, atau langsung **Upload Excel** milik Anda.
3. Upload bisa berkali-kali. Data digabung berdasarkan NRP + tahun, dan entri manual tetap dipertahankan.

---

## Coba di komputer sendiri (opsional)

```bash
# backend
cd backend
cp .env.example .env      # isi MONGO_URL dll.
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# frontend (web)
cd frontend
cp .env.example .env      # EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npm install
npx expo start --web
```

## Keamanan (penting, data ini data personil)

- Jangan simpan file `.env` atau password di GitHub. Hanya `.env.example` yang boleh diunggah.
- Password admin lama pernah tertulis di repo GitHub Anda (file `memory/PRD.md`). Sudah saya hapus dari salinan ini, tetapi **anggap password lama sudah bocor dan jangan dipakai lagi**.
- Kalau repo GitHub Anda publik, jadikan **Private**, karena riwayat commit lama masih menyimpan password tersebut.
- Pakai password admin yang baru dan kuat. Bisa diganti dari dalam aplikasi lewat fitur ganti password.
