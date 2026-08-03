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

## Halaman

| Rute | Akses | Keterangan |
|---|---|---|
| `/` | publik | landing, katalog dari API |
| `/courses` | publik | semua kursus |
| `/courses/:slug` | publik | detail + kurikulum |
| `/courses/:slug/learn` | **perlu masuk** | pelajaran pertama |
| `/courses/:slug/learn/:lessonSlug` | **perlu masuk** | pelajaran tertentu |
| `/dashboard` | **perlu masuk** | katalog + pengaturan akun |
| `/login`, `/register` | publik | masuk / daftar |

Rute terproteksi diperiksa di Server Component (`src/lib/serverApi.ts`) sehingga
pengalihan ke `/login` terjadi sebelum halaman dirender — tanpa kedipan konten.
Pengalihan menyertakan `?next=` agar setelah masuk kembali ke halaman yang dituju.

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

- **Akun lama tetap bisa dipakai.** Hash bcrypt Laravel berawalan `$2y$` dan
  tetap valid di Node, jadi kata sandi lama masih berfungsi.
- **Data kursus dulunya tidak pernah ada di database** — hanya array PHP di
  `app/Helpers/LmsData.php`. Sekarang menjadi tabel sungguhan.
- **Enrollment & progres belajar belum ada.** Di Laravel keduanya hanya angka
  hardcoded di `DashboardController` (`65%`, `30%`), bukan fitur yang berjalan.
  Karena itu dashboard baru tidak menampilkan angka kemajuan sama sekali —
  lebih baik kosong daripada menampilkan angka yang tidak berarti.
- **Isi materi pelajaran belum ada.** Judul, durasi, dan tipe setiap pelajaran
  tersimpan di database, tetapi tidak pernah ada kolom untuk isinya. Halaman
  belajar menandai ini secara terbuka sebagai "Materi belum tersedia".
- **Reset kata sandi lewat email belum aktif.** Tabel `password_reset_tokens`
  sudah disiapkan, tetapi pengirimannya belum diimplementasikan (di Laravel pun
  `MAIL_MAILER=log`, jadi email tidak pernah benar-benar terkirim).

## Deployment — BELUM dikonfigurasi

`Dockerfile`, `Procfile`, `railway.toml`, `render.yaml`, dan `nixpacks.toml`
semuanya menjalankan `php artisan`, jadi sudah tidak berlaku dan ikut dihapus.
Belum ada penggantinya. Sekarang ada **dua layanan** yang harus dideploy, bukan
satu.

> **PERINGATAN — SQLite akan terhapus setiap deploy.**
>
> Railway, Render, dan Vercel memakai filesystem *ephemeral*: file yang ditulis
> aplikasi hilang setiap kali deploy ulang. Karena `synaped.db` berisi **seluruh
> akun pengguna**, men-deploy apa adanya berarti kehilangan semua akun di setiap
> rilis.
>
> Rencananya: pasang **volume persisten** dan arahkan `DATABASE_URL` ke path di
> dalam volume itu. Konsekuensinya aplikasi hanya boleh berjalan pada **satu
> instance** — dua instance akan menulis ke file berbeda dan datanya pecah.
> Kalau nanti perlu di-scale, pindah ke PostgreSQL (di Prisma cukup mengganti
> `provider`; kode aplikasi tidak berubah).
