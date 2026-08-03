# SynapEd

Platform pembelajaran online multi-disiplin. Backend NestJS + Prisma, frontend Next.js.

```
backend/    NestJS 11 + Prisma + SQLite   → API di :3001
frontend/   Next.js 16 + Tailwind v4      → web di :3000
```

## Menjalankan

Butuh dua terminal. **Backend harus jalan lebih dulu**, karena halaman katalog
mengambil datanya dari API.

```bash
# Terminal 1 — API
cd backend
cp .env.example .env          # lalu isi JWT_ACCESS_SECRET & JWT_REFRESH_SECRET
npx prisma migrate deploy
npm run db:seed
npm run start:dev             # http://localhost:3001/api

# Terminal 2 — Web
cd frontend
cp .env.example .env.local
npm run dev                   # http://localhost:3000
```

Dokumentasi API interaktif: <http://localhost:3001/api/docs>

> Jangan menjalankan `npm run build` sementara `npm run dev` masih hidup di paket
> yang sama — keduanya berebut direktori build dan dev server akan mati.

## Autentikasi

JWT di **cookie httpOnly**, bukan localStorage — jadi kebal XSS dan bisa dibaca
Server Component Next.js.

- access token 15 menit, refresh token 7 hari
- refresh token disimpan sebagai **hash** di database
- setiap refresh merotasi token; token lama langsung ditolak
- ganti kata sandi mencabut **seluruh** sesi

Karena itu semua permintaan wajib memakai `credentials: "include"` (sudah diurus
`src/lib/api.ts`), dan `CORS_ORIGINS` di backend harus memuat asal frontend.

## Endpoint

| Metode | Rute | Keterangan |
|---|---|---|
| POST | `/api/auth/register` | daftar + langsung masuk |
| POST | `/api/auth/login` | masuk |
| POST | `/api/auth/refresh` | perbarui token (dirotasi) |
| POST | `/api/auth/logout` | keluar + cabut token |
| GET | `/api/auth/me` | akun yang sedang masuk |
| PATCH | `/api/users/me` | ubah nama / email |
| PUT | `/api/users/me/password` | ganti kata sandi |
| DELETE | `/api/users/me` | hapus akun |
| GET | `/api/courses` | daftar kursus (`?category=`) |
| GET | `/api/courses/categories` | kategori untuk filter |
| GET | `/api/courses/:slug` | detail + section + lesson |
| GET | `/api/courses/:slug/lessons/:lessonSlug` | satu lesson + navigasi |

## Basis data

Skema di `backend/prisma/schema.prisma`. Perintah yang sering dipakai:

```bash
npm run prisma:studio     # lihat isi database
npm run prisma:migrate    # buat migrasi baru
npm run db:seed           # isi ulang katalog kursus
```

Katalog di-seed dari `backend/prisma/lms-data.json` — 4 kursus, 19 section,
52 lesson.

## Catatan migrasi dari Laravel

Backend Laravel telah dihapus. Beberapa hal yang perlu diketahui:

- **Deployment perlu dikonfigurasi ulang.** `Dockerfile`, `Procfile`,
  `railway.toml`, `render.yaml`, dan `nixpacks.toml` semuanya menjalankan
  `php artisan` sehingga sudah tidak berlaku dan ikut dihapus. Sekarang ada
  dua layanan yang harus dideploy, bukan satu.
- **Akun lama tetap bisa dipakai.** Hash bcrypt Laravel berawalan `$2y$` dan
  tetap valid di Node, jadi kata sandi lama masih berfungsi.
- **Data kursus dulunya tidak pernah ada di database** — hanya array PHP di
  `app/Helpers/LmsData.php`. Sekarang menjadi tabel sungguhan.
- **Fitur yang belum ada:** enrollment dan progres belajar. Di Laravel keduanya
  hanya angka hardcoded di `DashboardController`, bukan fitur yang berjalan.
  Halaman `/dashboard` dan `/courses/:slug/learn` juga belum dibuat di Next.js.
- **Reset kata sandi lewat email belum aktif.** Tabel `password_reset_tokens`
  sudah disiapkan, tetapi pengirimannya belum diimplementasikan (di Laravel pun
  `MAIL_MAILER=log`, jadi email tidak pernah benar-benar terkirim).
