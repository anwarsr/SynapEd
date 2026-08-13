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
| `/courses/:slug/learn[/:lessonSlug]` | **perlu terdaftar** — kecuali pelajaran bertanda `free` |
| `/dashboard` | **perlu masuk** — kursus saya + pengaturan akun |
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

## Pendaftaran kursus

Koleksi kedua: `enrollments/{uid}_{slug}`. Document ID-nya **dihitung**, bukan
auto-ID — dan itu bukan gaya-gayaan:

```
enrollmentRef(uid, slug).set({ … }, { merge: true })
```

Tulisan itu aman dijalankan berapa kali pun. Saat gerbang pembayaran dipasang
nanti, webhook-nya bisa mengirim ulang notifikasi dan datang tidak berurutan —
dengan ID tetap, tidak dibutuhkan transaksi atau read-before-write untuk
mencegah pendaftaran ganda.

Koleksinya **tertutup rapat dari klien** (`allow read, write: if false`), sama
seperti `educatorApplications`: halaman belajar dan dashboard dirender di
server, jadi browser tidak pernah perlu membacanya sendiri.

Pelajaran yang boleh dibuka ditentukan satu baris di `src/lib/courseAccess.ts`:

```ts
access.level === "full" || lesson.free === true
```

Admin dan pemilik kursus mendapat `full` tanpa mendaftar — educator harus bisa
meninjau kursusnya sendiri. Pelajaran terkunci **dialihkan ke halaman
penjualan, bukan 404**: pelajarannya memang ada, dan di sanalah tempat
memperoleh aksesnya.

Kemajuan belajar dihitung dari **irisan** dengan kurikulum yang sedang berlaku,
tidak pernah dari `completedLessons.length` begitu saja — alasannya sama dengan
`lessonsCount` yang tidak disimpan: begitu sebuah pelajaran dihapus, angka
turunan yang tersimpan akan melenceng (dan bisa merender 110%).

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

## Masuk dengan Google

Halaman `/login` dan `/register` punya tombol **Masuk/Daftar dengan Google**.
Satu tombol untuk keduanya, karena Firebase memang tidak membedakannya: kalau
email-nya belum terdaftar, akunnya dibuat saat itu juga.

Memakai `signInWithPopup`, bukan `signInWithRedirect`. Redirect menyimpan
keadaan di cookie pihak ketiga, dan browser yang memblokirnya membuat alur itu
gagal diam-diam. Sisanya tidak berubah — ID token dari Google ditukar menjadi
session cookie lewat jalur yang sama dengan login kata sandi, jadi tidak ada
perubahan di sisi server sama sekali.

### Yang harus disetel di Firebase Console

Hanya satu langkah, dan **wajib** — tanpa ini tombolnya gagal dengan
`auth/operation-not-allowed`:

1. Buka [Firebase Console](https://console.firebase.google.com/project/synap-ed/authentication/providers)
   → **Authentication** → **Sign-in method**
2. **Add new provider** → **Google** → aktifkan
3. Isi **Project support email** (wajib diisi Google, pilih email Anda)
4. **Save**

Client ID dan secret OAuth dibuat otomatis; tidak ada yang perlu disalin ke
`.env.local`.

Periksa hasilnya tanpa membuka Console:

```bash
npm run check:google                          # provider aktif? domain diizinkan?
npm run check:google seseorang@gmail.com      # metode masuk akun tertentu
```

`localhost` sudah ada di daftar domain yang diizinkan, jadi popup langsung
berfungsi saat pengembangan. Domain produksi ditambahkan nanti di
**Authentication → Settings → Authorized domains**.

### Email sama, kata sandi terlepas

**Ini sudah terbukti terjadi, bukan sekadar kemungkinan.**

Proyek disetel **satu email = satu akun**. Saat sebuah email yang sudah punya
akun kata sandi dipakai masuk lewat Google, Firebase menautkan Google ke akun
yang sama — uid-nya tetap, jadi role dan data tidak hilang — lalu **melepas
kredensial kata sandinya**. Sejak itu akun tersebut hanya bisa masuk lewat
Google.

Ini **perilaku keamanan yang benar dan tidak boleh dilawan**. Akun kata sandi
tidak pernah membuktikan kepemilikan email; Google membuktikannya. Kalau
kredensial lama dibiarkan, siapa pun yang mendaftar memakai email orang lain
akan tetap punya akses setelah pemilik aslinya masuk. Tidak ada setelan Firebase
yang mematikannya, dan mengizinkan email ganda justru lebih buruk — satu orang
jadi punya dua akun terpisah dengan role dan data yang terbelah.

Sebabnya adalah **email yang belum diverifikasi**. Kalau akun kata sandi sudah
terverifikasi, Google menempel sebagai metode tambahan dan kata sandinya tetap.

**Pencegahannya: jangan menekan "Masuk dengan Google" untuk menambahkan Google
ke akun berkata sandi.** Gunakan **Tautkan Akun Google** di halaman profil.
Menautkan bersifat menambah — kata sandinya tidak tersentuh. Kartu *Cara Masuk*
di profil menawarkan tombol itu dan, selama email belum terverifikasi,
menjelaskan risikonya beserta tombol kirim tautan verifikasi.

Pendaftaran dengan kata sandi juga otomatis mengirim tautan verifikasi. Yang
tidak pernah mengkliknya lalu masuk lewat Google tetap kehilangan kata sandinya
— itu batas yang tidak bisa dilewati dari sisi aplikasi.

Kalau sudah terlanjur, dua jalan keluar, keduanya swalayan:

| Kalau | Lakukan |
|---|---|
| tidak bisa masuk sama sekali | **Lupa kata sandi?** di `/login` — tautannya juga memasang kata sandi baru pada akun yang selama ini hanya punya Google |
| masih bisa masuk lewat Google | **Buat Kata Sandi** di halaman profil |

Periksa keadaan sebuah akun kapan saja:

```bash
npm run check:google seseorang@gmail.com
```

Bila Firebase justru menolak dengan `auth/account-exists-with-different-credential`,
aplikasi menampilkan pesan yang menyuruh masuk memakai kata sandi.

### Akun tanpa kata sandi

Akun yang hanya masuk lewat Google tidak punya kata sandi untuk dicocokkan,
padahal Firebase mewajibkan autentikasi ulang sebelum operasi sensitif. Halaman
profil menyesuaikan diri:

- **Kata Sandi** berubah menjadi **Buat Kata Sandi**
- **Hapus Akun** konfirmasi lewat popup Google, bukan mengetik kata sandi
- **Alamat Email** diganti keterangan — alamatnya mengikuti akun Google, dan
  mengubahnya di sini justru membuat masuk lewat Google berhenti mengenali akun
  itu. Buat kata sandi dulu, baru email bisa diubah.

Popup Google untuk konfirmasi memakai `login_hint`, bukan
`prompt: "select_account"` — akunnya sudah tertentu, jadi menyodorkan daftar
seluruh akun Google hanya mengundang salah pilih yang berakhir dengan
`auth/user-mismatch`.

Membuat kata sandi **mencoba dulu, baru meminta konfirmasi** kalau Firebase
menuntut sesi yang lebih baru (`auth/requires-recent-login`); pengguna yang baru
saja masuk tidak melihat popup sama sekali. Menghapus akun tidak begitu — di
sana konfirmasi selalu diminta, karena tindakannya tidak bisa dibatalkan dan
tidak pantas berjalan hanya karena sesinya kebetulan masih segar.

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

### Educator membuat kursus

Educator membuka **Kursus Saya** → **Buat Kursus**. Satu formulir, satu kali
kirim, kursusnya jadi utuh:

| Bagian | Bentuk |
|---|---|
| Modul materi | unggah PDF atau Word |
| Video pembelajaran | tautan YouTube |
| Penugasan akhir | unggah PDF atau Word |

Kursus buatan educator memakai **struktur dokumen yang sama persis** dengan
kursus hasil migrasi — satu section berisi tiga pelajaran. Karena itu katalog,
halaman detail, dan halaman belajar bekerja tanpa satu baris pun kode khusus;
`videoUrl` dan `attachments` memang sudah ada di model `Lesson`.

Beberapa hal yang mudah terlewat:

- **`order` wajib ada.** Katalog memakai `orderBy('order')`, dan Firestore
  mengabaikan dokumen yang tidak punya field itu — kursus baru akan hilang dari
  katalog tanpa pesan galat apa pun.
- **Path berkas tidak dipercaya.** Berkas diunggah dari browser, jadi server
  memeriksa ulang bahwa path-nya diawali `course-assets/{uid-pengunggah}/`.
  Tanpa itu, seorang educator bisa menerbitkan berkas milik akun lain.
- **Tautan video divalidasi memakai `toEmbedUrl`** — pengubah yang sama dengan
  yang dipakai halaman belajar. Kalau ia tidak mengenali tautannya, videonya
  juga tidak akan tampil di sana, jadi lebih baik ditolak saat dibuat.
- **Kategori dibatasi** ke tiga yang sudah ada. Kategori bebas berarti kombinasi
  indeks Firestore baru untuk tiap nilai, dan daftar filter yang terpecah oleh
  salah ketik.
- **Kursus bawaan tidak punya `ownerUid`.** Itu berarti bukan milik educator
  mana pun, jadi tidak seorang pun bisa menghapusnya lewat panel educator.

Berkas disimpan di `course-assets/{uid}/{draft}/…`. `storage.rules` hanya
mengizinkan pemiliknya sendiri, hanya bila `role == 'educator'`, maksimal 20 MB,
dan hanya tiga tipe: PDF, DOC, DOCX. Daftarnya sengaja tertutup — pola
`application/.*` akan ikut mengizinkan berkas yang dapat dieksekusi.

**Belum ada penyuntingan.** Kursus yang sudah terbit hanya bisa dihapus lalu
dibuat ulang. Kursus juga **langsung tampil di katalog** begitu diterbitkan,
tanpa peninjauan admin — gerbangnya ada di persetujuan educator, bukan per
kursus.

### Menguji

Skrip-skrip ini menguji semuanya terhadap proyek asli. Semuanya membuat akun
uji sementara dan menghapusnya lagi di akhir; akun sungguhan tidak disentuh.

```bash
npm run typecheck          # skrip di scripts/ — tsx TIDAK memeriksa tipe
npm run verify:admin       # penjagaan /admin               (butuh dev server)
npm run verify:educator    # alur pengajuan sampai putusan  (butuh dev server)
npm run verify:course      # pembuatan kursus oleh educator (butuh dev server)
npm run verify:enrollment  # pendaftaran & gerbang akses    (butuh dev server)
npm run verify:google      # cara masuk & halaman profil    (butuh dev server)
npm run verify:rules       # rules Firestore & Storage yang sedang ter-deploy
```

`verify:enrollment` menjaga invarian yang paling mudah hilang tanpa disadari:
pengguna yang **sudah masuk tetapi belum mendaftar** tidak boleh membuka
pelajaran berbayar, sementara pelajaran bertanda `free` tetap terbuka. Ia juga
membuktikan pendaftarannya idempoten — mendaftar dua kali tidak menaikkan
jumlah peserta dua kali.

Yang memakai `scripts/testSupport.ts` (`verify:educator`, `verify:course`,
`verify:enrollment`) ikut berjalan di emulator: setel `FIRESTORE_EMULATOR_HOST`
dan `FIREBASE_AUTH_EMULATOR_HOST` sebelum menjalankannya. `verify:admin` dan
`verify:rules` masih memanggil Identity Toolkit langsung, jadi keduanya tetap
butuh proyek asli.

`verify:google` meniru setiap keadaan lewat Admin SDK — melepas kata sandi,
menandai email terverifikasi, menautkan google.com — sehingga keempat kombinasi
cara masuk teruji tanpa perlu popup Google sungguhan. Termasuk yang paling
penting: kata sandi **tetap ada** setelah Google ditautkan.

`verify:educator` memanggil Server Action yang sesungguhnya lewat POST +
header `Next-Action`, persis seperti browser saat tombolnya ditekan — jadi yang
teruji kode produksinya, bukan tiruan alurnya. ID action-nya dibaca dari
manifest `.next/dev`, karena itu dev server harus berjalan.

`verify:rules` membuktikan dua hal terpenting: pengguna biasa **tidak** bisa
menulis field `role` ke dokumennya sendiri, dan **tidak** bisa menyentuh
lamarannya sendiri untuk menandainya `accepted`.

## Yang belum ada

- **Menyunting kursus.** Sekali terbit, yang bisa dilakukan hanya menghapus dan
  membuat ulang.
- **Kurikulum yang lebih dari tiga bagian.** Bentuknya masih tetap: satu modul,
  satu video, satu tugas. Kursus hasil migrasi tetap boleh berlapis-lapis;
  yang dibatasi hanya pembuatan lewat formulir.
- **Pengumpulan tugas.** Penugasan akhir baru berupa berkas soal yang diunduh;
  peserta belum bisa mengirimkan jawaban.
- **Peninjauan kursus.** Kursus langsung tampil di katalog tanpa persetujuan
  admin per kursus.
- **CMS untuk kursus bawaan.** `videoUrl` dan `attachments` pada empat kursus
  hasil migrasi masih diisi lewat Firebase Console.
- **Mengubah role sembarangan dari UI.** Hanya keputusan pengajuan educator yang
  bisa dilakukan dari panel; sisanya lewat skrip, karena endpoint tulis untuk
  role harus dijaga sangat ketat.
- **Pemberitahuan ke pelamar.** Hasil keputusan hanya terlihat kalau pelamar
  membuka `/educator` atau profilnya; belum ada email atau notifikasi.
- **Menyelamatkan kata sandi saat masuk Google "dingin".** Menekan *Masuk
  dengan Google* dalam keadaan keluar, pada email yang punya akun kata sandi
  belum terverifikasi, tetap melepas kata sandi itu. Firebase melakukannya di
  server sebelum aplikasi tahu apa-apa. Yang tersedia adalah jalur yang benar
  (*Tautkan Akun Google*) dan pemulihannya, bukan pencegahan di jalur itu.
- **Progres belajar.** Enrollment sudah ada (lihat *Pendaftaran kursus* di
  bawah), tetapi peserta belum bisa menandai pelajaran selesai — jadi angka
  kemajuan di dashboard masih selalu 0%.
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
