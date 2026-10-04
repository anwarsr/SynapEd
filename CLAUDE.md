# SynapEd — konteks untuk AI

Berkas ini dibaca otomatis oleh Claude Code (dan berguna untuk AI lain). Isinya
yang TIDAK terlihat dari sekadar membaca satu berkas: arsitektur, invarian
keamanan & uang, konvensi, dan jebakan yang sudah pernah menggigit.
Gambaran fitur untuk manusia ada di [README.md](README.md).

## ⚠️ Wajib: jaga dua dokumen ini tetap mutakhir

Setiap perubahan yang menambah/mengubah/menghapus fitur, rute, koleksi
Firestore, aturan bisnis, skrip, variabel lingkungan, atau langkah deploy
**harus ikut memperbarui dalam perubahan yang sama**:

- `README.md` — bahasa manusia: apa fiturnya, siapa memakainya, cara menjalankan.
- `CLAUDE.md` (berkas ini) — detail teknis, invarian, jebakan, peta berkas.

Kalau menemukan isi yang sudah tidak sesuai kode, betulkan saat itu juga.
Sebutkan pembaruan dokumen ini di ringkasan akhir pekerjaan.

## Aturan pemilik proyek

- **Jangan pernah commit atau push.** Pemilik yang melakukannya; push ke
  `main` langsung memicu deploy produksi (Firebase App Hosting).
- UI, pesan galat, dan komentar kode **berbahasa Indonesia**. Komentar
  menjelaskan *mengapa*, bukan *apa* — ikuti gaya komentar yang sudah ada.
- Keputusan produk yang ambigu (uang, privasi, alur pengguna) ditanyakan dulu.
- Setiap pemeriksaan penting di `scripts/verify-*.ts` harus dibuktikan bisa
  **gagal**: pasang kembali bug-nya sebentar, pastikan merah, lalu pulihkan.

## Tumpukan & tata letak

```
frontend/        Next.js 16.2 (App Router, Turbopack) + React 19 + Tailwind v4
  src/app/       rute (Server Components)            src/lib/  logika & data
  src/components/ UI per domain                       src/proxy.ts  (dulu middleware)
  src/lib/lab/    logika murni SynapLab                src/app/lab/  papan sandbox
  apphosting.yaml konfigurasi App Hosting & secret
scripts/         skrip verifikasi, migrasi, backfill (tsx, Admin SDK)
firestore.rules, storage.rules   ← TIDAK ikut deploy otomatis
hosting-shell/   synaped.web.app hanya redirect ke URL App Hosting
docs/SETUP-FIREBASE.md
```

- **Next.js 16 berbeda dari data latih.** Baca `frontend/node_modules/next/dist/docs/`
  sebelum memakai API yang tidak yakin (mis. `proxy.ts` menggantikan `middleware.ts`).
- Firebase project: `synap-ed`. Dev lokal memakai **database asli**.
- Tidak ada backend terpisah: Server Component & Server Action memakai Admin
  SDK (`lib/firebase/admin.ts`). SDK klien hanya untuk Auth dan unggah Storage.
- Sistem desain "Tinta & Kertas" (`app/globals.css`): satu keluarga font —
  Plus Jakarta Sans (`--font-sans`, dimuat di `layout.tsx`) — untuk judul
  maupun isi (dulu Fraunces untuk judul + Inter untuk isi; diganti karena
  Jakarta Sans tidak punya axis variabel SOFT/WONK/opsz, jadi
  `font-variation-settings` yang dulu dipakai sudah dihapus). `--color-navy`
  & `--color-blue-700` SENGAJA disamakan nilainya dengan `.bg-hero-navy`
  (`#0445D1`, biru hero) — dulu dua biru gelap berbeda, sekarang satu biru
  terang di seluruh situs (footer, panel gelap `AuthForm`, teks aksen).
  Token `ink-*`, `paper-*`, `rule`, `blue-*`, `amber-*`, `rust-*`; kelas `t-h1..t-h3`,
  `t-body`, `t-label`, `t-numeral`, `container-page`, `container-reading`, `mark`.
  `amber-500` hanya untuk grafis (kontras gagal untuk teks); teks pakai `amber-700`.

## Perintah

```bash
npm run dev                        # akar → frontend dev server :3000
npm run typecheck                  # tsc untuk scripts/ (tsx tidak memeriksa tipe)
cd frontend && npx tsc --noEmit    # tsc aplikasi
cd frontend && npm run lint
cd frontend && npm run build       # kadang gagal fetch Google Fonts (jaringan) → ulangi
npx tsx scripts/verify-<nama>.ts   # butuh dev server untuk yang memanggil HTTP
```

## Autentikasi & otorisasi

- Login di klien → `POST /api/auth/session` menukar ID token jadi cookie
  httpOnly `synaped_session`. Rute ini juga memanggil `ensureUsername` (gagal = log saja).
- `/login` & `/register` keduanya merender `AuthForm` (satu komponen), yang
  menyimpan mode aktif di state lokal (bukan sekadar lewat props) supaya
  tombol "Masuk"/"Daftar" bisa berpindah dengan geser + memudar (`.auth-fade`,
  arah dari `--auth-fade-from`) tanpa menunggu navigasi Next. Di layar md:+
  kartunya terbelah DIAM (sisi navy kiri, sisi formulir kanan — tidak ada
  PANEL yang meluncur/bertukar posisi, itu sempat dicoba lalu dibatalkan
  karena terlihat seperti komponen "slider/toggle"); yang bergerak hanya
  ISI tiap sisi. URL disinkronkan lewat `window.history.replaceState`
  langsung, **bukan** `router.replace` — `router.replace` membuat Next
  mengambil ulang RSC
  halaman tujuan dan me-remount `AuthForm`, yang mengulang animasi masuk
  kartu (`.rise-in`) di tengah transisi dan terlihat patah (sudah pernah
  terjadi, lihat riwayat git pada berkas ini).
- `lib/firebase/session.ts`: `getCurrentUser`, `requireUser/Admin/Educator` (redirect `?next=`).
- **Role = custom claim** (`user` | `educator` | `admin`), bukan field DB.
  Berubah role → cookie harus diterbitkan ulang (masuk lagi).
- `requireOwnedCourse(user, slug)`: pemilik kursus atau admin.

### Invarian keamanan (jangan dilanggar)

1. **Setiap export berkas `"use server"` adalah endpoint publik** (bisa di-POST
   langsung). Setiap action memeriksa sesi & peran sendiri, dan **uid selalu dari
   sesi, tidak pernah dari argumen**.
2. Fungsi penulis tanpa penjaga (`writeEnrollment`, `realiseSale`, `claimUsername`,
   `createReferralCodeFor`, …) **tidak boleh** berada di berkas `"use server"`.
   Taruh di modul `server-only` atau modul inti yang disuntik `db`.
3. **Angka dari browser tidak dipercaya:** harga dibaca dari kursus, jatah
   pemilik kontributor dihitung ulang server, persentase admin divalidasi server.
4. **Modul netral** (tanpa `server-only`, tanpa `"use client"`, tanpa impor `@/`)
   untuk nilai/validasi yang dipakai klien + server + skrip tsx: `*Rules.ts`,
   `*Types.ts`, `contributors.ts`, `royaltySplit.ts`, `royaltyTerms.ts`,
   `referralRules.ts`, `classTypes.ts`, `classAssignmentRules.ts`, `profileTypes.ts`, dan seluruh `lib/lab/*`. Mengimpor modul
   `server-only` dari komponen klien menyeret firebase-admin ke bundel browser.
5. **Semua koleksi Firestore tertutup dari klien** (`allow read, write: if false`),
   kecuali `courses/{slug}` baca publik dan `users/{uid}` baca oleh pemiliknya.
   Klien tidak menulis Firestore sama sekali.

## Konvensi Firestore

- **Hindari indeks komposit:** kueri satu field (equality/array-contains/range)
  lalu saring & urutkan di memori. Tidak ada indeks yang di-deploy.
- Kueri equality/`orderBy` **mengabaikan dokumen yang tidak punya field** itu
  (pernah menghilangkan kursus dari katalog). Jangan menyaring field yang bisa hilang.
- **Normaliser saat membaca** dengan nilai bawaan, bukan `as Tipe`
  (`toOrder`, `toRequest`, `getCourse`, `cleanProfile`, …). Data lama tidak punya field baru.
- **ID deterministik untuk idempotensi:** `enrollments/{uid}_{slug}`,
  `royaltySales/{orderId}`, `royaltyEarnings/{orderId}_{uid}` & `{orderId}_referral`,
  `usernames/{username}`, `referralCodes/{KODE}`, `classMembers/{uid}_{classId}`.
- Transaksi: semua `get` sebelum `write`. `create()` gagal dengan gRPC code `6`
  (ALREADY_EXISTS) → tangkap dan perlakukan sebagai "sudah ada".
- Rules `hasOnly` pada merge memeriksa **dokumen hasil akhir** (penyebab bug nomor HP lama).
- Waktu disimpan sebagai string ISO.

## Model data (koleksi)

| Koleksi | Isi & catatan |
|---|---|
| `courses/{slug}` | Kursus; `sections[].lessons[]` **ditanam** di dokumen. `visibility` (`public`/`private`; hilang = public), `ownerUid` (null untuk kursus migrasi), `price`, `passingGrade` (bawaan 70), `order` (wajib ada), `contributors[{uid,share}]` + `contributorUids[]`. Jenis pelajaran: `reading`, `video`, `assignment`, `quiz`; pelajaran `assignment` boleh punya `instructions` (rubrik teks bebas, tampil ke peserta & dipakai penilaian AI). |
| `courses/{slug}/quizzes/{lessonSlug}` | Soal + `correctOptionId`. Tidak boleh bocor ke klien: pakai `toPublicQuiz()`. |
| `courseChangeRequests/{id}` | Pengajuan `publish`/`unpublish`/`edit`/`delete`; `before`/`after` snapshot. Satu pending per kursus. Hanya `decideCourseRequest` yang menerapkan. |
| `enrollments/{uid}_{slug}` (+ `quizAttempts`) | Akses & progres. `source`: free/paid/granted. |
| `submissions/{id}` | Jawaban penugasan + nilai educator. Berkas di Storage `submissions/{uid}/` (PDF atau gambar). AI cuma menyarankan (`gradingActions.ts`); nilai final selalu tulisan tangan educator lewat `gradeSubmission`. |
| `certificates/{id}` | ID acak `SYN-…`; terbit saat semua pelajaran selesai & nilai ≥ passingGrade. |
| `reviews/{id}` | Hanya pemilik enrollment `completed`. |
| `educatorApplications/{uid}` | Pengajuan jadi educator. |
| `categories/{slug}` | Dikelola admin; slug tidak berubah saat label diganti. |
| `classes/{id}` (+ `posts/{id}/replies/{id}`), `classMembers/{uid}_{classId}` | Kelas educator; `joinCode` rahasia (jangan dikirim ke anggota biasa). Post: `kind` (`announcement`/`assignment`; hilang = announcement), `title`, `body`, `attachments[{name,path,size,mime}]`, `assignment {formats, dueAt, acceptLate, maxPoints}` (null untuk pengumuman). |
| `classSubmissions/{classId}_{postId}_{uid}` | Pengumpulan tugas kelas: `text`, `files[]`, `status` submitted/graded, `late` (dibekukan saat kirim), `grade`, `feedback`. Koleksi TERPISAH dari `classes` — `recursiveDelete` tidak menjangkaunya. |
| `users/{uid}` | `bio`, `education`, `skills`, `phone`, `username`, `usernameChangedAt`, `referralCode`. Nama & foto hidup di Firebase Auth, bukan di sini. |
| `usernames/{username}` | Reservasi `{uid}`. |
| `orders/{orderId}` | Pesanan. `method` midtrans/manual, `status`, `royalty` (syarat dibekukan), `postPaidStatus`. |
| `settings/payments` | Saklar metode, QRIS, `platformFeePercent` (bawaan 30), `referralPercent` (bawaan 10). |
| `royaltySales/{orderId}`, `royaltyEarnings/{…}` | Buku royalti. Tanpa data pembeli. |
| `referralCodes/{KODE}` | Pemilik kode `{uid}`. |

Storage: `avatars/{uid}`, `course-assets/{uid}` (PDF, dilayani lewat
`/api/courses/[slug]/asset`), `course-thumbnails/{uid}` (publik), `payment-qris`
(publik), `payment-proofs/{uid}` (lewat `/api/payments/proof`, admin),
`submissions/{uid}` (lewat `/api/submissions/file`), `class-files/{uid}/{classId}/`
(lampiran pengajar, lewat `/api/classes/attachment`), `class-submissions/{uid}/{classId}/{postId}/`
(jawaban siswa, lewat `/api/classes/submission`). Materi terkunci selalu
dialirkan server, tidak pernah signed URL (ADC lokal tidak bisa menandatangani).

## Pembayaran

- **Midtrans** (`lib/paymentActions.ts` → Snap token; `api/payments/midtrans/notification`):
  - verifikasi tanda tangan → `payment_notif_test*` dijawab 200 tanpa efek → pesanan
    tak dikenal 404 → nominal harus sama → `normalizeStatus`.
  - `applyNotification` (transaksi di `lib/orders.ts`): **status `paid` tidak pernah turun**;
    kabar gagal setelah lunas dicatat di `postPaidStatus`.
  - Urutan saat lunas: `writeEnrollment` → `realiseOrderSale` (gagal → 500 agar
    Midtrans mengulang) → `applyNotification`.
  - Pesanan pending (30 menit) dipakai ulang **hanya** bila harga DAN kode referral sama;
    kalau berbeda, dihanguskan (juga di Midtrans).
- **QRIS manual** (`lib/manualPaymentActions.ts`): pesanan 24 jam → bukti diunggah →
  `awaiting_review` → `decideManualOrder` (admin): enrollment → catat penjualan → `paid`.

## Royalti, kontributor, referral

- `contributors.ts` → `buildContributors(ownerUid, others)`: pemilik pertama,
  share = 100 − Σ lainnya, minimal `OWNER_MIN_SHARE` 10, maks 10 orang, bilangan bulat.
  Editor hanya mengirim **selain pemilik**. `resolveContributors` (server) juga memastikan
  akun ada lewat `adminAuth().getUsers` (bukan `getUserCards`, yang menelan galat).
- Jalur tulis kontributor: `createCourse`, `requestCourseEdit` → `decideCourseRequest`
  (validasi ulang), `updateCourseMeta` (admin). Pengajuan lama tanpa
  `after.contributors` = **biarkan** (jangan `?? []`, itu menghapus pembagian).
- **Syarat dibekukan saat pesanan dibuat** (`royaltyTerms.ts`, `termsForNewOrder`):
  `{feePercent, ownerUid, contributors, referral: {uid,code,percent}|null, capturedAt}`.
  Perubahan pembagian/setelan hanya berlaku untuk pesanan baru.
- `royaltySplit.ts`: `splitSale(gross, feePercent, contributors)` — potongan dibulatkan ke
  bawah, sisa dibagi **largest remainder** (seri → pemilik), invarian Σ = gross.
  `referralAmountOf(gross, feeAmount, percent)` = floor(gross×%/100), **diambil dari
  potongan platform**, dilempar bila melebihi potongan.
- `royaltyLedgerCore.ts` (`db` disuntik): `planSale` murni + `realiseSale` transaksi
  get-then-create → tepat sekali. `termsOrigin`: `order` / `legacy` (pesanan tanpa syarat →
  100% pemilik, potongan 0) / `invalid` (seluruhnya `unallocatedAmount`).
  Buku royalti **tidak pernah membaca status pesanan** dan tidak menyimpan identitas pembeli.
  DTO dashboard (`royaltyDashboard.ts`) tidak boleh memuat `orderId` (berisi potongan uid pembeli).
- **Referral** (`referralRules.ts`, `referralCore.ts`, `referrals.ts`, `referralActions.ts`):
  - kode 4–20 huruf/angka, huruf besar, satu per akun, **permanen**, ada daftar terlarang;
  - `proxy.ts` menyimpan `?ref=` ke cookie `synaped_ref` (30 hari; hanya cek bentuk);
  - `resolveReferral` menolak kode tak ada, pemilik mati, dan **kode sendiri**;
  - admin menyimpan potongan & referral **sebagai pasangan** (`updateRevenueSettings`,
    `validateRevenueSplit`: referral ≤ potongan); nilai rusak di DB → keduanya ke bawaan.
- **Username** (`usernameRules.ts`, `usernameCore.ts`, `usernames.ts`, `usernameActions.ts`):
  `^[a-z0-9._]{3,30}$` + ≥1 huruf, dibuat dari email, ganti sekali/14 hari (transaksi),
  `searchUsernames` hanya educator/admin, 30/menit, maks 8 hasil, tanpa email.
  Reservasi akun terhapus sengaja dibiarkan (mencegah penyamaran).

## Asisten AI (chat & penilaian tugas)

- Klien OpenRouter (`lib/openrouter.ts`): `fetch()` polos, **bukan** `@openrouter/sdk`
  (SDK resmi provider sebelumnya, `@google/genai`, pernah gagal di metode yang
  direkomendasikan dokumentasinya sendiri — lihat komentar di berkas itu).
  `openRouterStream(messages, opts?)` dipakai bersama oleh chat FAQ/tutor DAN
  penilaian AI; `opts.models`/`opts.maxTokens` opsional (bawaan `CHAT_MODELS`/1500).
- **Setiap model yang ditambah ke `CHAT_MODELS`/`VISION_MODELS` WAJIB diverifikasi
  langsung dulu** (panggilan API nyata, bukan percaya dokumentasi): sejumlah model
  gratis diam-diam menghabiskan seluruh `max_tokens` untuk "bernalar" sebelum
  menjawab kalau `reasoning: {enabled:false}` tidak dikirim — `content` balasannya
  jadi kosong (`finish_reason: "length"`). Ini juga berlaku untuk model **vision**
  (diverifikasi 16 Sept 2026 pada `inclusionai/ling-3.0-flash-vl:free`, dkk).
  Model lain bahkan menolak permintaan sama sekali kalau reasoning dimatikan
  (`openai/gpt-oss-20b:free` → "Reasoning is mandatory").
- Model `:free` dilayani dari **kolam bersama** seluruh pengguna OpenRouter — 429
  `upstream_provider_shared_pool` itu antrean sesaat (retry), BUKAN jatah kita habis
  (jangan retry, tunggu besok). `readRateLimit()` membedakan keduanya.
- **Tutor dalam course**: `ChatWidget.tsx` dipasang sekali secara global di
  `layout.tsx`, tanpa props. Konteks "sedang di pelajaran mana" mengalir lewat
  `ChatContext.tsx` (satu-satunya React Context di proyek ini) yang dipublikasikan
  `LearnShell.tsx` — **hanya slug**, bukan konten. `/api/chat` mengambil &
  mengotorisasi ulang isi sesungguhnya lewat `chatLessonContext.ts` (`getCourseAccess`)
  dari sesi asli; konteks yang tidak valid/tidak berhak diam-diam jatuh ke mode FAQ,
  tidak pernah jadi galat 400.
- **Penilaian AI** (`gradingActions.ts`, tombol "Minta Saran AI" di `GradeForm.tsx`):
  hanya **saran**, tidak pernah memanggil `gradeSubmission` sendiri — educator wajib
  menyimpan manual. Mendukung dua jenis berkas pengumpulan: PDF (ekstrak teks via
  `pdfText.ts`, pakai `pdfjs-dist` yang sudah ada — BUKAN `pdf-parse`, paket itu
  pernah dilaporkan luas menyebabkan galat ENOENT saat di-bundle Next.js production)
  dan gambar JPEG/PNG/WebP/GIF (dikirim langsung sebagai `image_url` base64 ke
  `VISION_MODELS`). PDF hasil **pindai/scan** (bukan ketikan) tetap gagal — ekstraksi
  tesknya kosong, dan itu bukan gambar biasa jadi tidak lewat jalur vision juga.
- Format balasan penilaian sengaja `GRADE: <n>` / `FEEDBACK: <teks>` — dua baris
  polos, bukan JSON — karena model gratis OpenRouter terbukti tidak selalu patuh
  ke instruksi format kompleks. `parseGradingResponse` mengambil kecocokan
  **terakhir**, jaga-jaga model menulis contoh/mikir keras dulu sebelum jawaban asli.

## Tugas kelas

Pengumuman berlampiran + tugas ala Google Classroom di dalam fitur Kelas.

- Berkas: `classAssignmentRules.ts` (NETRAL — format, MIME, batas, validasi,
  status, WIB), `classAssignments.ts` (server-only, tanpa penjaga: data,
  `periksaBerkas`, `bersihkanPost/Kelas`), `classAssignmentActions.ts`
  (`"use server"`: `updateAssignment`, `gradeClassSubmission`,
  `submitClassAssignment`, `unsubmitClassAssignment`), `createPost`/`createAssignment`
  di `classActions.ts`, unggah klien di `classUpload.ts`, penyaji `serveStorageFile.ts`.
- Format (`text`/`pdfImage`/`office`/`zip`) dipilih per tugas. **MIME diambil dari
  ekstensi** (`mimeOfName`), bukan `file.type` (Windows: ZIP = `x-zip-compressed`).
  Daftar MIME sama persis dengan `isClassFile()` di storage.rules; batas 20 MB eksklusif.
- **`periksaBerkas` tidak mempercayai browser**: path wajib berawalan folder milik
  pengirim (`class-files/{uid}/{classId}/` atau `class-submissions/{uid}/{classId}/{postId}/`,
  tanpa `..`/`//`), lalu ukuran & MIME dibaca ULANG dari metadata Storage. Hanya nama tampilan
  yang diambil dari klien.
- Unggahan terjadi saat formulir DIKIRIM (bukan saat berkas dipilih) supaya
  berkas yang dibuang tidak meninggalkan sampah.
- Tenggat diukur jam SERVER. `masihDibuka` = belum lewat ATAU `acceptLate`.
  Satu kiriman per siswa per tugas; mengganti = batalkan dulu. Batal ditolak
  setelah dinilai dan setelah pengumpulan ditutup. Batal menghapus dokumen DULU,
  baru berkas. Menilai pakai transaksi (siswa bisa membatalkan bersamaan).
  `updateAssignment` hanya mengubah `dueAt`/`acceptLate` — format & nilai maksimal terkunci.
- **WIB tetap** (`inputWibKeIso`, `isoKeInputWib`, `formatWib`): server App Hosting
  UTC. Komponen klien menerima waktu yang SUDAH diformat server (`waktuKirim`) —
  Intl Node vs browser bisa berbeda tanda baca → hydration mismatch.
- Halaman: `/kelas/[id]?tab=tugas`, `/kelas/[id]/tugas/[postId]` (siswa; pemilik/admin
  dialihkan), `/educator/classes/[id]/tugas/[postId]` (daftar siswa + nilai). Halaman
  siswa hanya membaca kiriman miliknya lewat ID deterministik. `jamServer()` dipanggil
  sekali per render (lint purity melarang `Date.now()` langsung di komponen).
- Hapus post/kelas memanggil `bersihkanPost`/`bersihkanKelas`: dokumen
  `classSubmissions` + berkasnya + lampiran. `MANAGED_PREFIXES` di `storageCleanup.ts`
  memuat kedua folder kelas (tanpa itu `deleteObjects` diam-diam tidak menghapus apa-apa).
- Penyaji berkas: lampiran → anggota/pemilik (bukan anggota = 404); jawaban →
  pengirim atau `requireOwnedClass` (siswa lain = 403). Keduanya memeriksa ulang
  awalan path dan selalu `attachment` + `nosniff`.

## SynapLab (`/lab`)

Papan sandbox untuk memvisualisasikan materi. **Tanpa Firestore, tanpa Server
Action, tanpa login** — seluruh keadaan hidup di memori browser dan di URL.
Dua materi: **Array** — empat lab, **1D** (`array1d`), **2D** (`array2d`),
**3D** (`array3d`), **N-D** (`arrayNd`) — dan **Linked List** (`linkedList`,
singly). Navigasi materi = `LabNavigasi.tsx`: laci setinggi layar di kiri yang
MENIMPA halaman (fixed + latar gelap, `inert` saat tertutup, fokus dikurung,
gulir `body` dikunci, `Esc` ditangkap di fase capture supaya tidak ikut menutup
mode presentasi). Komponennya generik — hanya menerima `BagianNavigasi[]`
(teks) dan `onPilih(id)` — dan dirender SEKALI oleh `LabShell` di luar ruang
kerja mana pun, jadi tidak bergantung pada halaman materi yang sedang dibuka
(materi baru boleh punya halaman yang sama sekali berbeda). Tombolnya: di lg
kolom sempit di kiri judul — `LabShell` membungkus `[LabNavigasi | ruang kerja]`
dalam `lg:flex`, jadi tombol sejajar judul dan tidak ikut tergulir; di layar
sempit pil mengambang di tengah bawah. Materi/lab baru = satu entri di `NAVIGASI` + `MATERI` + cabang
ruang kerjanya. Untuk Array, pengalih dimensi tetap ada di kepala halaman.

- **Logika murni di `lib/lab/`** (semuanya netral; `scripts/verify-lab.ts`
  mengimpornya lewat path relatif):
  - Lintas-lab: `labTypes.ts` (batas, tipe, `LabId`), `labForm.ts` (bentuk isian
    form + `OpSpecOf`), `labHistory.ts`, `labRandom.ts`.
  - Per lab, pola sama: reducer `apply*Op(state, op) → {ok, steps} | {ok:false, error}`
    + `settle*` + `assert*Invariants`, dan katalog `Record<Op["kind"], Spec>`
    (operasi tanpa entri = galat tipe). 1D: `arrayLab.ts`/`arrayLabCatalog.ts`;
    2D: `matrixLab.ts`/`matrixLabCatalog.ts`; 3D: `cubeLab.ts`/`cubeLabCatalog.ts`;
    N-D: `ndLab.ts`/`ndLabCatalog.ts`.
  - URL: `labUrl.ts` (dispatcher `encodeLabSnapshot`/`decodeLabSnapshot`),
    `labUrlMatrix.ts`, `labUrlCube.ts`, `labUrlNd.ts`, `labUrlBagian.ts` (penolong
    urai bersama).
- **UI**: `LabShell.tsx` = laci materi (`LabNavigasi`), pengalih dimensi, dan kepala halaman. Tiap lab adalah
  sebuah `LabKit` (`labKit.ts` kontraknya, `labKits.tsx` kelimanya: reducer,
  katalog, kanvas, encode, navigasi panah, isian "pakai sel" + `isianSel` = nama
  isian yang boleh diisi dari sel dan karenanya TIDAK diisi contoh di awal). `LabWorkspace.tsx`
  generik (bilah alat, langkah, riwayat, presentasi, bagikan, pintasan) dan
  `LabControls.tsx` generik (form dari katalog). Kanvas: `ArrayBoard`,
  `MatrixBoard`, `CubeBoard`, `NdBoard`. Hook: `lib/useLabSession.ts` (reducer + riwayat),
  `lib/useLabPlayer.ts`, `lib/useFlip.ts`. Lab baru = reducer + katalog + kanvas +
  satu kit + satu huruf URL; ruang kerja tidak disentuh.
- Ruang kerja lab yang tidak aktif **tetap terpasang** (`hidden`) setelah pertama
  dibuka, supaya papan & riwayatnya bertahan saat berpindah dimensi; hanya yang
  `aktif` mendengar keyboard. Satu cabang JSX per lab di `LabShell` (bukan peta kit
  heterogen) supaya tipe keadaan tiap lab tidak hilang.
- Halaman `app/lab/page.tsx` mendekode `?s=` **di server** supaya papan hasil
  berbagi sudah benar pada cat pertama, lalu membuka lab yang sesuai.
- Reducer tidak pernah melempar untuk masukan pengguna, dan saat ditolak keadaan
  tidak berubah sama sekali. `settle*` di akhir tiap langkah:
  - 1D: penunjuk di-clamp ke `0..items.length` (nilai `items.length` adalah slot
    "lepas" yang sengaja digambar), sorotan yang tidak utuh DIBUANG, bukan dipotong.
  - 2D: penunjuk di-clamp ke dalam kisi dan dibuang kalau kisi kosong; sorotan
    (persegi panjang inklusif) yang keluar batas dibuang utuh.
  - 3D: penunjuk dijepit ke dalam kubus dan dibuang kalau kosong; kotak sorotan
    yang keluar batas dibuang utuh.
  - N-D: kursor yang tidak cocok bentuk dilepas, irisan di luar bentuk dibuang.
- `slice` dan `sorotRentang` (1D) **inklusif** di kedua ujung — berbeda dari
  `Array.prototype.slice`, disengaja karena begitulah rentang dibaca di layar.
- **Batas 2D baris = kolom (8)**: transpose & putar 90° menukar keduanya; batas
  berbeda pernah membuat kisi 2×10 yang sah jadi 10×2 yang tidak sah (tertangkap
  uji acak). Jangan dibuat berbeda lagi.
- **3D**: `CUBE_MAX_SIDE` 5 untuk KETIGA sumbu (alasan sama dengan 2D). Bentuk
  `[D,R,C]`, `[0,0,0]` = kosong; sel datar row-major seperti N-D. Setiap
  transformasi ditulis sebagai satu **pemetaan koordinat** (`petakan`) yang
  memindahkan sel, penunjuk, dan kotak sorotan sekaligus — transformasi baru
  cukup memberi bentuk baru + peta. Sorotan 1 lapisan/baris/kolom/pilar semuanya
  disimpan sebagai kotak `{from,to}` inklusif. `verify-lab` memeriksa tukar
  sumbu 3D menghasilkan susunan yang sama dengan lab N-D.
- **N-D**: `ND_MAX_DIMS` 6, tiap dimensi 1–6, total ≤ 120 elemen. Sel disimpan
  datar row-major; `ndStrides`/`ndOffset`/`ndKoordinat` diekspor untuk kanvas.
  Reshape mempertahankan urutan memori dan membawa kursor lewat **offset**-nya;
  tukar sumbu menyusun ulang memori dan membawa kursor & irisan lewat **sumbunya**.
  Indeks/bentuk diketik sebagai teks (`"1, 2, 0"`) lalu diurai reducer.
- Transformasi 2D & 3D memindahkan **sel** (id, catatan) beserta penunjuk & sorotannya;
  `verify-lab` memeriksa "yang ditandai" tetap sel yang sama.
- **Skema URL** `?s=1<huruf>~ruas~ruas~ruas~ruas` (selalu 5 ruas), huruf `a`=1D,
  `m`=2D, `c`=3D, `n`=N-D, `l`=linked list. Linked list: nilai dari head ~ tiga ruas
  cadangan yang WAJIB kosong (alamat dihitung ulang dari id). 1D: nilai~penunjuk~rentang~catatan. 2D: baris dipisah `;`,
  nilai `,` ~ `nama:r:c:nada` ~ `r1:c1:r2:c2:nada` ~ `r:c:teks`. 3D: bentuk `DxRxC` (kosong = kubus kosong) ~ nilai row-major ~
  `nama:k:i:j:nada` ~ `k1:i1:j1:k2:i2:j2:nada`. N-D: bentuk dipisah
  `x` ~ nilai row-major ~ kursor dipisah `x` (kosong = tanpa) ~ `sumbu:posisi:nada`.
  Dekode **semua-atau-tidak**: masukan rusak → `null` → lab 1D kosong +
  pemberitahuan. `LAB_VALUE_RE` melarang `,` `:` `~` `;` (pemisah) dan `+`
  (didekode `URLSearchParams` jadi spasi). Batas 1200 karakter; papan terberat
  1D 626, 2D 780, 3D 1033, N-D 908 (diukur `verify-lab`). Tautan 1D lama (`1a~…`) tetap terbuka.
- **Tata letak (lg ke atas)**: ruang kerja setinggi layar — `main` dikunci
  `lg:h-dvh lg:overflow-hidden lg:pt-[100px]` (navbar melayang setinggi 84px), grid
  dua kolom dengan `lg:grid-rows-[minmax(0,1fr)]` (tanpa itu baris grid ikut
  memanjang dan panel tidak pernah menggulir), dan kedua panel `.lab-pane`
  menggulir sendiri dengan `overscroll-behavior: contain`. Footer dibungkus
  `lg:hidden`. Di bawah lg semuanya kembali ke aliran halaman biasa.
- **Pengurutan** (`labSort.ts`, netral): lima algoritma (`bubbleSort`,
  `selectionSort`, `insertionSort`, `mergeSort`, `quickSort`) ditulis SEKALI di atas
  deret slot abstrak (`rekamUrut` → permutasi `isi` per langkah + peran + label
  per slot + flag `gerak`), lalu `langkahUrut` menerjemahkannya ke langkah lab
  untuk satu deret atau lebih. Tiap lab hanya menentukan deretnya: 1D satu deret;
  2D `cakupan` baris/kolom/semua; 3D baris/kolom/pilar/semua; N-D `sumbu` (garis
  sepanjang satu sumbu) atau `null` = seluruhnya. "Semua" = urutan memori
  (row-major), jadi sel bisa pindah baris/lapisan.
  - `bandingkanNilai`: dua angka sebagai angka, angka sebelum teks, teks menurut
    abjad (tanpa beda huruf besar-kecil, kode karakter penentu seri).
  - Invarian yang diuji: hasil = pengurutan stabil bawaan (dua arah); setiap
    langkah permutasi; **hanya langkah `gerak` yang memindahkan sel**; bubble,
    insertion, merge stabil (merge menyisipkan dengan rotasi supaya keadaan tetap
    permutasi); deret yang selesai berperan `terurut`, yang belum `luar`.
  - Batas `LAB_MAX_STEPS_URUT` 1000, dihitung SETELAH merekam (bubble pada data
    urut hanya satu putaran); kelebihan → ditolak dengan saran merge/quick sort.
    Operasi biasa tetap dipangkas di `MAX_STEPS` lab masing-masing — pengurutan
    tidak lewat `berhasil()` supaya tidak dipangkas.
  - `LabStep.peran` (id → `banding`/`kunci`/`pivot`/`sementara`/`terurut`/`luar`)
    mengalahkan warna asal & sorotan; `LabStep.labelSel` (id → "j", "min",
    "pivot", …). Di 1D label digambar di lajur sendiri di atas penunjuk dan
    meluncur seperti penunjuk (`.lab-pointer`); di papan lain sebagai chip di atas
    sel (`LabelSel`). Legenda peran ada di `LangkahSekarang`.
  - Sorotan pengguna disembunyikan selama animasi (bentrok warna) dan kembali di
    langkah terakhir; penunjuk tetap di indeksnya; catatan ikut selnya.
  - `StepTimeline` hanya merender jendela 60 langkah di sekitar langkah aktif
    (pengurutan bisa ratusan langkah) + tombol lompat ke awal/akhir.
  - Isian `pilihan` (select) di `labForm`/`LabControls`; nilai bawaannya opsi pertama.
- **Linked list** (`listLab.ts`, `listLabCatalog.ts`, `labUrlList.ts`, `ListBoard.tsx`):
  - Keadaan = `nodes[{id,value,next}]` + `head` + `nextId`; urutan larik `nodes` tidak
    bermakna, urutan list = rantai `next` dari head. Maksimal `LIST_MAX_NODES` 8.
    `alamatSimpul(id)` = 1000 + (id×7919 mod 8999): tiruan alamat yang sengaja
    TIDAK berurutan, unik untuk id < 8999.
  - Dua tingkat invarian: `assertListInvariants` (keadaan akhir & URL: semua simpul
    tercapai dari head tepat sekali, tanpa siklus) dan `assertListLangkah` (setiap
    langkah tengah: simpul boleh lepas dari rantai, tetapi **tidak boleh hilang** —
    harus tercapai dari head atau dari variabel penunjuk langkah itu). Inilah yang
    menangkap urutan pointer yang salah (mis. `cur.next = baru` sebelum
    `baru.next = cur.next`). Langkah terakhir tanpa variabel.
  - Tanda khusus di `LabStep`: `variabel` (`{nama, id|null}[]`, chip dikunci NAMA
    sehingga `cur` yang maju meluncur) dan `posisiSimpul` (id → {kolom, baris};
    dipakai saat tata letak bawaan menyesatkan — simpul baru/dihapus di baris 1,
    dan seluruh simpul dikunci di tempat selama list dibalik). Tanpa `posisiSimpul`,
    papan menata rantai dari head (simpul lepas di baris 1).
  - `ListBoard` menggambar dalam piksel tetap lalu `scale()` agar muat (minimum
    0,72 — di bawahnya alamat tak terbaca — selebihnya digulir). Simpul = kartu
    `[data | next]`, head = kotak pointer berlabel "HEAD" (bentuk sama dengan
    bagian next), pointer null = coretan miring di kotaknya, indeks & alamat di
    BAWAH kartu (atas kartu dipakai chip variabel). SVG panah dirender SESUDAH
    simpul (di atasnya); bulatan pointer BUKAN elemen HTML melainkan
    `marker-start` panahnya, jadi bulatan & garis selalu menyatu (juga saat
    meluncur). Pangkalnya = pusat isi kotak next (memperhitungkan tepi 2px), dan
    tombol simpul `flex justify-start` — `<button>` bawaannya memusatkan isi
    tegak dan menggeser kartu ±2px dari posisi hitungan panah;
    panah maju berakhir di tengah sisi kiri simpul tujuan, jadi rantai lurus
    benar-benar lurus (titik awal & akhir sama tinggi). Panah = `<path>` SVG yang bentuknya ditulis lewat
    properti CSS `d` dan ditransisikan (`.lab-panah`) — SELALU satu perintah
    `M … C …` dengan jumlah angka sama supaya bisa dianimasikan; pointer null =
    jalur yang mengerut di titik asal (titik kendali di titik asal juga, supaya
    tidak mengayun). Panah yang menunjuk ke belakang melengkung di bawah rantai
    dan masuk dari bawah simpul (toleransi "sebaris" = setengah tinggi baris).
  - Pilihan papan = INDEKS simpul di rantai (bukan id).
- **Panah keyboard** memilih sel hanya kalau fokus ada di papan (atau di body);
  di tempat lain panah tetap menggulir panel. 2D: ←→↑↓; 3D: ←→ kolom, ↑↓ baris,
  PgUp/PgDn lapisan; N-D: ←→ sumbu terakhir, ↑↓ sumbu sebelumnya.
- **Animasi** (penontonnya siswa awam — kejelasan di atas kecepatan):
  - **Tempo** (`labTypes.ts`): `LAB_STEP_HOLD_MS` 1600, `LAB_MOVE_HOLD_MS` 2600 untuk
    langkah yang menggeser sel, `LAB_VISIT_HOLD_MS` 950 per kunjungan penelusuran.
    Lama sel meluncur = `--lab-gerak` (1000 ms ÷ kecepatan pemutar), diterbitkan
    `LabWorkspace` di pembungkus papan. Ada pemeriksaan `verify-lab` yang mencegah
    tempo dipercepat diam-diam.
  - **Papan sel (1D/2D/3D/N-D) TIDAK memakai FLIP.** Posisi tiap sel dihitung dari
    koordinatnya dan ditulis ke properti CSS `translate` (bukan `transform`, supaya
    tidak bertabrakan dengan `lab-enter`/`lab-pop`); kelas `.lab-posisi` memberi
    transisinya, `.lab-bingkai` untuk bingkai yang berubah ukuran. N-D menghitung
    tata letak kotak bersarang sebagai angka (`tataLetak` di `NdBoard`); tampilan
    Lapisan 3D mengukur lebar papan (ResizeObserver + probe sel) untuk menentukan
    berapa lapisan sebaris.
  - **Urutan DOM sel WAJIB tetap** (`urutStabil`: urut menurut id). Kalau elemen
    dirender menurut posisinya, setiap transformasi membuat React memindahkan node
    DOM, dan peramban memperlakukan node yang dipindah seperti node baru: animasi
    masuk diputar ulang, transisinya tidak jalan — sel "muncul lagi" dan melompat.
    Ini bug yang dilaporkan pemilik (kotak yang seharusnya diam ikut beranimasi);
    sel juga jangan pernah ditaruh di dalam elemen baris/lapisan/kotak yang bisa
    berganti.
  - `useFlip` kini hanya untuk pita memori 3D/N-D. Ia
    mengukur relatif terhadap wadah, dan melupakan posisi saat wadah tidak
    dirender (lab tersembunyi) atau ref-nya `null`.
  - **Tanda di `LabStep`**: `kelompok` (warna asal per id sel, ikut sel saat
    berpindah; legenda di `LangkahSekarang`; palet 8 = `LAB_KELOMPOK_CLASS`) dan
    `jalur` (id sel yang sudah dikunjungi). Langkah terakhir setiap operasi TIDAK
    boleh membawa `kelompok`. `jalur` disalin per langkah (`[...jalur]`) dan
    ujungnya harus sel yang sedang dikunjungi. `JejakPanah` menggambar garis
    berpanah dengan MENGUKUR sel yang tergambar (jadi sama untuk kisi, kotak
    bersarang, dan proyeksi kubus 3D) dan menulis SVG langsung ke DOM di layout
    effect; `NomorKunjungan` memberi nomor urut di pojok sel.
  - **Fokus**: satu sel berdenyut (`lab-glow`), banyak sel cincin diam
    (`kelasFokus`). Akses ditulis bertahap luar → dalam (2D baris lalu sel, 3D
    lapisan → baris → sel, N-D satu sumbu per langkah lewat `langkahPersempit`).
  - **Narasi langkah** ada di `LangkahSekarang`, di atas papan dan menempel
    bersama bilah alat (dulu di bawah papan — tidak terlihat saat kisi/kubus
    tinggi). `StepTimeline` tinggal daftar langkah.
  - **Kubus 3D**: `perspective` → `.lab-kubus-badan` (`preserve-3d`,
    `rotateX/rotateY`) → SEL adalah anak langsung badan dengan `translate` tiga
    sumbu; bingkai lapisan hanya latar 2px di belakangnya (hindari z-fighting).
    Klik sel memakai hit-test peramban (diuji dengan klik mouse sungguhan). Seret
    dianggap seret setelah 5px, lalu klik penutupnya ditelan (`onClickCapture`);
    `touch-action: pan-y`. Ukuran sel = `min(--kubus-maks, 100cqw /
    perkiraan-lebar)` dengan `container-type: inline-size`. `opacity` hanya di
    elemen daun (sel/bingkai), JANGAN di `.lab-kubus-badan` — `opacity` < 1 pada
    elemen `preserve-3d` meratakan seluruh kubus.
  - Animasi sekali-jalan dipicu lewat **kunci yang berganti** (`key={item.value}`
    untuk denyut nilai, `key={p.index}` untuk pantulan penunjuk, `key={grup}` untuk
    kartu operasi), bukan lewat state. `.lab-enter`/`.lab-fade-up` memakai
    `backwards`, BUKAN `forwards`: animasi yang menahan transform akan mengalahkan
    transform FLIP sesudahnya.
  - Penunjuk 1D bergerak lewat variabel `--i` murni-CSS (papan menerbitkan
    `--lab-cell`/`--lab-gap`). Pemutar langkah memakai rAF dan dimulai dari event
    handler (`pemutar.mulai(n)`), bukan dari effect yang mengintai `steps`.
  - Hemat gerak: frame langsung ke langkah terakhir, FLIP tidak menulis transform,
    dan blok `prefers-reduced-motion` di `globals.css` mematikan seluruh animasi
    `.lab-*` dan transisi `.lab-posisi`/`.lab-bingkai` (posisi `translate` tetap
    berlaku — itu tata letak, bukan animasi).
- Tautan "Lab" di navbar bertanda `sempit: true` → `hidden lg:block`. Diukur:
  di 820px, menambahkannya mendorong tombol "Daftar Gratis" keluar layar.

## Pengujian (`scripts/`)

- `testSupport.ts`: `createTestUser(role, tag)`, `actionId(route, exportName)` (dibaca dari
  manifest `.next/dev` — **buka dulu halamannya dengan `probe`** agar rute terkompilasi),
  `callAction(path, id, args, cookie)`, `probe`/`probeText`, `check`, `finish`.
- Suite menyentuh **proyek asli**: selalu bersihkan data uji. Suite yang mengubah
  `settings/payments` harus menyalin & memulihkan dokumennya **persis**
  (`verify-manual-payment` versi lama mereset QRIS ke mati — hati-hati di produksi).
- `verify-rules` menguji rules yang **sedang ter-deploy**, bukan berkas lokal.
- Suite murni tanpa server: `verify-royalty-split`, `verify-lab`. Sisanya butuh `npm run dev`.
- `verify-class-assignment` menulis kelas & berkas uji langsung (Admin SDK) ke bucket asli
  lalu membersihkannya; ia TIDAK menguji storage.rules (unggahan uji melewati rules).
- Puppeteer dengan dua peran: pakai `browser.createBrowserContext()` per peran. Tab dalam
  satu konteks berbagi cookie — memasang cookie siswa diam-diam mengubah tab pengajar jadi
  siswa (halaman pengelola lalu 404 dan tampak seperti bug).
- `check`/`finish` hidup di `scripts/checks.ts`; `testSupport.ts` me-re-export-nya.
  Suite murni WAJIB mengimpor dari `./checks` — `testSupport.ts` memanggil
  `initAdmin()` di level modul, jadi mengimpornya menuntut kredensial Firebase
  untuk menguji logika yang jalannya di browser.
- Skrip data (`backfill-usernames`, `migrate-contributors`, `realise-sales`, …):
  bawaan hanya laporan, `--apply` untuk menulis, idempoten, memakai modul inti yang sama.

## Jebakan yang pernah terjadi

- **`router.replace`/`router.push` me-remount komponen tujuan** kalau halaman
  asal & tujuan sama-sama merender komponen yang sama (mis. `/login` &
  `/register` sama-sama `<AuthForm>`) — Next mengambil ulang RSC lalu
  mengganti elemen, jadi animasi yang hanya jalan saat mount (`.rise-in`,
  `.reveal` tanpa re-trigger) ikut terulang di tengah transisi lain dan
  terlihat patah/berkedip. Kalau cuma perlu URL ikut berubah (kosmetik,
  tanpa butuh re-render dari server), pakai `window.history.replaceState`
  langsung — lihat `AuthForm.tsx`.
- **Python di Windows memakai cp1252**: jalankan `PYTHONUTF8=1 python`, atau "—" di
  komentar menjadi byte rusak dan Turbopack gagal ("Action … tidak ada di manifest").
  Heredoc bash kadang gagal diurai — tulis skrip ke berkas dulu. Berkas repo CRLF.
- Dev server basi/menggantung (semua rute 404 atau 500): matikan proses di port 3000, jalankan ulang.
- `cn()` hanya penggabung string (bukan tailwind-merge); kelas yang bertabrakan tidak tertimpa.
- Grid item bawaannya `min-width: auto` → anak `truncate` meluberkan halaman di HP; beri `min-w-0`.
- Lint `react-hooks/set-state-in-effect` aktif: setState dari event handler, bukan dari efek.
- **`snap.pay` melempar galat** (bukan memanggil `onError`) bila Snap masih menganggap popup
  sebelumnya terbuka ("Invalid state transition from PopupInView"). `BuyButton.openSnap`
  menangkapnya, memanggil `snap.hide()`, lalu mencoba sekali lagi. Jangan panggil `snap.pay`
  tanpa try/catch — dulu tombol beli diam tanpa pesan padahal pesanan sudah dibuat.
- `CountUp` membaca "4,7" sebagai 47; angka desimal dirender statis.
- `.rise-in` animasi `transform` menimpa transform lain di elemen yang sama; bungkus dengan lapisan terpisah.
- **`lib/chatPrompt.ts` masih menyatakan kursus berbayar belum bisa dibeli** — basi, perlu diperbarui.
