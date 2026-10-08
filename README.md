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
- **Daftar peserta & penilaian** per kursus (`/educator/courses/…/students`),
  dengan tombol **Minta Saran AI** yang mengisi draf nilai + catatan (PDF
  ketikan maupun gambar JPEG/PNG) — educator tetap wajib meninjau dan
  menyimpan sendiri, bukan penilaian otomatis.

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

### SynapLab — papan coba-coba (`/lab`)

Sandbox untuk memahami materi sambil mencobanya, dan untuk menjelaskannya ke
orang lain. Materinya dipilih dari **laci daftar materi** yang dibuka lewat
tombol ☰ di tepi kiri (di ponsel: tombol "Materi" di tengah bawah): **Array**
(Lab 01 — 1D, 2D, 3D, N-D) dan **Linked List** (Lab 02). Laci menimpa halaman
tanpa menggesernya. Array punya empat versi lagi — **1D · 2D · 3D · N-D**.
Tiap lab punya papan, operasi, dan tautan bagikannya sendiri; berpindah lab
tidak menghapus papan lab lain.

- **Terbuka untuk siapa saja**, tanpa login. Tautan yang dibagikan guru bisa
  langsung dibuka siswa.
- **Ruang kerja dua panel** di layar lebar: papan & langkah di kiri, operasi di
  kanan, masing-masing menggulir sendiri. Di ponsel keduanya menumpuk.
- **Operasi lewat tombol dan form**, bukan menulis kode:
  - **1D** — isi dari teks atau acak, push/pop/shift/unshift, baca & ubah
    indeks, sisip, hapus, tukar, balik, slice, geser penunjuk (`i`, `j`, …),
    sorot rentang, dan catat elemen. Maksimal 24 elemen.
  - **2D** — kisi baris × kolom (maksimal 8 × 8): isi dari teks
    (`1 2 3; 4 5 6`) atau acak, sisip/hapus baris & kolom, baca/ubah
    `arr[i][j]`, penunjuk, sorot baris/kolom/sub-kisi, penelusuran baris demi
    baris, kolom demi kolom, dan diagonal, serta transpose, balik setiap baris,
    balik urutan baris, dan putar 90°.
  - **3D** — kubus `arr[lapisan][baris][kolom]` (tiap sisi maksimal 5,
    ≤ 125 elemen) yang tampil sebagai **kubus 3D sungguhan**: bisa diputar
    dengan diseret atau lewat tombol (putar, angguk, Depan, Miring) dan
    direnggangkan lapisannya. Ada juga tampilan **Lapisan** yang menjajarkan
    tiap lapisan datar, serta pita memori dengan rumus offset
    `k×R×C + i×C + j`. Operasinya: buat berurutan/acak/dari teks
    (`1 2; 3 4 | 5 6; 7 8`), sisip/hapus lapisan, baca & ubah `arr[k][i][j]`,
    penunjuk, sorot lapisan / baris / kolom / pilar, penelusuran lapisan demi
    lapisan, pilar demi pilar, dan diagonal ruang, serta transpose & putar 90°
    setiap lapisan, balik urutan lapisan, dan tukar sumbu.
  - **N-D** — array dengan berapa pun dimensinya (sampai 6 dimensi, tiap
    dimensi 1–6, total ≤ 120 elemen), digambar sebagai kotak bersarang plus
    **pita memori** yang menunjukkan urutan row-major dan langkah alamat tiap
    sumbu. Operasinya: buat bentuk (`2, 3, 4`), isi acak/teks, baca & ubah
    elemen (lengkap dengan hitungan offset-nya), kursor, sorot irisan,
    penelusuran urutan memori, **reshape** (alamat berubah, memori tidak), dan
    **tukar sumbu** (memori disusun ulang — pada 2D sama dengan transpose).
- **Dijalankan langkah demi langkah** dengan narasi Bahasa Indonesia yang tampil
  tepat di atas papan: putar, jeda, maju/mundur satu langkah, atau klik langkah
  mana pun di daftarnya. Temponya sengaja pelan untuk siswa yang baru belajar
  (±1,6 detik per langkah, sel meluncur selama 1 detik); kecepatan bisa diatur
  0,5×–4×.
- **Animasi yang menjelaskan, bukan sekadar bergerak:**
  - sel yang berpindah **meluncur** ke tempat barunya, dan sel yang tidak
    berpindah diam sepenuhnya; di kubus 3D sel terbang menembus lapisan;
  - saat transformasi (transpose, putar, balik, tukar sumbu, reshape) setiap
    baris/kolom/lapisan asal diberi **warna sendiri** yang ikut berpindah,
    lengkap dengan legendanya — "baris 0 menjadi kolom 0" terlihat langsung;
  - penelusuran meninggalkan **jejak panah dan nomor urut** di setiap sel yang
    sudah dikunjungi, sehingga polanya (baris demi baris, kolom demi kolom,
    pilar demi pilar) terlihat utuh;
  - membaca `arr[i][j]` (atau `arr[k][i][j]`, atau N-D) diurai **bertahap**:
    pilih baris dulu, lalu kolomnya — nomor baris & kolom ikut menyala.
- **Pengurutan (sorting)** di keempat lab: bubble sort, selection sort,
  insertion sort, merge sort, dan quick sort, naik atau turun.
  - Setiap perbandingan dan pertukaran adalah satu langkah: sel yang
    dibandingkan berwarna biru, kunci/minimum kuning, pivot merah bata, yang
    sudah di tempat akhir gelap, dan yang sedang tidak dikerjakan redup.
    Variabel algoritmanya (`j`, `j+1`, `min`, `kunci`, `pivot`) tampil sebagai
    label yang ikut bergerak.
  - Di akhir ditampilkan jumlah perbandingan dan pertukaran — cocok untuk
    membandingkan algoritma pada isi yang sama.
  - Array 2D, 3D, dan N-D juga bisa diurutkan: **tiap baris / tiap kolom / tiap
    pilar** (atau tiap garis sepanjang satu sumbu pada N-D) sendiri-sendiri,
    atau **seluruhnya** sebagai satu deret mengikuti urutan memori.
  - Animasi yang terlalu panjang (mis. bubble sort 64 elemen) ditolak dengan
    saran memakai array lebih kecil atau merge/quick sort.
- **Batalkan & ulangi** untuk setiap operasi.
- **Mode presentasi** (sel membesar, layar penuh, `Esc` untuk keluar) dan
  tombol pintas keyboard.
- **Linked list (singly)** — materi tersendiri, terpisah dari array:
  - setiap simpul digambar `[nilai | next]` lengkap dengan **alamat memorinya**,
    disambung panah; kotak `head` menunjuk simpul pertama, dan tabel **Memori**
    di bawah papan memperlihatkan bahwa simpul-simpul tersebar, tidak berderet
    seperti array (maksimal 8 simpul);
  - operasi: isi dari teks/acak, kosongkan, sisip di depan / belakang / di
    indeks, hapus di depan / belakang / di indeks / menurut nilai, cari nilai,
    baca & ubah nilai di indeks, telusuri, dan **balik list**;
  - variabel penunjuk algoritma (`cur`, `prev`, `next`, `baru`, `hapus`)
    meluncur dari simpul ke simpul; panah pointer **berbelok** saat diubah;
    simpul baru muncul di bawah rantai lalu naik masuk, simpul yang dihapus
    turun keluar lalu dibebaskan; saat dibalik, panah dibalik satu per satu
    sementara simpulnya diam;
  - narasinya menekankan biaya: sisip/hapus di depan O(1), mencapai indeks k
    harus berjalan k langkah dari head, dan **urutan mengubah pointer** saat
    menyisip (sambungkan simpul baru ke sisa list dulu, baru belokkan
    pendahulunya — kalau terbalik, sisa list hilang).
- **Bagikan papan lewat tautan**: seluruh keadaan papan ikut di URL. Tidak ada
  yang tersimpan di server — menutup tab berarti papan itu hilang.

### Kelas

Ruang belajar kelompok milik educator, terpisah dari kursus.

- Educator membuat kelas dan membagikan **kode undangan**.
- Anggota bergabung dengan kode itu di `/kelas`.
- Di dalam kelas ada pengumuman/postingan dan balasan. Pengumuman boleh
  berlampiran berkas (atau berkas saja tanpa teks).
- **Tugas** (mirip Google Classroom), diterbitkan pengajar dari kotak tulis yang
  sama dengan memilih "Tugas":
  - judul, instruksi, dan lampiran berkas (opsional);
  - format jawaban yang diterima, boleh lebih dari satu: **teks** yang diketik
    langsung, **PDF & gambar** (PDF/JPG/PNG), **dokumen Office**
    (DOCX/PPTX/XLSX), **arsip ZIP**;
  - **tenggat** opsional (ditulis & ditampilkan dalam WIB) dan pilihan
    **menerima pengumpulan setelah tenggat** (ditandai "Terlambat");
  - nilai maksimal (bawaan 100).

  Tenggat dan izin terlambat masih bisa diubah setelah terbit (mis. untuk
  memperpanjang atau menutup lebih awal); format dan nilai maksimal tidak.
- Siswa melihat semua tugas di tab **Tugas** beserta statusnya (belum
  mengumpulkan / dikumpulkan / terlambat / dinilai), lalu mengumpulkan di
  halaman tugas `/kelas/[id]/tugas/[postId]`. Selama belum dinilai dan
  pengumpulan masih dibuka, kiriman bisa **dibatalkan lalu dikirim ulang**
  (berkas yang sudah dikirim ikut terhapus).
- Pengajar melihat daftar seluruh siswa per tugas di
  `/educator/classes/[id]/tugas/[postId]`, mengunduh jawabannya, lalu memberi
  **nilai + komentar** yang langsung terlihat oleh siswa.
- Batas: maksimal 5 berkas per postingan/kiriman, masing-masing di bawah 20 MB.
  Siswa tidak bisa melihat jawaban siswa lain.
- **Koreksi dengan AI** (per siswa, di halaman tugas pengajar):
  - tombol di setiap kiriman mengisi kolom **nilai** otomatis (skala nilai
    maksimal tugas). Pengajar tetap meninjau, boleh mengubah, lalu menekan
    *Simpan nilai* sendiri — AI tidak pernah menyimpan;
  - centang **"AI juga mengisi komentar"** (bawaannya diatur per tugas, bisa
    diubah per siswa). Kalau tidak dicentang, catatan AI tetap ditampilkan
    sebagai petunjuk dengan tombol *Pakai sebagai komentar*;
  - kartu **Koreksi AI** menentukan dari mana AI membaca soal: **instruksi &
    lampiran tugas**, atau **berkas konteks terpisah** (maks. 3 berkas PDF,
    gambar, atau Office — misalnya kunci jawaban) yang **tidak pernah terlihat
    siswa**;
  - AI bisa membaca jawaban teks, PDF ketikan, gambar JPG/PNG, dan dokumen
    DOCX/PPTX/XLSX. ZIP dan PDF hasil pindai tidak terbaca — pengajar diberi
    tahu berkas mana yang dilewati;
  - memakai OpenRouter (model gratis), berbagi kuota harian dengan asisten chat
    dan "Minta Saran AI" kursus, maksimal 8 koreksi per menit per pengajar.
    Jawaban siswa dikirim ke layanan AI pihak ketiga saat dikoreksi.

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
seputar SynapEd (OpenRouter, model gratis). Dibuka dari dalam halaman
belajar suatu pelajaran, ia beralih ke **mode tutor**: bisa mendiskusikan
materi pelajaran itu, tapi menolak memberi jawaban akhir untuk kuis/tugas
yang sedang dikerjakan.

Yang diketahui asisten:
- **Pengetahuan fitur** ditulis di `frontend/src/lib/chatKnowledge.ts` dan
  wajib ikut diperbarui setiap kali fitur yang terlihat pengguna berubah.
- **Diperbarui otomatis** setiap pesan, karena dibaca langsung dari sistem:
  katalog kursus, metode pembayaran yang sedang dinyalakan admin, persentase
  referral, dan kontak resmi.
- `npm run verify:chat-knowledge` gagal kalau ada halaman baru atau alamat yang
  berubah tetapi pengetahuan asisten belum ikut diperbarui.

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
npm run verify:lab                # SynapLab — murni, tanpa dev server & kredensial
npm run verify:class-assignment   # tugas kelas: format, tenggat, nilai, berkas, pembersihan
npm run verify:chat-knowledge     # pengetahuan asisten sejalan dengan halaman situs (murni)
```

---

## Yang belum ada

- Penarikan dana / payout untuk royalti dan referral.
- Refund otomatis. Kabar refund dari Midtrans hanya ditandai untuk ditindaklanjuti admin.
- Notifikasi email (keputusan pengajuan, penilaian tugas, dsb.).
- Soal kuis selain pilihan tunggal.
- Materi SynapLab lain (string, stack/queue, tree, visualisasi data), linked list ganda (doubly) dan melingkar (circular), serta algoritma selain pengurutan di papan array (mis. pencarian biner).
- Menyimpan & menamai papan SynapLab, dan menautkannya ke kelas atau pelajaran kursus.
- Tugas kelas: menyunting judul/instruksi/lampiran setelah terbit, mengembalikan
  tugas ke siswa untuk diperbaiki, nilai untuk siswa yang tidak mengumpulkan,
  rekap nilai per kelas, dan koreksi AI untuk semua siswa sekaligus.
- Koreksi AI untuk PDF hasil pindai dan isi arsip ZIP.

---

## Riwayat singkat

Bermula dari Laravel + Blade, pindah ke Next.js + NestJS/Prisma, lalu ke
Firebase. Data empat kursus awal dimigrasikan dari array PHP. Akun lama
diimpor beserta hash kata sandinya, jadi kata sandi lama tetap berlaku.
