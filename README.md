# SynapEd

Platform belajar online (LMS) berbahasa Indonesia. Siapa pun bisa belajar dari
kursus yang disusun para educator. Setiap penjualan kursus dibagi adil ke
orang-orang yang menyusunnya dan ke orang yang mempromosikannya.

- **Situs:** https://synaped.web.app (dialihkan ke alamat Firebase App Hosting)
- **Teknologi:** Next.js 16 + Firebase (Auth, Firestore, Storage, App Hosting)
- **Pembayaran:** Midtrans (otomatis) dan QRIS manual

> Berkas ini untuk manusia: apa yang bisa dilakukan situs ini dan cara
> menjalankannya. Detail teknis, aturan kode, dan jebakan yang harus
> diketahui saat mengubah kode ada di [CLAUDE.md](CLAUDE.md).

---

## Siapa memakai apa

Ada tiga jenis akun.

| Akun | Bisa apa |
|---|---|
| **Pengguna** | Belajar, membeli kursus, ikut kelas, mendapat sertifikat, menerima royalti kalau jadi kontributor, membuat kode referral |
| **Educator** | Semua yang di atas, ditambah membuat & mengelola kursus, membuat kelas, menilai tugas peserta |
| **Admin** | Meninjau pengajuan educator dan perubahan kursus, memeriksa pembayaran QRIS, mengatur kategori, potongan platform, dan referral |

Pengguna menjadi educator dengan mengajukan diri di `/educator`. Admin yang
menyetujui.

---

## Fitur

### Belajar

- **Katalog kursus** (`/courses`) dengan filter kategori. Hanya kursus yang
  sudah disetujui admin untuk tayang yang muncul.
- **Halaman kursus** menampilkan deskripsi, kurikulum, ulasan, harga, dan
  siapa saja yang menyusunnya.
- **Halaman belajar** berisi empat jenis pelajaran:
  - **Bacaan:** PDF yang dibaca langsung di halaman, dengan penampil sendiri
    (zoom, layar penuh, unduh).
  - **Video:** tautan YouTube.
  - **Penugasan:** peserta mengunggah jawaban, lalu educator menilai.
  - **Kuis:** pilihan ganda, dinilai otomatis, dengan batas percobaan dan nilai lulus.
- **Kemajuan belajar** tersimpan otomatis. Tombol *Lanjutkan Belajar* membawa
  kembali ke pelajaran terakhir.
- **Sertifikat** terbit otomatis setelah semua pelajaran selesai dan nilai
  tugas/kuis mencapai batas lulus. Setiap sertifikat punya halaman verifikasi
  publik (`/verify/…`).
- **Ulasan:** peserta yang sudah menyelesaikan kursus bisa memberi bintang dan
  komentar.

### Membeli kursus

- **Kursus gratis:** cukup tekan *Daftar*.
- **Kursus berbayar:** dua cara bayar yang bisa dinyalakan/dimatikan admin.
  - **Midtrans:** QRIS, virtual account, e-wallet. Akses terbuka otomatis
    begitu pembayaran masuk.
  - **QRIS manual:** pembeli memindai QR, mengunggah bukti bayar, lalu admin
    mencocokkannya dengan mutasi rekening sebelum membuka akses.
- **Kode referral:** pembeli bisa memasukkan kode orang lain, atau kodenya
  terisi sendiri kalau membuka tautan bagikan. Harga bagi pembeli tidak
  berubah.

### Educator: membuat kursus

- Form **Buat Kursus** berisi judul, deskripsi, harga, kategori, gambar
  sampul, nilai lulus, dan kurikulum bebas (berapa pun bagian dan pelajarannya).
- Kursus baru **tersembunyi** dulu. Educator mengajukan *tayang*, lalu admin
  meninjaunya.
- Setiap perubahan pada kursus (menyunting isi, menayangkan, menyembunyikan,
  menghapus) **diajukan ke admin**. Kursus yang sedang tayang tetap seperti
  semula sampai perubahannya disetujui. Admin melihat perbandingan
  sebelum-sesudah dalam kalimat yang mudah dibaca.
- **Daftar peserta & penilaian** per kursus (`/educator/courses/…/students`).

### Kontributor & bagi hasil (royalti)

Kursus bisa disusun beberapa orang, dan setiap orang mendapat bagian dari
penjualan.

- Saat membuat atau menyunting kursus, educator mencari akun lain lewat
  **username** lalu mengatur persentasenya dengan slider. Bagian pemilik
  kursus otomatis sisanya (minimal 10%). Maksimal 10 orang per kursus.
- Kontributor **tidak harus educator**, akun biasa pun bisa.
- Perubahan pembagian juga lewat persetujuan admin, dan hanya berlaku untuk
  penjualan **berikutnya**. Penjualan yang sudah terjadi tidak berubah.
- Halaman kursus menampilkan "Disusun oleh …" (nama saja, tanpa persentase).

**Contoh pembagian** kursus Rp100.000 dengan setelan bawaan (potongan platform
30%, referral 10%), pemilik 70% dan satu kontributor 30%:

| Penerima | Tanpa kode referral | Dengan kode referral |
|---|---|---|
| Perujuk (pemilik kode) | – | Rp10.000 |
| SynapEd | Rp30.000 | Rp20.000 |
| Pemilik kursus (70% dari sisa) | Rp49.000 | Rp49.000 |
| Kontributor (30% dari sisa) | Rp21.000 | Rp21.000 |

Bagian perujuk selalu diambil dari potongan platform, jadi bagian para
penyusun kursus tidak pernah berkurang.

### Kode referral

- Setiap akun bisa membuat **satu kode** di `/dashboard`. Kode tidak bisa
  diganti setelah dibuat, supaya tautan yang sudah tersebar tetap berfungsi.
- Tombol **Bagikan dengan kode referral** di halaman kursus mana pun
  menghasilkan tautan yang memuat kode itu. Siapa pun yang membeli lewat
  tautan tersebut (sampai 30 hari kemudian) otomatis memakai kodenya.
- Kode milik sendiri tidak bisa dipakai untuk pembelian sendiri.

### Dashboard pendapatan (`/dashboard`)

- **Semua akun:** total pendapatan (royalti + referral), riwayat per
  penjualan, kode referral, dan daftar kursus tempat ia berkontribusi
  beserta persentasenya.
- **Educator & admin:** tambahan bagian *Penjualan Kursus Saya* (penjualan
  kotor, potongan, bagian kontributor).
- Data pembeli tidak pernah ditampilkan ke kontributor maupun perujuk.
- Penarikan dana **belum tersedia**. Dashboard hanya mencatat.

### Kelas

Ruang belajar kelompok milik educator, terpisah dari kursus.

- Educator membuat kelas dan membagikan **kode undangan**.
- Anggota bergabung dengan kode itu di `/kelas`.
- Di dalam kelas ada pengumuman/postingan dan balasan.

### Profil & akun

- **Profil** (`/profil`): foto, perkenalan, riwayat pendidikan, keahlian,
  statistik belajar/mengajar, sertifikat.
- **Profil publik** (`/profil/[uid]`): versi yang dilihat orang lain, tanpa
  email, nomor HP, atau kursus yang sedang diikuti.
- **Pengaturan** (`/pengaturan`):
  - **Username** unik ala Instagram. Dibuat otomatis dari email saat pertama
    masuk dan bisa diganti sekali setiap 14 hari.
  - Nomor HP, email, kata sandi, cara masuk, dan hapus akun.
- **Masuk** dengan email + kata sandi atau akun Google.

### Asisten chat

Widget "Asisten SynapEd" di setiap halaman publik menjawab pertanyaan umum
seputar SynapEd (OpenRouter, model gratis).

### Panel admin (`/admin`)

| Menu | Isi |
|---|---|
| Notifikasi | Pengajuan menjadi educator |
| Pengajuan Kursus | Tayang, sembunyikan, sunting, dan hapus kursus, dengan perbandingan perubahan |
| Pembayaran | Saklar metode bayar, gambar QRIS, **potongan platform & persentase referral**, bukti bayar yang menunggu, penjualan yang perlu ditindaklanjuti |
| Kategori | Kategori kursus |
| Kelas | Seluruh kelas |
| Ulasan | Moderasi ulasan |
| Akun | Seluruh akun dan rolenya |

---

## Menjalankan di komputer sendiri

Web berjalan di `localhost`, datanya langsung dari **Firebase asli**
(`synap-ed`).

```bash
npm install                  # di akar repo (skrip)
cd frontend && npm install   # aplikasi
cd ..
npm run dev                  # http://localhost:3000
```

`frontend/.env.local` tidak ikut git. Isinya ada di
[docs/SETUP-FIREBASE.md](docs/SETUP-FIREBASE.md) Langkah 7a, ditambah
`MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`,
`MIDTRANS_IS_PRODUCTION`, `OPENROUTER_API_KEY`, dan `FIREBASE_SERVICE_ACCOUNT`
(untuk skrip).

Periksa sambungan: `npm run check` (hanya membaca).

### Emulator (opsional, tanpa menyentuh data asli)

```bash
npm run emulators            # UI di http://localhost:4000
```

Lalu setel `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` dan variabel emulator di
`.env.local`, serta `.firebaserc` ke `demo-synaped`. Login akun hasil impor
lama tidak bisa diuji di emulator.

### Mengubah role akun

```bash
npm run set-role email@contoh.com educator   # atau admin
```

Akun itu harus masuk ulang agar role barunya berlaku.

---

## Deploy

- **Aplikasi:** Firebase App Hosting, otomatis setiap push ke branch `main`.
  Konfigurasi ada di `frontend/apphosting.yaml`. Kunci rahasia (Midtrans,
  OpenRouter) disimpan di Secret Manager.
- **Aturan keamanan** tidak ikut deploy otomatis. Setelah mengubah
  `firestore.rules` atau `storage.rules`:
  ```bash
  npx firebase deploy --only firestore:rules,storage
  ```
- **synaped.web.app** hanya pengalihan ke alamat App Hosting (lihat
  `hosting-shell/README.md`).

### Skrip data yang perlu dijalankan sekali setelah fitur tertentu

Semua skrip hanya melaporkan kalau dijalankan tanpa `--apply`, dan aman
diulang.

| Skrip | Kapan |
|---|---|
| `npm run backfill:usernames -- --apply` | Setelah fitur username ter-deploy, untuk akun lama |
| `npm run migrate:contributors -- --apply` | Mengisi pembagian "pemilik 100%" pada kursus lama |
| `npm run realise:sales -- --apply` | Mencatat penjualan lama ke buku royalti |

---

## Pengujian

Setiap fitur punya skrip pemeriksaan di `scripts/verify-*.ts`. Skrip itu
membuat akun uji sementara di proyek asli, memakai aplikasi lewat jalur yang
sama dengan browser, lalu menghapus semuanya lagi. Kebanyakan butuh
`npm run dev` berjalan.

```bash
npm run typecheck                 # skrip
cd frontend && npx tsc --noEmit   # aplikasi
cd frontend && npm run lint
npm run verify:royalty            # contoh; daftar lengkap di package.json
```

---

## Yang belum ada

- Penarikan dana / payout untuk royalti dan referral.
- Refund otomatis. Kabar refund dari Midtrans hanya ditandai untuk ditindaklanjuti admin.
- Notifikasi email (keputusan pengajuan, penilaian tugas, dsb.).
- Asisten chat di dalam halaman belajar.
- Soal kuis selain pilihan tunggal.

---

## Riwayat singkat

Bermula dari Laravel + Blade, pindah ke Next.js + NestJS/Prisma, lalu ke
Firebase. Data empat kursus awal dimigrasikan dari array PHP. Akun lama
diimpor beserta hash kata sandinya, jadi kata sandi lama tetap berlaku.
