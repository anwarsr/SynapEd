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
| `/dashboard/certificates/:id` | **pemilik sertifikat atau admin** — halaman cetak |
| `/verify/:certificateId` | publik — verifikasi sertifikat |
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

**`establishSession` selalu mengambil ulang ID token** (`getIdToken(true)`)
sebelum menukarnya. Nama, foto, dan role ikut tertanam di dalam token lalu
disalin ke cookie, sedangkan token yang ter-cache masih memuat isi lama.
Melewatkan ini pernah membuat nama saat mendaftar terabaikan: akun dibuat lebih
dulu — token terbit tanpa nama — nama disetel sesudahnya, lalu token lama itu
yang ditukar. Server tidak menemukan nama dan jatuh ke potongan email, sehingga
`digibinproject@gmail.com` menjadi `digibinproject`. Dijaga oleh
`npm run verify:signup`.

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

Peserta menandai pelajaran bacaan/video selesai lewat tombol di halaman
belajar (`markLessonComplete`), yang menulis `completedLessons` dengan
`FieldValue.arrayUnion` — idempoten, jadi klik ganda atau dua tab terbuka
tidak bisa menggandakan progres. Pelajaran bertipe kuis **tidak** bisa
ditandai lewat tombol ini; lihat bagian *Kuis* di bawah.

## Materi terkunci (Storage)

`storage.rules` menolak semua pembacaan langsung ke `lesson-assets/**` dan
`course-assets/{uid}/**` (`allow read: if false`). Satu-satunya jalan masuk
adalah route API `GET /api/courses/:slug/asset?path=…`, yang:

1. memeriksa `getCourseAccess()` — harus admin, pemilik kursus, atau peserta
   terdaftar dengan akses penuh ke pelajaran itu;
2. memverifikasi ulang bahwa `path` yang diminta **benar-benar** muncul di
   `attachments` salah satu pelajaran kursus itu — tanpa ini, route-nya jadi
   proxy terbuka ke seluruh bucket lewat `?path=avatars/…`;
3. **mengalirkan berkasnya sendiri** dengan `Cache-Control: private, no-store`.

Butir 3 dulu menerbitkan **signed URL** lalu mengalihkan ke sana. Itu tampak
lebih hemat, tetapi menandatangani URL menuntut kunci privat, sedangkan
Application Default Credentials dari `gcloud auth application-default login`
tidak punya — jadi setiap unduhan **selalu 500 di komputer pengembang** meski
berjalan di produksi. Mengalirkan sendiri bekerja sama di kedua tempat, dan
sekaligus memungkinkan `Content-Disposition: inline` yang membuat berkasnya
bisa ditampilkan di halaman. Lampiran dibatasi 20 MB oleh `storage.rules`,
jadi melewatkannya lewat server masih murah.

### Membaca materi di halaman

Materi **hanya PDF**, dan dirender sendiri dengan **PDF.js** — bukan disematkan
lewat `<iframe>`.

Alasannya: penampil PDF bawaan peramban adalah konteks penjelajahan tersendiri
yang **tidak bisa digayakan sama sekali**. Bilah alat abu-abunya tidak bisa
disembunyikan, diganti, atau diselaraskan dengan sisa aplikasi. Merender
sendiri ke canvas memberi bilah alat kita: navigasi halaman, zoom, layar
penuh, dan unduh, semuanya dalam gaya "Tinta & Kertas".

Halaman dirender **malas** — hanya yang mendekati layar, lewat
`IntersectionObserver` dengan margin 800px. Modul di sini bisa mencapai 39
halaman; merender semuanya sekaligus membekukan tab beberapa detik dan
memakan ratusan megabyte canvas. Tinggi tiap halaman dipesan lebih dulu dari
viewport PDF supaya bilah gulir tidak melompat saat halaman menyusul digambar.

Worker PDF.js disalin ke `public/` oleh `scripts/copy-pdf-worker.mjs`, yang
jalan otomatis sebelum `dev` dan `build`. Tidak dikomit: berkas terbangun di
dalam repo pasti tertinggal versi begitu `pdfjs-dist` diperbarui, dan
ketidakcocokan versi worker membuat PDF gagal dimuat dengan pesan yang
membingungkan.

**Word tidak lagi didukung.** Dukungan `.docx` sempat ada lewat `mammoth` lalu
`docx-preview`, tetapi tampilannya tidak pernah setia: setiap pengurai harus
menerka ulang tata letak Word, dan gambar latar sehalaman penuh selalu jadi
korbannya. Lampiran `.docx` yang terlanjur tersimpan **tetap bisa diunduh** —
yang hilang hanya penayangannya di halaman, dan halaman belajar mengatakan
alasannya alih-alih berpura-pura materinya belum ada.

Layanan pratinjau milik Microsoft dan Google tidak pernah dipakai: keduanya
menuntut berkasnya dapat diakses publik dari internet — justru yang sengaja
dicegah di sini.

### Tata letak halaman belajar

Daftar materi bisa **diciutkan** di layar lebar, dan kolom materi ikut melebar
(`max-w-5xl` menjadi `max-w-6xl`). Pilihannya diingat di `localStorage` lewat
`useLocalToggle` — mengulang klik yang sama tiap ganti pelajaran jelas
menjengkelkan.

Hook itu memakai `useSyncExternalStore`, bukan `useState` + `useEffect`:
`localStorage` adalah sumber data di luar React, dan membacanya lewat efek
lalu memanggil `setState` memicu render berantai — persis yang dilarang aturan
`react-hooks/set-state-in-effect`.

## Asisten chat (FAQ)

Widget mengambang **"Asisten SynapEd"** muncul di setiap halaman publik
(kecuali `/login` dan `/register`) — termasuk untuk pengunjung yang belum
masuk, karena pertanyaan seperti "bagaimana cara mendaftar" justru konten
pra-daftar. Dipasang sekali di `frontend/src/app/layout.tsx`, jadi tidak
perlu disentuh di halaman mana pun.

Dijalankan lewat **OpenRouter** dengan model gratis, lewat route API
streaming `POST /api/chat` — bukan Server Action, karena chat butuh respons
mengalir token demi token, bentuk yang tidak dimiliki Server Action.
Memakai `fetch()` biasa, **tanpa SDK**: format `/chat/completions` + SSE
sudah jadi standar de-facto yang stabil, jadi tidak ada dependensi baru
sama sekali. (Percobaan sebelumnya dengan `@google/genai` — SDK resmi
Gemini — kandas justru pada metode yang direkomendasikan dokumentasinya
sendiri, melempar `TypeError` saat dipanggil sungguhan padahal typecheck
lulus. Itu alasan `fetch()` polos dipilih di sini, bukan sekadar selera.)

### Rantai model, bukan satu model

`frontend/src/lib/openrouter.ts` mengirim tiga model sekaligus lewat
parameter `models`; OpenRouter otomatis pindah ke berikutnya kalau yang
pertama sedang penuh:

1. `nvidia/nemotron-3-ultra-550b-a55b:free` — model 550B, jawaban paling
   berkualitas, tapi lambat (~2–10 detik ke token pertama, teruji langsung).
2. `google/gemma-4-26b-a4b-it:free`
3. `nvidia/nemotron-3-super-120b-a12b:free`

Model `:free` dilayani dari kolam bersama SELURUH pengguna OpenRouter, jadi
HTTP 429 "upstream_provider_shared_pool" bisa muncul walau jatah harian
kita masih utuh — rantai fallback inilah yang menyelamatkan permintaan saat
itu terjadi, bukan sekadar redundansi.

**Kalau menambah/mengganti model di rantai itu, uji dulu dua hal**: model
harus menerima `reasoning: {enabled:false}` (mis. `openai/gpt-oss-20b:free`
menolaknya dengan "Reasoning is mandatory" dan mematahkan seluruh rantai),
dan harus menjawab Bahasa Indonesia dengan wajar.

### Dua setelan yang wajib, bukan selera

- **`temperature: 0.3`** (default OpenRouter 1.0). Ini perbaikan bug, bukan
  penyetelan gaya: pada temperature 1, `gemma-4-26b` meluruh jadi sampah —
  `<pad><pad><pad>…` berulang, atau kalimat Indonesia yang berubah jadi
  teks Hindi berulang di tengah jawaban. Pada 0.3 jawabannya rapi.
- **`reasoning: {enabled:false}`**. Model reasoning bisa boros token cuma
  untuk bernalar sebelum menjawab satu kata. Untuk FAQ yang jawabannya
  sudah digroundkan ke system prompt, penalaran tidak menambah kualitas —
  hanya memperlambat.

### Yang perlu diketahui

- **Hanya jawab topik SynapEd.** System prompt (`lib/chatPrompt.ts`) berisi
  instruksi pemandu + basis FAQ tulisan tangan + katalog kursus hidup dari
  `listCourses()`. Pertanyaan di luar topik ditolak sopan; asisten
  diinstruksikan tidak pernah mengarang harga/kebijakan.
- **Kursus berbayar belum bisa dibeli** — asisten jujur soal ini, konsisten
  dengan tombol "Pembayaran segera hadir" di halaman kursus.
- **Klien tidak bisa menyuntik system prompt.** Route menolak `role` selain
  `user`/`assistant`, jadi `{"role":"system"}` dari browser ditolak `400`.
- **Tanpa riwayat di server.** Klien mengirim ulang seluruh percakapan tiap
  giliran; server tidak menyimpan apa pun. Muat ulang halaman = percakapan
  hilang — batasan MVP yang disengaja.
- **Pembatas laju in-memory** (`lib/chatRateLimit.ts`) per `uid`/IP, 8
  pesan/menit. Keterbatasan yang disadari: state hidup di memori satu
  proses, jadi tidak berlaku silang kalau nanti di-deploy multi-instance.
- **Kecepatan**: ~2–10 detik sampai kata pertama muncul (model utama
  550B relatif besar). Indikator "Mengetik…" di widget itu penting, bukan
  hiasan.
- **Belum bisa membantu di dalam halaman belajar** suatu kursus — direncanakan
  fase berikutnya; asisten menjelaskan ini kalau ditanya, bukan berpura-pura bisa.

### Batas tingkat gratis

| | Tanpa isi kredit | Pernah isi kredit $10 |
|---|---|---|
| Permintaan/hari | **50** (untuk SELURUH pengunjung) | **1000** |
| Permintaan/menit | 20 | 20 |

Kredit $10 itu **tidak terpakai** oleh model `:free` — hanya syarat pembuka
tingkat. 50/hari cukup untuk demo, tapi satu pengunjung antusias bisa
menghabiskannya dalam beberapa menit; naikkan ke 1000/hari sebelum situs
dipakai orang banyak. Dokumentasi OpenRouter sendiri menyebut model `:free`
"usually not suitable for production use".

Env var: `OPENROUTER_API_KEY` di `frontend/.env.local` (server-only, ambil di
https://openrouter.ai/keys). Tanpa ini `/api/chat` mengembalikan `500`.
Periksa kunci & model dengan satu panggilan uji:

```bash
npm run check:chat
```

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
kirim, kursusnya jadi utuh.

Kurikulumnya **bebas** — berapa pun bagian dan pelajarannya, dalam urutan mana
pun. Tiga jenis pelajaran:

| Jenis | Isi |
|---|---|
| Modul / Bacaan | unggah PDF |
| Video | tautan YouTube |
| Penugasan / Kuis | unggah PDF, plus soal kuis dari halaman sunting |

Penyusunnya (`components/educator/curriculumDraft.tsx`) **satu komponen yang
sama** dengan yang dipakai halaman sunting. Sebelumnya form pembuatan memaksa
template kaku — tepat satu modul, satu video, satu tugas — sementara editor
sudah bebas, sehingga educator harus melewati bentuk yang tidak dia inginkan
dulu lalu membetulkannya di halaman lain. Menyatukannya juga mencegah dua
aturan yang perlahan melenceng, alasan yang sama dengan `normalizeSections`
di sisi server.

Kursus buatan educator memakai **struktur dokumen yang sama persis** dengan
kursus hasil migrasi. Karena itu katalog, halaman detail, dan halaman belajar
bekerja tanpa satu baris pun kode khusus; `videoUrl` dan `attachments` memang
sudah ada di model `Lesson`.

Soal kuis baru bisa ditambahkan **setelah** kursus tersimpan: kuis hidup di
dokumen terpisah berkunci `lessonSlug`, dan slug itu baru terbit di server.
Karena itu setelah diterbitkan, educator langsung diantar ke halaman sunting.

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
- **Kategori dipilih dari daftar**, bukan diketik bebas — lihat bagian
  *Kategori* di bawah.
- **Kursus bawaan tidak punya `ownerUid`.** Itu berarti bukan milik educator
  mana pun, jadi tidak seorang pun bisa menghapusnya lewat panel educator.

Berkas disimpan di `course-assets/{uid}/{draft}/…`. `storage.rules` hanya
mengizinkan pemiliknya sendiri, hanya bila `role == 'educator'`, maksimal 20 MB,
dan hanya satu tipe: PDF. Daftarnya sengaja tertutup — pola
`application/.*` akan ikut mengizinkan berkas yang dapat dieksekusi.

Kursus **langsung tampil di katalog** begitu diterbitkan, tanpa peninjauan
admin — gerbangnya ada di persetujuan educator, bukan per kursus.

### Menyunting kursus

**Kursus Saya** → **Sunting** membuka `/educator/courses/:slug/edit` — pemilik
kursus atau admin, diperiksa lewat `requireOwnedCourse()`. Dua formulir
terpisah dengan tombol simpan masing-masing:

- **Info kursus** (`updateCourseMeta`) — judul, deskripsi, tingkat, kategori,
  ikon, durasi, **harga**, "Yang Akan Dipelajari", dan "Persyaratan".
- **Kurikulum** (`saveCurriculum`) — penyusun yang sama dengan form buat baru.
  Penggantian penuh setiap disimpan, bukan patch per pelajaran.

Slug pelajaran yang sudah ada **dipertahankan apa adanya** — retitle tidak
mengubah slug-nya, supaya progres peserta (`completedLessons`) tidak jadi
yatim. Pelajaran baru mendapat slug dari judulnya di server, dijamin unik
di dalam kursus itu. `position` juga ditulis ulang sebagai indeks array
(0-based) setiap disimpan — jadi kursus lama dari form (dulu 1-based) dan
kursus hasil migrasi (0-based) konvergen begitu disunting, tanpa migrasi
data apa pun.

`createCourse` dan `saveCurriculum` memakai **validator yang sama**
(`normalizeSections` di `lib/curriculum.ts`) — bentuk tiga-pelajaran saat
membuat kursus baru sekarang cuma templat awal, bukan struktur yang dikunci.

`deleteCourse` memakai `recursiveDelete`, bukan `.delete()` biasa — supaya
subcollection (`courses/{slug}/quizzes/*`) ikut terhapus, bukan tertinggal
yatim dan tetap ditagih.

### Kuis

Pelajaran bertipe `quiz` bisa punya soal pilihan tunggal, dikelola lewat
**Kelola Soal Kuis** di editor kurikulum (`QuizEditor.tsx`). Setiap soal punya
2–8 pilihan, satu jawaban benar, poin, dan penjelasan opsional. `passingScore`
dan `maxAttempts` (0 = tanpa batas) berlaku per kuis.

Soal dan jawaban benarnya hidup di **subcollection terpisah**,
`courses/{slug}/quizzes/{lessonSlug}` — bukan di dalam dokumen kursus.
Alasannya satu kalimat: `courses/{slug}` bersifat `allow read: if true`, jadi
apa pun yang bersarang di dalamnya otomatis publik. Firestore rules **tidak
hierarkis** — `match /courses/{slug}` tidak menjangkau subcollection-nya sama
sekali — sehingga dokumen kuis sudah tertutup total lewat penolakan
menyeluruh, dan blok deny eksplisit di `firestore.rules` hanya jaga-jaga
terhadap suntingan ceroboh di masa depan.

Tiga lapis mencegah `correctOptionId` bocor ke peserta:

1. Tipe `PublicQuestion`/`PublicQuiz` (`lib/quiz.ts`) tidak punya field untuk
   dibocori — menyerahkan dokumen mentah ke komponen klien adalah galat tipe.
2. `toPublicQuiz()` satu-satunya konversi yang disahkan, memilih field secara
   eksplisit (bukan `{...spread}`).
3. Rules Firestore menolak seluruh subcollection sebagai cadangan.

Penilaian (`submitQuiz`) berjalan di server: memeriksa enrollment aktif,
menghitung skor, menyimpan percobaan di `enrollments/{id}/quizAttempts`,
memperbarui `quizScores[lessonSlug]` hanya kalau rekornya membaik, dan
menandai pelajaran selesai **hanya kalau lulus**. Penjelasan tiap soal baru
dikirim ke klien setelah peserta lulus atau kehabisan percobaan — bukan di
setiap percobaan, supaya kuisnya tidak bisa "dibobol" dengan mencoba berkali-
kali sambil membaca penjelasan tiap kali gagal.

Kursus hasil migrasi yang pelajaran `quiz`-nya sebenarnya tugas unduhan tidak
punya dokumen kuis — halaman belajar jatuh ke tampilan lampiran lama tanpa
migrasi data apa pun.

### Sertifikat

Begitu **semua** pelajaran di kurikulum yang sedang berlaku tercatat selesai
(termasuk kuis — yang berarti sudah lulus), `issueCertificateIfComplete`
menerbitkan satu dokumen di `certificates/{id}`, dipicu dari dalam
`markLessonComplete` dan `submitQuiz` setelah lulus. Transaksional dan
idempoten: memicunya berkali-kali (dua tab, klik ulang) tidak menerbitkan
dokumen kedua.

ID sertifikat **acak** (`SYN-` + 10 karakter Crockford base32 dari
`crypto.randomBytes`), bukan diturunkan dari `uid+slug` seperti ID enrollment
— sengaja dibalik, karena halaman verifikasinya publik tanpa login, dan ID
yang bisa dihitung akan membiarkan siapa pun memastikan kursus apa yang
diselesaikan orang lain. `holderName` dan `courseTitle` di-snapshot saat
terbit, supaya sertifikat lama tidak diam-diam berubah kalau penggantinya
mengubah nama akun atau kursusnya disunting.

| Halaman | Akses |
|---|---|
| `/verify/:certificateId` | publik, tanpa login — dibaca lewat Admin SDK di Server Component |
| `/dashboard/certificates/:id` | pemilik sertifikat atau admin — halaman cetak (`window.print()`, tanpa pustaka PDF) |

Koleksi `certificates` tertutup rapat dari klien (`allow read, write: if
false`) sama seperti `enrollments`; halaman verifikasi tidak butuh
pelonggaran rules karena tidak pernah memakai SDK klien untuk membacanya.

### Kategori kursus

Dikelola admin di **Panel Admin → Kategori**, disimpan di koleksi
`categories/{slug}`. Dulu konstanta di dalam kode, jadi menambah kategori
berarti mengubah kode dan men-deploy ulang.

Disimpan sebagai koleksi tersendiri, **bukan diturunkan dari kursus yang ada**:
kalau diturunkan, kategori baru mustahil dipilih educator karena belum ada satu
pun kursus yang memakainya. Kategori yang baru dibuat langsung muncul di form
educator maupun di filter katalog.

Dua penjaga yang penting:

- **Slug tidak ikut berubah saat nama diganti.** Slug tersimpan di setiap
  dokumen kursus, jadi mengubahnya memutus tautan seluruh kursus di kategori
  itu. Yang berubah hanya labelnya.
- **Kategori yang masih dipakai tidak bisa dihapus.** Kalau boleh, kursusnya
  tetap menyimpan slug yang sudah tidak ada: hilang dari filter, dan gagal
  setiap kali educator menyimpan suntingan karena kategorinya dianggap tidak
  valid.

`npm run seed:categories` memindahkan kategori lama ke koleksi ini. Aman
dijalankan berkali-kali, dan berhenti dengan galat kalau ada kursus yang
kategorinya belum terdaftar.

### Gambar latar kursus

Educator mengunggah gambar sampul saat membuat atau menyunting kursus;
pemilihan ikon dihapus. `icon` dan `tint` masih ada di dokumen, tetapi
sekarang hanya dipakai sebagai **latar cadangan** untuk kursus yang belum
punya gambar — termasuk empat kursus hasil migrasi.

Gambar disimpan di `course-thumbnails/{uid}/…`, folder yang **terpisah** dari
`course-assets`. Bedanya menentukan: sampul kursus `allow read: if true`
karena memang tampil di katalog yang bisa dilihat tanpa masuk, sedangkan
materi tertutup rapat dan hanya dilayani lewat route bertanda tangan.
Menyatukan keduanya berarti memilih satu aturan baca untuk dua hal yang
kebutuhan kerahasiaannya berlawanan.

Nilai `thumbnail` punya tiga bentuk di data yang nyata, dan `courseImageUrl()`
menangani ketiganya: path Storage (unggahan educator), URL penuh, dan path di
folder `public/` (keduanya dari kursus hasil migrasi).

Saat menyunting, field `thumbnail` **hanya dikirim kalau memang diubah**
(`undefined` = biarkan, `null` = hapus, string = path baru). Kalau selalu
dikirim ulang, menyimpan perubahan judul saja akan gagal pada kursus lama yang
gambarnya berupa URL — atau lebih buruk, diam-diam menghapusnya.

### Menguji

Skrip-skrip ini menguji semuanya terhadap proyek asli. Semuanya membuat akun
uji sementara dan menghapusnya lagi di akhir; akun sungguhan tidak disentuh.

```bash
npm run typecheck          # skrip di scripts/ — tsx TIDAK memeriksa tipe
npm run verify:admin       # penjagaan /admin               (butuh dev server)
npm run verify:educator    # alur pengajuan sampai putusan  (butuh dev server)
npm run verify:course      # pembuatan kursus oleh educator (butuh dev server)
npm run verify:category    # kategori yang dikelola admin    (butuh dev server)
npm run verify:curriculum  # sunting info & kurikulum       (butuh dev server)
npm run verify:enrollment  # pendaftaran & gerbang akses    (butuh dev server)
npm run verify:quiz        # soal, penilaian, anti-bocor    (butuh dev server)
npm run verify:certificate # penerbitan & verifikasi        (butuh dev server)
npm run verify:classroom   # kelas: kode undangan, post, balasan (butuh dev server)
npm run verify:material    # penyajian & unduhan berkas     (butuh dev server)
npm run verify:pdf         # penampil PDF & tata letak di Chrome
npm run verify:google      # cara masuk & halaman profil    (butuh dev server)
npm run verify:signup      # nama saat mendaftar            (butuh dev server)
npm run verify:rules       # rules Firestore & Storage yang sedang ter-deploy
```

`verify:enrollment` menjaga invarian yang paling mudah hilang tanpa disadari:
pengguna yang **sudah masuk tetapi belum mendaftar** tidak boleh membuka
pelajaran berbayar, sementara pelajaran bertanda `free` tetap terbuka. Ia juga
membuktikan pendaftarannya idempoten — mendaftar dua kali tidak menaikkan
jumlah peserta dua kali.

Yang memakai `scripts/testSupport.ts` (`verify:educator`, `verify:course`,
`verify:curriculum`, `verify:enrollment`) ikut berjalan di emulator: setel
`FIRESTORE_EMULATOR_HOST` dan `FIREBASE_AUTH_EMULATOR_HOST` sebelum
menjalankannya. `verify:admin` dan `verify:rules` masih memanggil Identity
Toolkit langsung, jadi keduanya tetap butuh proyek asli.

`verify:google` meniru setiap keadaan lewat Admin SDK — melepas kata sandi,
menandai email terverifikasi, menautkan google.com — sehingga keempat kombinasi
cara masuk teruji tanpa perlu popup Google sungguhan. Termasuk yang paling
penting: kata sandi **tetap ada** setelah Google ditautkan.

`verify:educator` memanggil Server Action yang sesungguhnya lewat POST +
header `Next-Action`, persis seperti browser saat tombolnya ditekan — jadi yang
teruji kode produksinya, bukan tiruan alurnya. ID action-nya dibaca dari
manifest `.next/dev`, karena itu dev server harus berjalan.

`verify:rules` membuktikan empat hal terpenting: pengguna biasa **tidak** bisa
menulis field `role` ke dokumennya sendiri, **tidak** bisa menyentuh
lamarannya sendiri untuk menandainya `accepted`, **tidak** bisa membaca
dokumen kuis siapa pun, dan **tidak** bisa membaca enrollment orang lain.

`verify:quiz` memuat titik pengujian paling kritis di seluruh proyek: setiap
payload yang sampai ke peserta (HTML halaman belajar, tiap balasan
`submitQuiz`) digeledah mencari literal `"correctOptionId"` — harus nol hasil,
persis meniru cara memeriksa tab Network di DevTools. Ia juga membuktikan
penjelasan soal baru terbuka setelah lulus atau kehabisan percobaan, dan skor
terbaik tidak pernah turun akibat percobaan gagal berikutnya.

`verify:certificate` membuktikan sertifikat baru terbit setelah **semua**
pelajaran (termasuk kuis) selesai — bukan sebagian — penerbitannya idempoten
(mengulang aksi yang sudah selesai tidak menerbitkan dokumen kedua), halaman
verifikasi publik bisa dibuka tanpa login, dan halaman cetak di dashboard
menolak siapa pun selain pemilik sertifikat atau admin.

## Yang belum ada

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
- **Pembayaran.** Kursus berbayar menampilkan tombol **Pembayaran segera
  hadir** yang nonaktif — belum ada gerbang pembayaran (Midtrans) yang
  terpasang, jadi kursus berharga di atas Rp0 tidak bisa benar-benar dibeli.
- **Kuis pilihan ganda-jamak.** Versi ini sengaja dibatasi pilihan tunggal;
  tipe soal lain (`multiple`, isian singkat, dsb.) belum ada.
- **Asisten di dalam halaman belajar.** Widget chat saat ini hanya menjawab
  FAQ dan navigasi umum — belum bisa membantu di dalam materi/kuis suatu
  kursus. Bentuk body `/api/chat` dan `buildChatSystemPrompt()` sudah
  disiapkan untuk diperluas ke sana tanpa merombak fondasinya.
- **Sertifikat PDF sisi server.** Halaman cetak memakai print-to-PDF bawaan
  browser (`window.print()`), bukan generator PDF di server — keputusan
  sadar untuk menghindari dependensi headless Chrome demi manfaat yang tidak
  terlihat pengguna.
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
