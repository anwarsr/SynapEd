# SynapEd

Platform pembelajaran online multi-disiplin. Next.js 16 + Firebase.

```
frontend/   Next.js 16 + Tailwind v4     -> web
scripts/    migrasi data & akun (sekali pakai)
*.rules     aturan keamanan Firestore & Storage
```

Tidak ada server backend terpisah. Next.js berbicara langsung ke Firebase:
Server Component memakai Admin SDK, sedangkan SDK klien hanya dipakai untuk
alur masuk/daftar.

## Menjalankan secara lokal

Konfigurasi saat ini: **web di localhost, database di Firebase asli**
(`synap-ed`). Satu terminal saja, emulator tidak perlu dijalankan.

```bash
npm run dev            # dari akar -> http://localhost:3000
```

Data yang tampil berasal langsung dari Firestore. Mengubah isi kursus di
Firebase Console akan langsung terlihat setelah halaman di-refresh — tanpa
rebuild, karena semua halaman katalog memakai `force-dynamic`.

### Pertama kali di komputer baru

```bash
npm install                      # akar — untuk skrip migrasi
cd frontend && npm install

# kredensial agar skrip bisa menulis ke Firebase
gcloud auth application-default login
gcloud auth application-default set-quota-project synap-ed

npm run check                    # dari akar — pastikan semua hijau
```

`frontend/.env.local` sudah berisi konfigurasi `synap-ed`, tetapi berkas itu
**tidak ikut git**. Di komputer baru, salin dari
[docs/SETUP-FIREBASE.md](docs/SETUP-FIREBASE.md) Langkah 7a.

### Memeriksa sambungan

```bash
npm run check
```

Hanya membaca. Harus melaporkan `4 kursus / 19 section / 52 lesson` dan
jumlah akun.

### Alternatif: emulator lokal (offline, tanpa menyentuh data asli)

Berguna kalau ingin bereksperimen tanpa risiko mengubah data sungguhan.

```bash
npm run emulators                                    # UI di :4000
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; npm run migrate:firestore
```

Lalu ubah `frontend/.env.local`:

```ini
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-synaped
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

dan `.firebaserc` → `"default": "demo-synaped"`. Kembalikan keduanya untuk
memakai Firebase asli lagi. `npm run check` akan memberi tahu kalau keduanya
tidak sinkron.

> **Jangan menguji login akun hasil impor di emulator** — Auth emulator tidak
> mengimplementasikan verifikasi bcrypt, jadi selalu gagal meski sandinya benar.

> Kalau muncul 404 di semua halaman kecuali `/`, hapus `frontend/.next` lalu
> jalankan ulang. Cache Turbopack yang basi bisa menyebabkan itu.

## Halaman

| Rute | Akses |
|---|---|
| `/` | publik — landing + katalog |
| `/courses`, `/courses/:slug` | publik |
| `/courses/:slug/learn[/:lessonSlug]` | **perlu masuk** |
| `/dashboard` | **perlu masuk** — katalog + pengaturan akun |
| `/login`, `/register` | publik |

Rute terproteksi diperiksa di Server Component (`src/lib/firebase/session.ts`),
jadi pengalihan ke `/login` terjadi sebelum halaman dirender — tanpa kedipan
konten. Pengalihan menyertakan `?next=` agar kembali ke tujuan semula.

## Autentikasi

Firebase Auth hidup di klien, tetapi halaman terproteksi dirender di server.
Jembatannya adalah **session cookie** — pola resmi Firebase untuk SSR:

```
klien   signInWithEmailAndPassword()   -> ID token
        POST /api/auth/session         -> tukar jadi cookie httpOnly
server  verifySessionCookie(checkRevoked: true)
keluar  DELETE /api/auth/session + revokeRefreshTokens()
```

`checkRevoked: true` membuat "keluar" berlaku seketika, bukan menunggu token
kedaluwarsa sendiri.

## Model data

Satu koleksi: `courses/{slug}`. Section dan lesson **ditanam di dalam dokumen
kursus**, bukan subcollection. Dokumen terbesar hanya 3,3 KB — 0,31% dari batas
1 MiB Firestore, tersisa 319× lipat. Akibatnya:

- membaca satu kursus = **satu operasi baca**, bukan 1 + 19 + 52
- tidak ada masalah cascade delete: hapus kursus, section & lesson ikut hilang

`lessonsCount` sengaja **tidak disimpan** — selalu dihitung dari isi dokumen,
jadi tidak mungkin melenceng.

Dua field diisi lewat Firebase Console:

| Field | Isi |
|---|---|
| `videoUrl` | tautan YouTube/Vimeo biasa — otomatis dikonversi ke URL embed |
| `attachments` | `[{ name, path, size, mime }]`, `path` menunjuk ke Storage |

## Menghubungkan ke proyek Firebase asli

**→ Panduan lengkap: [docs/SETUP-FIREBASE.md](docs/SETUP-FIREBASE.md)**
(12 langkah, ±30–45 menit, disertai penanganan masalah)

Ringkasnya:

```bash
# setelah proyek Firebase dibuat & frontend/.env.local + .firebaserc diisi
npm run check                    # periksa konfigurasi sebelum lanjut

$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "C:\path\firebase-key.json" -Raw
npx firebase deploy --only firestore:rules,storage
npm run migrate:firestore
npm run import:users
npm run check                    # harus: 4/19/52 kursus dan 4 akun
```

`npm run check` hanya membaca — tidak mengubah apa pun — dan menyebutkan
persis apa yang masih kurang.

> **Hash bcrypt lama TERBUKTI berfungsi di Firebase asli.**
> Diuji langsung terhadap proyek `synap-ed`: hash bergaya Laravel `$2y$`
> dinormalkan ke `$2b$`, diimpor, lalu login dengan kata sandi yang benar
> **berhasil** dan kata sandi salah **ditolak**. Jadi kata sandi lama tetap
> berlaku — tidak perlu reset.
>
> Catatan: hal yang sama **gagal di emulator**. Auth emulator tampaknya tidak
> mengimplementasikan verifikasi bcrypt untuk akun impor, jadi jangan memakai
> emulator untuk menguji bagian ini.

`scripts/data/synaped.db` berisi hash kata sandi akun lama dan **sengaja
diabaikan git**. Simpan berkas itu sebagai cadangan.

## Profil & role

Setiap akun bisa mengubah nama, email, kata sandi, foto profil, dan nomor HP
lewat `/dashboard`. Foto disimpan di Storage (`avatars/{uid}/avatar.*`, maks
2 MB, harus gambar); nomor HP di Firestore (`users/{uid}`).

Nomor HP **tidak** ditaruh di field `phoneNumber` milik Firebase Auth — field itu
khusus nomor yang sudah diverifikasi lewat SMS, dan mengisinya dengan nomor yang
diketik sendiri akan menjanjikan verifikasi yang tidak pernah terjadi.

Di navbar, akun diwakili **ikon foto profil** yang menuju `/dashboard`. Tombol
Keluar ada di halaman profil, bukan di navbar, supaya aksi yang mengakhiri sesi
tidak bersebelahan dengan tautan navigasi yang sering ditekan.

## Role

Ada tiga role.

| Role | Artinya |
|---|---|
| `user` | pelajar biasa |
| `educator` | penyedia kursus — boleh membuat kursusnya sendiri |
| `admin` | meninjau pengajuan educator dan melihat seluruh akun |

Admin masuk langsung ke `/admin`. Educator dan user biasa masuk ke beranda.

```bash
npm run set-role seseorang@contoh.com admin
npm run set-role seseorang@contoh.com educator
```

Role disimpan sebagai **custom claim**, bukan field database, sehingga ikut di
dalam session cookie dan bisa diperiksa di server tanpa pembacaan tambahan —
dan tidak bisa diubah dari browser. `set-role` juga mencabut refresh token, jadi
akun yang bersangkutan **harus masuk ulang** agar role barunya berlaku.

### Menjadi educator

Pengguna biasa menekan **Jadi Educator** di navbar atau di halaman profil, yang
membawanya ke `/educator` — penjelasan programnya, lalu tombol pengajuan. Untuk
sekarang tidak ada persyaratan apa pun.

Pengajuan muncul di **Panel Admin → Notifikasi**, dan akun yang bersangkutan
ditandai di daftar akun. Admin dapat menerima atau menolak dari kedua tempat.

Menerima berarti mengubah custom claim menjadi `educator` lalu **mencabut
refresh token** pelamar. Pencabutan itu memang melempar pelamar keluar, tetapi
tanpanya sesi lamanya masih membawa role `user` sampai cookie-nya kedaluwarsa —
jadi role barunya tidak akan berlaku. Pelamar cukup masuk lagi.

**Peningkatan ke educator bersifat permanen.** `set-role` menolak menurunkan
educator ke `user`, dan tidak ada jalur di UI untuk itu.

Pengajuan disimpan di `educatorApplications/{uid}` — satu dokumen per akun,
sehingga tidak mungkin ada dua pengajuan yang bersaing. Koleksi itu tertutup
rapat dari klien (`allow read, write: if false`); seluruh alurnya berjalan lewat
Server Action dengan Admin SDK. Pengajuan yang ditolak boleh diajukan lagi.

### Menguji

Tiga skrip menguji semuanya terhadap proyek asli. Ketiganya membuat akun uji
sementara dan menghapusnya lagi di akhir; akun sungguhan tidak disentuh.

```bash
npm run verify:admin      # penjagaan /admin              (butuh dev server)
npm run verify:educator   # alur pengajuan sampai putusan (butuh dev server)
npm run verify:rules      # rules Firestore & Storage yang sedang ter-deploy
```

`verify:educator` memanggil Server Action yang sesungguhnya lewat POST +
header `Next-Action`, persis seperti browser saat tombolnya ditekan — jadi yang
teruji kode produksinya, bukan tiruan alurnya. ID action-nya dibaca dari
manifest `.next/dev`, karena itu dev server harus berjalan.

`verify:rules` membuktikan dua hal terpenting: pengguna biasa **tidak** bisa
menulis field `role` ke dokumennya sendiri, dan **tidak** bisa menyentuh
lamarannya sendiri untuk menandainya `accepted`.

## Yang belum ada

- **Pembuatan kursus oleh educator.** Role-nya sudah ada beserta seluruh alur
  pengajuan dan persetujuannya, tetapi antarmuka untuk menyusun kursus belum
  dibangun — itu pekerjaan tersendiri yang jauh lebih besar. Untuk sekarang
  educator adalah akun yang sudah berwenang, tanpa alat untuk memakainya.
- **CMS materi.** `videoUrl` dan `attachments` masih diisi lewat Firebase
  Console.
- **Mengubah role sembarangan dari UI.** Hanya keputusan pengajuan educator yang
  bisa dilakukan dari panel; sisanya lewat skrip, karena endpoint tulis untuk
  role harus dijaga sangat ketat.
- **Pemberitahuan ke pelamar.** Hasil keputusan hanya terlihat kalau pelamar
  membuka `/educator` atau profilnya; belum ada email atau notifikasi.
- **Enrollment & progres belajar.** Di Laravel dulu keduanya hanya angka
  hardcoded di controller, bukan fitur yang berjalan — jadi dashboard di sini
  sengaja tidak menampilkan angka kemajuan sama sekali.
- **Proteksi berkas.** `storage.rules` memakai akses baca publik sesuai
  keputusan awal. Konsekuensinya materi kursus berbayar dapat disebarluaskan
  bebas. Untuk mengubahnya: ganti `allow read: if true` menjadi
  `if request.auth != null` dan sajikan lewat URL bertanda tangan.
- **Verifikasi email & reset kata sandi.** Tersedia gratis di Firebase Auth,
  tetapi belum dirangkai ke UI.

## Riwayat

Proyek ini bermula sebagai Laravel + Blade, lalu frontend-nya dipindah ke
Next.js, backend-nya ke NestJS + Prisma, dan akhirnya ke Firebase. Beberapa
catatan yang masih relevan:

- Data kursus **tidak pernah ada di database** pada versi Laravel — hanya array
  PHP 622 baris di `app/Helpers/LmsData.php`.
- Konversi frontend oleh AI terdahulu diam-diam kehilangan **14 lesson dan 6
  section**. Karena itu `scripts/migrate-to-firestore.ts` memiliki pengaman yang
  **menggagalkan migrasi** bila jumlahnya bukan 4 kursus / 19 section /
  52 lesson.
