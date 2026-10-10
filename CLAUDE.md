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

- **Hero beranda** (`sections/Hero.tsx`) berlatar `bg-ivory` (token
  `--color-ivory`), tanpa gambar; judul `text-blue-900` dengan huruf muncul
  "pop" bergiliran (`.letter-pop`, jeda `--letter-delay`; `backwards` bukan
  `forwards` supaya transform seret huruf tidak tertimpa). Karena hero kini
  terang, `Navbar` hanya menganggap `[data-dark-hero]` sebagai latar gelap
  (hero beranda tidak lagi). `sections/SectionDots.tsx` = titik navigasi
  section di tepi kanan (lg:+), memakai `useActiveSection`; daftar id-nya
  harus cocok dengan id section di `app/page.tsx`.

- **Hero scroll** (`Hero.tsx`): section setinggi `230vh` (`overflow-clip`,
  BUKAN `overflow-hidden` — itu mematikan `position: sticky`) dengan isi
  sticky. Progres scroll ditulis ke variabel CSS `--p` langsung di DOM
  (bukan state); `--c` (judul/tombol memudar) dan `--q` (bilah muncul &
  melebar) diturunkan dari `--p` lewat `clamp(calc())`. Tombol oval "Mulai
  Belajar" adalah SATU elemen yang berubah jadi bilah prompt: di dalam isi
  hanya ada slot kosong penahan tempat (`slotRef`), tombolnya diposisikan
  absolut menimpa slot (`--y0` diukur JS) lalu meluncur ke tengah layar
  (`--y1`) sambil melebar (`--w1`) mengikuti `--e` (smoothstep dari `--m`).
  State hanya jumlah huruf terketik + boolean `bar`. Latar kotak-kotak hitam tipis menempel pada section, jadi
  ikut bergeser saat scroll. Tombol "Lihat Kurikulum" sudah dihapus.
- **Halaman masuk/daftar** (`AuthForm.tsx`) berlatar `bg-ivory bg-grid`
  (`.bg-grid` = kotak-kotak hitam tipis yang sama dengan hero); logo versi
  gelap, tautan "Kembali ke beranda" gelap. Kartunya tetap berpanel navy.
- **Tema gelap SELURUH situs** (landing, dashboard, admin, educator, belajar, auth):
  token di `@theme` (`globals.css`) kini palet "malam" — `paper` `#0B1A24`
  (teal-navy), `ink*` putih, `rule` putih transparan. **Nama token `blue-*`
  TETAP, nilainya sekarang biru langit terang** (`#2F6FED` tombol, `#5B9BFF`
  teks aksen/hover, 50/100 = tint transparan untuk latar chip, 900 = peredam
  gelap `#0B1A24`) — sengaja terang agar tidak menyatu dengan latar teal-navy;
  `--color-navy` (footer, `.bg-hero-navy`, pita header /kelas, header ruang
  belajar, panel `AuthForm`, header profil) = **hitam `#050505`**, jadi teks di
  atasnya WAJIB `text-white` (token `paper` kini gelap, `text-paper` di
  permukaan navy tak terbaca). `.mark` (sapuan krem di judul) dimatikan.
  Jangan menulis ulang ratusan `text-blue-700` — ubah nilai token saja.
  "Pulau" yang sengaja terang (keadaan kosong Courses, kartu Features, sertifikat) dibungkus `.theme-day` yang memulihkan
  palet terang. `.theme-night` (pembungkus beranda) tinggal alias. Jangan
  menambah warna gelap hardcode (`text-black`, `border-black`) di luar
  `.theme-day`; kotak QR memang `bg-white`. Navbar selalu bergaya gelap
  (logo putih). Teks terang di atas permukaan gelap ditulis `text-white/NN`,
  bukan `text-blue-100` (token itu kini tint transparan).
- **About** (`sections/About.tsx`): tiga panel akordeon yang memenuhi SELURUH
  section sampai tepi layar — TANPA jarak, garis, sudut membulat, maupun judul
  "ABOUT" (sengaja dihapus; judul melayang sempat dicoba dan menimpa angka).
  Batas antar panel hanya beda tipis warna dasar. Yang dipencet melebar
  (`flex-grow` 3,4), dua lainnya menyempit (1) dan hanya berisi judul tegak
  (tanpa angka/lingkaran); lebar dianimasikan lewat `flex-grow` +
  `flex-basis: 0` (jangan diganti width/height). Panel terbuka memuat angka
  besar samar, judul huruf-demi-huruf, penjelasan kata-demi-kata, lalu peraga
  interaktif: 01 `LearningPath` (minimalis: tiga kata Dasar/Menengah/Mahir di atas
  satu garis tipis, garis biru meluncur ke kata aktif), 02 `Ticker` (papan kata
  berputar), 03 `Sources` (1 Jurnal / 2 Buku ajar / 3 Penelitian, nomor tanpa kurung; penjelasan HANYA muncul saat
  poin ditekan dan keluar dari ujung teks poinnya, tekan lagi untuk menutup; tanpa
  garis penanda/pembatas/centang; judul & penjelasan Plus Jakarta Sans, hanya nomornya `font-mono`; penjelasan tanpa tanda pisah "—").
  `useAutoCycle` selama panel terbuka dan berhenti begitu pengguna menyentuh.
  CSS `.about-*` di `globals.css`: animasi masuk hanya berjalan di bawah
  `.about-panel[data-open="true"]` (memutar ulang tiap panel dibuka; pakai
  `backwards`, bukan `forwards`).
- **Courses** (`sections/Courses.tsx`): kartu kursus & chip kategori (jenis materi)
  berbentuk KOTAK (tanpa radius & TANPA border), minimalis — `bg-paper-card`,
  hover: naik 4px + latar sedikit terang; chip kategori menyatu jadi satu batang
  di tengah section; tombol "Lihat Detail" kotak biru (bukan `Button`,
  yang berradius). Jangan menambah `rounded-*` di sini. Keadaan kosong (glitch)
  masih pulau `.theme-day`.
- **Comments** (`sections/Testimonials.tsx`): kartu & dialog ulasan berbentuk KOTAK,
  tanpa border/radius. Bagian atas = FOTO PROFIL pemberi ulasan (`UserAvatar` lg)
  + nama + bintang; nama kursus ada di atas isi ulasan (huruf kecil kapital biru).
  Foto kursus (`courseImage`) tak dipakai lagi tampilannya (field tetap ada di tipe).
- **Features** (`sections/Features.tsx`): kartu karusel 3D berbentuk KOTAK solid
  `#12293A` (radius 0, tanpa garis/bayangan/kaca/lapisan holo), isi: angka
  besar di atas, judul (tiap kata satu baris) +
  deskripsi di bawah, SEMUA putih penuh (tanpa warna selang-seling), tanpa garis.
  TANPA efek hover. EASTER EGG: memencet ANGKA kartu mengganti warna kartu
  (siklus `EGG_COLORS`) LANGSUNG ke warna berikutnya lewat transisi `background-color` 650ms pada kartunya sendiri (tanpa lapisan perantara). Efek sisik ikan, air naik, dan air menyebar pernah dicoba lalu DIBUANG atas permintaan pemilik (tepinya terbaca "terpotong" / warna antara terang lalu gelap) - jangan dikembalikan tanpa diminta. Jangan beri petunjuk visual. Lapisan holo (foil/rainbow/gloss/grain) sudah dihapus dari JSX.
  DUA TAMPILAN: BAWAAN = BARISAN (`flatTargetRef`/`flatRef` awal 1; menggeser KARTU menggeser barisan dan berhenti di satu kartu); menggeser JUDUL "Features" (handler pointer di pembungkus judul, `touch-action: pan-y`; judulnya SENDIRI tidak bergeser) bila >40px BERGANTIAN barisan ↔ cincin 3D (pegas `flatVelRef` + smootherstep; barisan: `scale` 1,1 di tengah lalu ×0,76 tiap langkah, `blur` min(|d|,2)×1,8px) dan memasang ulang judul (`key`, acak alfabet mulai ulang). Geseran judul TIDAK mengubah kartu yang disorot: rotasi hanya dibulatkan ke kartu terdekat SEKALI saat bentuk mulai berbalik (dulu memajukan satu langkah sehingga 01 jadi 02 saat ganti tampilan). Geseran pendek = bentuk kembali. Barisan memakai 8 SLOT (`SLOTS`: 4 asli + 4 bayangan/`ghost`, fitur berulang; posisi `d` melingkar mod 8, -4 ≤ d < 4) agar tak berlubang; jarak tiap pasangan kartu barisan = `lebar×(skala(k)+skala(k+1))/2 + 28` (kumulatif, interpolasi linear untuk d pecahan) supaya celahnya sama (28px) di mana pun. Cincin hanya memakai 4 kartu asli (bayangan `visibility:hidden` saat `flat` ≈ 0, `aria-hidden`, warna egg dibagi lewat `bases[index]`). SEMUA kartu terlihat menerima penunjuk (`pointer-events:auto`); kartu yang diketuk ditentukan lewat GEOMETRI di `ketuk()` (kotak pembatas `getBoundingClientRect` - sudah memperhitungkan transform 3D - diperluas 28px; bila beberapa kena, z-index tertinggi menang; angka diperluas 14px; ambang ketuk-vs-seret 10px), BUKAN hit-test peramban, karena kartu yang berputar/miring/buram sering meleset. Hemat gerak menonaktifkan gestur judul.
  KETUK kartu (di luar angka) membuka `DetailFitur` HANYA bila kartunya yang DISOROT (`data-sorot` diisi `applyTransforms`; kartu lain diabaikan). Lembar penjelasan TANPA gulir: semua ukuran (judul, jarak, teks, nomor) memakai `clamp()` berbasis tinggi layar (`vh`) supaya seluruh teks muat; ketuk ANGKA tetap ganti warna (easter egg), juga di barisan. Lembar penjelasan bergaya editorial & tak simetris: label+garis, judul bertingkat (menjorok bergantian) yang naik dari balik topeng, kalimat pembuka berpagar garis tegak, poin bernomor besar-tipis (SEMUA angka Plus Jakarta Sans, bukan mono), angka raksasa samar terpotong di pojok yang ikut kursor (`--px/--py`); masuk = tirai clip-path dari garis tengah, tutup = tirai menutup balik 420ms (`data-keluar`). Isi `DETAIL_FITUR` hanya klaim yang benar-benar ada di aplikasi.
- **FAQ** (`sections/FAQ.tsx`): ubin kotak yang memenuhi sisa section sampai tepi
  layar (jarak 4px, tanpa border/radius); desktop 6 kolom — 3 ubin `col-span-2` di
  atas, 2 ubin `col-span-3` di bawah (`spanOf`), jadi tak ada sisa kosong. Ditekan →
  terbalik 3D (`rotateY(180deg)`, depan = nomor + pertanyaan, belakang = jawaban di
  latar biru); tiap ubin independen. Judul "FAQ" baris tersendiri DI ATAS grid (bukan
  melayang) supaya tak menimpa ubin. Maskot `3.png` lama dihapus.
- **Learning Path → Comments**: peralihan KEMBALI biasa (Comments sibling normal,
  tergulung ke atas); peralihan horizontal, "tergencet", dan rasi bintang latar sudah
  dihapus atas permintaan pemilik — jangan dikembalikan tanpa diminta.
  Pita ulasan (`.testimonial-scroller`) bisa digeser: seret mouse (>5px, klik kartu
  ditahan setelah seret) / usap sentuh, tetap jalan pelan sendiri (rAF + scrollLeft),
  berhenti saat hover/seret/dialog; isi digandakan & posisi dibungkus di separuh lebar.
- **Banner profil** (`ProfileBanner.tsx`, `lib/banner.ts`): sampul di atas profil; pemilik
  mengganti lewat tombol "Ganti banner" di /profil. Gambar dikecilkan di browser
  (`compressBanner`: ≤1600px, JPEG, selalu < 2 MB) lalu diunggah ke
  `avatars/{uid}/banner.jpg` — SENGAJA memakai folder avatar agar aturan tulis
  storage.rules yang sudah ter-deploy berlaku (tak perlu deploy rules baru). URL (dengan
  `?v=` pemutus cache) disimpan ke `users/{uid}.bannerURL` lewat `updateMyBanner`, yang
  memeriksa URL = Storage + menunjuk banner milik uid SESI. `pruneAvatarFolder` tidak
  boleh menghapus `banner.jpg` saat sinkron foto profil (hanya saat folder dikosongkan).
  Tanpa banner = hitam polos; foto profil bawaan (`UserAvatar`) juga hitam + inisial putih.
  Banner TIDAK disalin ke dokumen ulasan: `listFeaturedReviews` meng-join-nya dari `users`
  (`getBannerURLs`, satu getAll) sehingga ganti banner langsung tampil di komentar lama.
  Kartu komentar & dialog: banner di atas, foto profil menumpang tepi bawahnya.
- **Navbar**: kapsul kaca pil (`bg-[#0B1A24]/35` → `/85` + bayangan saat scroll), tanpa garis tepi;
  penanda tautan aktif = garis kecil biru di bawah kata (bukan keping berlatar); tombol
  sekunder = pil `bg-white/10`. Seluruh situs gelap, jadi tak ada varian terang.
- **Edit profil** (form di `/profil/edit`): kartu persegi `bg-paper-card` tanpa border, kolom isian
  `bg-white/[0.06]` dengan garis biru di bawah saat fokus, tombol persegi. Kartu komentar: foto profil (60px),
  nama, dan bintang berada DI TENGAH banner (sedikit di atas titik tengah, di atas peredam
  hitam 45%); nama kursus + isi komentar di bawah banner, rata tengah.
- **Banner bawaan** = `#0D2131` (senada kartu komentar `#12293A` tapi lebih tua); peredam hitam hanya dipasang bila ada gambar.
- **/kelas & ruang kelas**: kepala `#081520` (sedikit lebih tua dari latar `#0B1A24`), judul "Kelas saya" putih penuh tanpa garis kuning (`mark-on-dark` tak dipakai lagi di sini), TANPA PNG (`ClassHeroProps` dihapus), kartu/isian persegi tanpa border, font Plus Jakarta Sans (bukan `font-mono`).
- **/dashboard** (pendapatan): tanpa label "Akun Saya"; kartu/tabel persegi tanpa border, statistik dipisah celah 4px.
- **Halaman profil** tanpa border/radius (kartu `bg-paper-card`, hover `#16324A`); `Tag`
  amber/rust kini tint transparan + teks terang (bukan kotak krem/oranye pucat).
- **Katalog /courses**: `CourseCatalog` (client) — bilah cari pil (judul, deskripsi, kategori,
  pengajar) + tombol Filter (jenis kursus + batas rating) yang membuka panel; penyaringan di
  browser terhadap daftar yang sudah dimuat server. Kartu = `CourseCard` (kotak tanpa border,
  gaya sama dengan kartu beranda). Beranda punya tombol "Lihat semua kursus" ke sini.
  `Button` global kini persegi (tanpa `rounded-lg`), varian outline = `bg-white/10`.
  Navbar lebih transparan: `/10` (diam) dan `/50` (scroll).
- **Halaman belajar** (`LearnShell`) & **SynapLab**: gaya sama dengan halaman lain — persegi tanpa
  border, kartu `paper-card`/hover `#16324A`, kepala belajar `#081520`. "Daftar Materi" kini judul
  tegas tanpa garis hias (chapter-mark dihapus). Papan sel lab (`*Board.tsx`) sengaja tak disentuh —
  warna nada sel punya makna. Navbar: kaca TERANG (`bg-white/[0.08]` diam, `/[0.14]` scroll), bukan gelap.
- **Kartu kursus diikuti** di /dashboard = `EnrolledCourseCard` (gaya sama dengan `CourseCard` katalog; hanya
  gambar, pembuat, judul, deskripsi, bar kemajuan; seluruh kartu = tautan lanjut belajar). Gambar/pembuat/deskripsi
  diambil dari `listCourses()` (bukan snapshot enrollment); kursus yang sudah dihapus tetap tampil dari snapshot.
- **Robot asisten** (`ui/ChatRobot.tsx`, dipasang di `ChatWidget`): peluncur chat = kepala robot 64px TANPA
  lingkaran latar; satu-satunya animasi bawaannya mata berkedip (tak ada naik-turun). BAWAAN mode "diam".
  Seret = pindah (localStorage `synaped_chat_pos`, pecahan layar); tahan ±0,55 dtk / klik kanan = menu
  Diam/Bergerak (`synaped_chat_mode`); klik singkat = buka/tutup chat (lewat pointer-up; `onClick` hanya untuk
  papan ketik, `detail === 0`). Mode bergerak = hanyut KONTINU lewat rAF (arah & kecepatan diperhalus, radius jelajah 64px dari titik asal — TIDAK menarik ke tengah layar,
  kadang berhenti, dibelokkan ke tengah dekat tepi, selalu dijepit di layar), BUKAN lompat ke titik tujuan —
  posisi ditulis langsung ke `transform` (tanpa render React per bingkai); gelembung & menu anak dari pembungkus
  yang bergerak itu. Panel chat dihitung dari posisi robot (`anchor`), yang dilaporkan lewat `onPos` hanya saat
  robot mengendap. Hemat gerak memaksa "diam". Gelembung (ajakan & kejutan) = balon bicara: digeser 12px menjauhi tepi robot (`right-3`), sudut yang menghadap robot lancip (`rounded-br-none` dst.) + ekor segitiga `clip-path` (`kelasBalon`/`ekor`, mengikuti sisi robot). KEJUTAN: ketuk robot 3x dalam 1 dtk (`ketukRef`) memunculkan gelembung "Jangan lupa follow instagram @nndulgha_ ya" (tautan ke instagram.com/nndulgha_, hilang sendiri 6 dtk; ketukan ke-3 tidak membuka chat).
- **Tema GELAP (bawaan) / TERANG**: dipilih di profil → "Pengaturan Laman" (`ThemeSwitch`), disimpan di localStorage
  `synaped_theme`, diterapkan sebagai `<html data-theme="light">` oleh skrip di `<head>` (layout.tsx) sebelum cat
  pertama. Tema terang = blok `html[data-theme="light"]` di globals.css yang menimpa token yang sama. KUNCI: ia
  MEMBALIK `--color-white` jadi tinta gelap, sehingga semua `text-white`, `bg-white/NN`, `border-white/NN` ikut
  berbalik dengan opasitas yang sama. Yang harus tetap putih (tombol `bg-blue-*`, footer, `bg-black/*`,
  `.bg-navy/.bg-hero-navy`, `.auth-brand-panel`, dan elemen berkelas `keep-white` seperti banner komentar/QR)
  mendeklarasikan ulang `--color-white:#fff`. ATURAN: jangan menulis hex di kelas Tailwind — pakai token
  (`bg-card-hover`, `bg-header`, `bg-banner`, `bg-chip`, `text-error-text`, `text-warn-text`, `text-paper`),
  dan teks di atas `bg-white` solid = `text-paper`. Logo: `.logo-on-dark`/`.logo-on-light` (dua <Image>).
  Mini ikon "Kursus yang Diikuti" di profil kini memakai gambar kursus (`gambar` dari listCourses()).
- **Kartu kursus** (`CourseCard`, dipakai beranda & /courses; kartu inline di Courses.tsx sudah dihapus):
  tingkat kesulitan = teks polos kanan-bawah gambar (tanpa kotak/garis); angka modul & estimasi besar;
  rating = bintang presisi + nilai + jumlah ulasan. Gambar sampul = `CourseCover` (client): ditekan →
  tergulung KE ATAS seperti pintu garasi (`translateY(-100%)`, 900ms, bersekat tipis; ditekan lagi = turun menutup) menyingkap "DIBUAT OLEH" + USERNAME pembuat (`instructorUsername` dari `getUsernames`, cadangan:
  nama penyedia; kapital; username berkedip cepat 4x lalu biru, mulai setelah pintu terbuka — `.cover-kedip`; latar di baliknya = latar kartu); `z-10` supaya tak tertelan tautan kartu. `untukLevel()` masih ada di courseUi.ts tapi tak dipakai kartu.
- Animasi bagian bawah kartu kursus di landing (info terlipat, berputar/terayun saat hover) pernah dicoba dua kali lalu
  DIHAPUS atas permintaan pemilik - kartu beranda sama dengan kartu /courses; jangan dikembalikan tanpa diminta.
- **Bahasa** (profil → Pengaturan Laman): Indonesia (asli, bawaan) / Inggris. Inggris = widget RESMI Google
  Website Translation (`translate.google.com/translate_a/element.js`, tanpa kunci API) yang dimuat
  `TranslateLoader` HANYA bila `synaped_lang=en` / cookie `googtrans=/id/en`; memilih bahasa memuat ulang
  halaman. Widget membungkus ulang simpul teks sehingga React bisa tersandung — `TranslateLoader` memasang
  tambalan `removeChild`/`insertBefore` saat Inggris aktif. Bilah bawaan widget disembunyikan di globals.css.
  Label bahasa memakai `translate="no"`. Terjemahan mesin: jangan harap menggantikan teks Inggris tulisan tangan.
- **Peran** di profil = teks polos berwarna (bukan `Tag`).
- **Komentar**: nama & foto penulis dibaca HIDUP dari Auth (`withLiveAuthors` di reviews.ts, satu `getUsers`),
  bukan salinan di dokumen ulasan - ganti nama akun langsung tampil di komentar lama; akun terhapus → salinan.
- **Learning Path** (ilustrasi per langkah) dan **Features** (siluet di belakang kartu) pernah dicoba lalu
  DIHAPUS atas permintaan pemilik - jangan dikembalikan tanpa diminta.
- **Dashboard untuk educator/admin** (`/dashboard`): selain kursus/kelas yang DIIKUTI, ada "Kursus yang Dibuat" (`listOwnedCourses` + `CreatedCourses own kelola`) dan "Kelas yang Dibuat" (`listOwnedClasses` + `ClassCard peran="Pengajar"`), plus dua angka ringkasan. `CreatedCourses` = "buku besar" tanpa ikon (nomor tipis-besar, judul, peserta sebagai angka utama, baris selang-seling menjorok, garis biru tumbuh saat hover); HANYA dipakai dashboard; profil memakai `OwnedCourses` (kartu berikon, DIKEMBALIKAN seperti semula atas permintaan pemilik, begitu juga tulisan peran & "Tentang Educator"). `/kelas` & `/educator/classes` memakai kepala yang sama dengan dashboard (judul besar, tanpa pita/ "Panel Educator"/tautan "buka panel educator"). Features: pencampuran cincin↔barisan memakai smoothstep + lerp 0,06, kartu bayangan baru terlihat saat `flat` > 0,55 (dulu tampak bertumpuk setengah transparan saat kembali ke cincin).
- **Admin = educator + fitur admin**: `requireEducator` (session.ts), `createClass`, dan `requireEducator` di courseActions kini meloloskan `admin`; Navbar menampilkan "Kursus Saya"/"Kelas Saya" juga untuk admin. `AdminShell` (client) = `Navbar` + `Footer` beranda + sub-navigasi teks (`NAV`, lencana kotak amber, garis biru tumbuh untuk tautan aktif); halaman & komponen `admin/` diratakan massal (tanpa `rounded-*`/`border border-rule`, kartu = `bg-paper-card`, aksen kiri `shadow-[inset_3px_0_0_…]` untuk kartu peringatan, judul `h1` besar tanpa `.mark`).
- **Foto profil kelas** (`Kelas.imageURL`, null = inisial): dipilih di `ClassForm` (potong persegi 512px via `compressSquare`, unggah `uploadClassImage` → `avatars/{uid}/class-<hex16>.jpg`, folder yang sama dengan foto profil/banner sehingga storage.rules tak perlu dideploy), URL diperiksa `fotoKelasSah` di `createClass`/`updateClass` (path HARUS `avatars/{uid-SESI}/class-<hex>.jpg`; `imageRaw` undefined = tak diubah, null = hapus, foto lama dibuang). `pruneAvatarFolder` TIDAK boleh membuang `class-*.jpg` (selain saat folder dikosongkan). `ClassPlate` kini DIAM (tanpa `drift`/holo/kaca) dan menampilkan foto/inisial; `ClassSpine` memakai foto di pita tebal.
- **Mini-profil dari foto** (`profile/AvatarMini.tsx`, portal ke `<body>` karena leluhur `Reveal` bertransform merusak `fixed`): foto pengajar/peserta/penulis pengumuman & balasan di ruang kelas membuka `MiniProfile`. Gerbang `getMiniProfile` kini: penulis komentar publik ATAU pemanggil yang masuk dan sekelas (`sekelas()`: satu kelas sebagai pemilik/anggota) ATAU pemanggil admin/dirinya sendiri; kueri tunggal-field, tanpa indeks komposit. Hero ruang kelas: tautan kembali bergaris-penunjuk, kartu pengajar = garis tegak + foto 56px + nama (tanpa kotak abu).
- **Balasan admin pada ulasan**: `Review.reply` ({body, at, by}; field dokumen `adminReply/adminReplyAt/adminReplyBy`), ditulis HANYA oleh `replyToReview` (admin; nama dari SESI, maks 600 karakter, teks kosong = hapus). Form di `/admin/reviews` (`ReviewReply`); tampil sebagai kutipan bergaris biru di kartu komentar beranda (`TestimonialItem.reply`, 2 baris) + dialognya, dan di `ReviewList` halaman kursus. Penulis menulis ulang ulasannya = balasan hilang (submitReview menimpa dokumen). `/admin` (akun): `UserList` (client) = pencarian nama/email/HP/peran + chip peran; tanggal diformat di server karena `adminUsers.ts` server-only. `/pengaturan` tanpa label "Akun Saya", `LogoutButton` = batang tanpa border (hover merah), `SignInMethodsCard`/`UsernameForm` diratakan. Tombol "Kelola kursus" di pendapatan = batang `SectionHead` (hover biru + garis memanjang).
- **Pita komentar tanpa batas**: daftar digandakan `SALINAN`=4 kali dan `scrollLeft` dijaga di [1,2] salinan (mulai di salinan kedua; seretan membungkus posisi & menggeser `startLeft`) - dulu 2 salinan mulai dari 0 sehingga seret ke kanan membentur 0. Tombol "Admin" navbar: tanpa ikon perisai, teks biru bold dengan kilau gradien `.admin-kilau` tiap 5 dtk. `LogoutButton`: hover `bg-rust-700` + teks `#fff` (hex karena `text-white` terbalik di tema terang). Tema TERANG: `--color-paper-card` `#E9EFF8` (lebih gelap dari latar `#F5F8FD`), `card-hover` `#DCE7F7`, `paper-alt` `#DFE8F5`; `.theme-day` ikut. Breadcrumb detail kursus = huruf kapital kecil, pemisah garis tipis.
- **Panel chat** (`ChatWidget`): persegi tanpa border/radius; kepala = judul + "Siap membantu" (teks saja, tanpa titik); balasan asisten = teks polos dengan garis aksen biru di kiri (`shadow-[inset_2px_0_0]`), pesan pengguna = kotak biru; saran/opsi = baris/chip persegi; indikator mengetik = tiga titik (`.chat-titik`); kolom isian bergaris bawah + tombol kirim kotak berpanah. Logika kirim/stream TIDAK berubah.
- **Admin mengelola akun** (`lib/adminUserActions.ts`, "use server", tiap fungsi memeriksa sesi admin sendiri): `changeUserRole` (custom claim + `revokeRefreshTokens`; role akun SENDIRI tidak bisa diubah agar admin tak mengunci diri), `setUserPassword` (`updateUser` + cabut sesi; `acak` = sandi 12 karakter dari `crypto.randomBytes` dikembalikan SEKALI), `createAccount` (email+sandi, role pilihan, `ensureUsername`; email dibiarkan belum terverifikasi). KATA SANDI LAMA TIDAK BISA DILIHAT: Firebase hanya menyimpan hash satu arah dan tak ada API untuk membacanya - jangan pernah menjanjikan fitur "lihat password". UI: `UserManage` di `/admin/users/[uid]`, `CreateAccountForm` di `/admin/users/new`, tombol "Buat akun" di `/admin`. `/admin/users/[uid]` TIDAK memuat pengajuan educator (itu khusus `/admin/notifications`). Daftar `<select>` (`select option`) dipatok ke token di globals.css (tanpa itu pilihan putih-di-atas-putih di tema gelap). `components/ui/BackLink.tsx` = tautan "Kembali ke …" bersama (garis tipis + kapital kecil; dipakai admin/educator/dashboard/profil edit). `components/ui/Breadcrumb.tsx` = jejak halaman bersama (kapital kecil, pemisah garis, garis bawah biru); dipakai admin/educator/legal/kontak.
- **Mini-profil di komentar** (`profile/MiniProfile.tsx`, `lib/miniProfileActions.ts`): foto/nama penulis di DIALOG komentar (`Testimonials`) membuka kartu di atasnya, bukan berpindah halaman. Pengguna: banner, foto, kursus DIIKUTI + kemajuan (tiap kursus → `/courses/slug`); educator: itu + kursus DIBUAT (tanpa bilah); admin: hanya `FORBIDDEN` ber-glitch (`.forbidden`, ::before/::after + clip-path steps). `getMiniProfile` = server action PUBLIK, jadi dibatasi: hanya uid yang pernah menulis ulasan (`reviews`), kursus disaring ke katalog publik, admin tanpa data, tanpa email/telepon/nilai kuis. INI SENGAJA melonggarkan keputusan lama di `publicProfile.ts` (kursus yang diikuti tak tampil di profil publik) atas permintaan pemilik - hanya lewat kartu ini; profil publik `/profil/[uid]` tetap TIDAK menampilkannya.
- **Halaman educator** (`EducatorShell` kini SERVER component yang hanya merender `Navbar` + `Footer` beranda - bilah atas lama dengan "Panel Educator" dibuang): `/educator/courses` = daftar "buku besar" (nomor tipis, judul, tingkat sebagai TEKS polos, aksi teks); `/educator/courses/new` = judul dua baris menjorok + rel bab sticky (`#tentang/#kontributor/#isi/#terbit`) + `CourseForm` berbab bernomor (`BabHead`); `inputClass` bersama (juga form sunting) kini persegi, latar `white/[0.06]`, garis bawah biru saat fokus; `/educator` (pengajuan) = tiga keunggulan bernomor raksasa-tipis, turun bertangga, TANPA ikon.
- **Form kursus (kontributor, isi kursus)**: `ContributorEditor` punya prop `tanpaJudul` (kepala bab ditulis `CourseForm`), bilah pembagian bertumpuk (potongan platform / pemilik / tiap kontributor, `flex: <bagian> 1 0`), baris dengan garis rambut `divide-white/10`, slider `.range-tipis` (lintasan 2px, penggeser kotak biru). `SectionList` (curriculumDraft): bagian = kartu persegi, pelajaran = `bg-white/[0.04]`, tombol naik/turun kotak 36px (`iconButton`) dan `hapusButton` setinggi sama, "+ Tambah bagian" selebar kartu. Rel bab di `/educator/courses/new`: tiga kolom tetap `[12px|2.4rem|1fr]` dan garis tegak di `left:5.5px` agar kotak penanda tepat di atas garis (versi lama melenceng).
- **Profil lengkap `/profil/[uid]`** kini menampilkan "Kursus yang Diikuti" (kartu profil `EnrolledCourses publik`, tanpa harga/sertifikat/ruang belajar) dan, untuk educator, "Kursus yang Dibuat". `getPublicProfile.followed` dibatasi: null untuk admin dan untuk pengguna biasa yang belum pernah menulis komentar publik; hanya katalog publik; `bersihkanEnrollment` membuang order/harga/nilai kuis/sertifikat. Banner profil kini menempel ke tepi atas layar (tanpa `mt-24`, tinggi 290/340px). Tingkat kesulitan di detail kursus = teks polos berwarna (tanpa `Tag`).
- Features: peralihan cincin↔barisan kini pegas teredam (`flatVelRef`: kekakuan 0,010, redaman 0,80) + smootherstep, bukan lerp eksponensial.
- **Tanda pisah**: teks tampilan memakai tanda hubung "-", BUKAN em dash "—" (permintaan pemilik; sudah
  diganti di seluruh string/JSX, komentar kode tak disentuh). Jangan menulis "—" di teks yang tampil.
  Tombol/halaman pendapatan bernama "Pendapatan"; kartu "Cari kursus baru"/"Cari kelas" ada di /dashboard.
- **/dashboard** = kursus & kelas yang DIIKUTI + tombol khusus ke **/dashboard/pendapatan** (royalti,
  referral, kontribusi, penjualan — isi lama dashboard). Tautan lama `#referral`, tab "Penjualan" educator,
  dan tombol di profil sudah menunjuk ke /dashboard/pendapatan.
- **SynapLab tanpa border**: pembatas diganti isian (`bg-white/[…]`), bilah bawah inset (`shadow-[inset_0_-3px_0_…]`)
  untuk sel terpilih / kelompok bergaris-bawah, dan bingkai bersarang berisian samar. Judul menu lab = gambar
  `public/images/SynapLab.png` (157×30), titik biru berdenyut dihapus. Jangan kembalikan `border-*` di papan.
- **/educator**: tanpa label "Program Educator"; kartu persegi tanpa border.
- **Judul section landing** (About, Courses, Features, Learning Path,
  Comments, FAQ) memakai `sections/SectionTitle.tsx`: kata besar kapital di
  tengah, tanpa label/deskripsi (sengaja dihapus atas permintaan pemilik). Ukuran huruf dihitung dari panjang
  judul (`88 / (panjang × 0.64)` vw, maks 11rem) supaya judul panjang tetap
  muat — jangan diberi `whitespace-nowrap` tanpa menghitung ulang.
  Judul kini CLIENT component: animasi ACAK ALFABET saat masuk layar (huruf berganti A–Z lalu mengunci kiri→kanan, 350ms + 80ms/huruf); lebar tiap huruf dikunci pada huruf asli yang tak terlihat supaya baris tidak bergetar; hemat gerak = langsung tampil.
- Bilah hero yang melebar jadi panel "mencari" setelah diam 5 dtk pernah dicoba lalu DIHAPUS atas permintaan
  pemilik - jangan dikembalikan tanpa diminta.
- **Hero bilah**: kalimat yang diketik DIBANGUN dari katalog (`lib/heroPrompts.ts`, modul netral; `app/page.tsx` meneruskan
  `buildHeroPrompts(courses, categories)` ke `Hero`): templat tetap per kursus (dipilih lewat hash slug) + satu kalimat
  per kategori yang punya kursus, maks 36; kursus baru otomatis menambah kalimat. SENGAJA bukan panggilan AI (tampil di
  beranda tiap kunjungan: harus instan & tak bergantung kuota model gratis). Tiap kalimat membawa `q` (judul/kategori
  kursusnya); anak panah di bilah menuju `/courses?q=<q>` (`heroHref`), dan `/courses` meneruskan `?q` ke
  `CourseCatalog` sebagai `initialQuery`. Indeks diundi sekali setelah mount (HTML server = klien), tidak pernah sama
  dengan kalimat sebelumnya (`sessionStorage` `synaped_hero_prompt`, jadi muat ulang selalu berganti), dan diundi
  ulang saat pengunjung kembali ke atas. Tombol wajah "Mulai Belajar" tetap ke /register. Fitur bilah → panel
  rekomendasi kursus dan bilah yang melebar sendiri sudah DIHAPUS atas permintaan pemilik - jangan dikembalikan tanpa
  diminta; `Hero` kini hanya menerima `prompts`.
- **Latar section landing** semuanya `bg-ivory` (alias `paper`, kini gelap).
- **Layar pembuka** `ui/SplashLoader.tsx` (dipasang di `layout.tsx`), alurnya
  meniru intro nomu.store (CSS `.intro-*` di `globals.css`: kata TAHU. → BISA.,
  lapisan ivory naik, logo + tagline mendarat, 5 rel terisi, layar terangkat).
  Sekali per sesi tab (`sessionStorage` `synaped_intro_seen_v2`), dilewati bila
  `prefers-reduced-motion`. **Penanda "sudah tampil" ditulis SETELAH animasi
  selesai**, bukan di awal: React dev menjalankan efek dua kali, dan penanda
  yang ditulis di awal membuat putaran kedua membuang intro (bug: intro tak
  pernah muncul). Dirender terlihat sejak HTML server; keputusan
  melewati dibuat di callback timer (lint melarang setState sinkron di efek).
  `--color-blue-600` & `--color-blue-900` = **biru sapphire `#0F52BA`**
  (permintaan pemilik; keduanya sengaja sama). Animasi hero berjalan di
  belakang splash pada kunjungan pertama.

## Autentikasi & otorisasi

- Login di klien → `POST /api/auth/session` menukar ID token jadi cookie
  httpOnly `synaped_session`. Rute ini juga memanggil `ensureUsername` (gagal = log saja).
- `/login` & `/register` keduanya merender `AuthForm` (satu komponen), yang
  menyimpan mode aktif di state lokal (bukan sekadar lewat props) supaya
  tombol "Masuk"/"Daftar" bisa berpindah tanpa menunggu navigasi Next. Di
  layar md:+ kartunya terbelah dan kedua sisi (panel navy berisi tombol
  ajakan + sisi formulir) BERTUKAR tempat dengan meluncur (`translate-x`,
  900ms; Daftar = panel kiri, Masuk = panel kanan). Isi TIDAK dilepas-pasang
  (dulu `key={mode}` membuat kolom lenyap & berkedip): state `mode` = tujuan
  (menggerakkan panel), `shown` = mode yang isinya terlihat, tertinggal
  `OUT_MS` supaya teks ditukar saat `.auth-isi` transparan (`data-tampil`).
  Bagian khusus satu mode (kolom nama, "Lupa kata sandi", ketentuan) dirender
  selalu dan dilipat halus lewat `Lipat` (grid-rows 0fr↔1fr + `inert`). Tampilan
  persegi tanpa border/bayangan, tanpa tautan "Kembali ke beranda". Panel samping berwarna `#0D2131` (= banner profil bawaan, dipatok karena teksnya tetap putih di tema terang), polos tanpa gradasi. Teksnya dipecah per huruf (`Huruf`, `.grav-h`): masuk dengan ayunan tertinggal+overshoot searah geser panel; bila tombol panel "digesek" 3 kali (`onGesek`: 3 sapuan ≥28px bolak-balik dalam 3 dtk) `beku` terisi dan `hurufFisika.ts` (mesin fisika kecil: lingkaran + gravitasi + tumbukan, rAF menulis `transform` langsung) mengambil alih: huruf judul/kalimat jatuh ke dasar panel (tombol jadi pijakan), huruf tombol ke tepi bawah tombol; panel yang meluncur memberi gaya semu (dari percepatan posisinya) sehingga tumpukan bergelinding; huruf bisa diseret & dilempar (ketukan singkat pada huruf tombol = menekan tombol). Teks panel dibekukan (`beku` = mode saat itu, `key` wadah tetap) supaya elemen huruf tak diganti; Huruf direset (`setBeku(null)` + wadah dipasang ulang) saat pertukaran teks di akhir `switchMode`, atau saat halaman dimuat ulang; tidak disimpan. Tinggi kartu desktop 640px (Masuk) / 800px (Daftar), beranimasi. Sempat dibatalkan
  (terlihat seperti "slider/toggle"), lalu diminta pemilik lagi sesuai
  gambar acuan — jangan dihapus. URL disinkronkan lewat `window.history.replaceState`
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
   `referralRules.ts`, `classTypes.ts`, `profileTypes.ts`, dan seluruh `lib/lab/*`. Mengimpor modul
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
| `classes/{id}` (+ `posts/{id}/replies/{id}`), `classMembers/{uid}_{classId}` | Kelas educator; `joinCode` rahasia (jangan dikirim ke anggota biasa). |
| `users/{uid}` | `bio`, `education`, `skills`, `phone`, `bannerURL`, `username`, `usernameChangedAt`, `referralCode`. Nama & foto hidup di Firebase Auth, bukan di sini. |
| `usernames/{username}` | Reservasi `{uid}`. |
| `orders/{orderId}` | Pesanan. `method` midtrans/manual, `status`, `royalty` (syarat dibekukan), `postPaidStatus`. |
| `settings/payments` | Saklar metode, QRIS, `platformFeePercent` (bawaan 30), `referralPercent` (bawaan 10). |
| `royaltySales/{orderId}`, `royaltyEarnings/{…}` | Buku royalti. Tanpa data pembeli. |
| `referralCodes/{KODE}` | Pemilik kode `{uid}`. |

Storage: `avatars/{uid}` (juga `banner.jpg` — banner profil, lihat bawah), `course-assets/{uid}` (PDF, dilayani lewat
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

## SynapLab (`/lab`)

Papan sandbox untuk memvisualisasikan materi. **Tanpa Firestore, tanpa Server
Action, tanpa login** — seluruh keadaan hidup di memori browser dan di URL.
Empat lab array: **1D** (`array1d`), **2D** (`array2d`), **3D** (`array3d`),
**N-D** (`arrayNd`).

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
- **UI**: `LabShell.tsx` = pengalih 1D·2D·3D·N-D + kepala halaman. Tiap lab adalah
  sebuah `LabKit` (`labKit.ts` kontraknya, `labKits.tsx` keempatnya: reducer,
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
  `m`=2D, `c`=3D, `n`=N-D. 1D: nilai~penunjuk~rentang~catatan. 2D: baris dipisah `;`,
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
