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
- Sistem desain "Tinta & Kertas" (`app/globals.css`): Fraunces + Inter, token
  `ink-*`, `paper-*`, `rule`, `blue-*`, `amber-*`, `rust-*`; kelas `t-h1..t-h3`,
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
   `referralRules.ts`, `classTypes.ts`, `profileTypes.ts`. Mengimpor modul
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
| `courses/{slug}` | Kursus; `sections[].lessons[]` **ditanam** di dokumen. `visibility` (`public`/`private`; hilang = public), `ownerUid` (null untuk kursus migrasi), `price`, `passingGrade` (bawaan 70), `order` (wajib ada), `contributors[{uid,share}]` + `contributorUids[]`. Jenis pelajaran: `reading`, `video`, `assignment`, `quiz`. |
| `courses/{slug}/quizzes/{lessonSlug}` | Soal + `correctOptionId`. Tidak boleh bocor ke klien: pakai `toPublicQuiz()`. |
| `courseChangeRequests/{id}` | Pengajuan `publish`/`unpublish`/`edit`/`delete`; `before`/`after` snapshot. Satu pending per kursus. Hanya `decideCourseRequest` yang menerapkan. |
| `enrollments/{uid}_{slug}` (+ `quizAttempts`) | Akses & progres. `source`: free/paid/granted. |
| `submissions/{id}` | Jawaban penugasan + nilai educator. Berkas di Storage `submissions/{uid}/`. |
| `certificates/{id}` | ID acak `SYN-…`; terbit saat semua pelajaran selesai & nilai ≥ passingGrade. |
| `reviews/{id}` | Hanya pemilik enrollment `completed`. |
| `educatorApplications/{uid}` | Pengajuan jadi educator. |
| `categories/{slug}` | Dikelola admin; slug tidak berubah saat label diganti. |
| `classes/{id}` (+ `posts/{id}/replies/{id}`), `classMembers/{uid}_{classId}` | Kelas educator; `joinCode` rahasia (jangan dikirim ke anggota biasa). |
| `users/{uid}` | `bio`, `education`, `skills`, `phone`, `username`, `usernameChangedAt`, `referralCode`. Nama & foto hidup di Firebase Auth, bukan di sini. |
| `usernames/{username}` | Reservasi `{uid}`. |
| `orders/{orderId}` | Pesanan. `method` midtrans/manual, `status`, `royalty` (syarat dibekukan), `postPaidStatus`. |
| `settings/payments` | Saklar metode, QRIS, `platformFeePercent` (bawaan 30), `referralPercent` (bawaan 10). |
| `royaltySales/{orderId}`, `royaltyEarnings/{…}` | Buku royalti. Tanpa data pembeli. |
| `referralCodes/{KODE}` | Pemilik kode `{uid}`. |

Storage: `avatars/{uid}`, `course-assets/{uid}` (PDF, dilayani lewat
`/api/courses/[slug]/asset`), `course-thumbnails/{uid}` (publik), `payment-qris`
(publik), `payment-proofs/{uid}` (lewat `/api/payments/proof`, admin),
`submissions/{uid}` (lewat `/api/submissions/file`). Materi terkunci selalu
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

## Pengujian (`scripts/`)

- `testSupport.ts`: `createTestUser(role, tag)`, `actionId(route, exportName)` (dibaca dari
  manifest `.next/dev` — **buka dulu halamannya dengan `probe`** agar rute terkompilasi),
  `callAction(path, id, args, cookie)`, `probe`/`probeText`, `check`, `finish`.
- Suite menyentuh **proyek asli**: selalu bersihkan data uji. Suite yang mengubah
  `settings/payments` harus menyalin & memulihkan dokumennya **persis**
  (`verify-manual-payment` versi lama mereset QRIS ke mati — hati-hati di produksi).
- `verify-rules` menguji rules yang **sedang ter-deploy**, bukan berkas lokal.
- Suite murni tanpa server: `verify-royalty-split`. Sisanya butuh `npm run dev`.
- Skrip data (`backfill-usernames`, `migrate-contributors`, `realise-sales`, …):
  bawaan hanya laporan, `--apply` untuk menulis, idempoten, memakai modul inti yang sama.

## Jebakan yang pernah terjadi

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
