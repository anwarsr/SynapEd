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
| **Pengguna** | Belajar, membeli kursus atau **Premium**, ikut kelas, mendapat sertifikat, menerima royalti kalau jadi kontributor, membuat kode referral |
| **Educator** | Semua yang di atas, ditambah membuat & mengelola kursus, membuat kelas, menilai tugas peserta |
| **Admin** | Meninjau pengajuan educator dan perubahan kursus, memeriksa pembayaran QRIS, mengatur kategori, potongan platform, referral, dan Premium (harga, beri/cabut, bagi hasil) |

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

### SynapEd Premium (`/premium`)

Satu pembayaran membuka **semua kursus publik berbayar selama 30 hari**
(bawaan Rp50.000; harganya diatur admin di `/admin/premium`).

- **Membeli:** lewat Midtrans atau QRIS manual yang sama dengan membeli kursus;
  kode referral berlaku (perujuk dibayar dari potongan platform, seperti
  pembelian kursus).
- **Tanpa langganan otomatis.** Membeli lagi saat masih aktif menambah 30 hari
  di belakang tanggal berakhir, jadi sisa hari tidak hilang.
- **Belajar:** di halaman kursus berbayar, anggota menekan *Pelajari dengan
  Premium*. Kursus gratis tetap gratis; kursus privat tidak termasuk; kursus
  milik sendiri tidak perlu premium.
- **Saat berakhir/dicabut:** akses kursus lewat premium berhenti, tetapi
  kemajuan, nilai, dan sertifikat tetap tersimpan. Memperpanjang = lanjut dari
  posisi terakhir. Membeli kursus yang sedang dipelajari lewat premium
  menjadikannya milik sendiri selamanya, kemajuannya ikut.
- **Lencana & pengingat:** lencana "Premium" di navbar dan profil; spanduk
  pengingat di `/premium` dan `/dashboard` mulai 5 hari sebelum berakhir.
- **Ditawarkan di banyak tempat:** tautan "Premium" berwarna aksen di navbar
  (semua pengunjung), pita ajakan di beranda (di bawah daftar kursus), di
  katalog `/courses`, dan di `/dashboard` (bukan anggota), label "Termasuk
  Premium" di setiap kartu kursus berbayar, dan tautan di halaman kursus.
  Pitanya menghitung jumlah kursus & penghematan dari katalog sungguhan.
  Admin tidak ditawari (sudah bisa membuka semua kursus).
- **Pelajar maupun educator** bisa membeli. Educator mendapat semua kursus
  educator lain; kursusnya sendiri tetap ia kelola seperti biasa.
- Halaman `/premium` sengaja hanya membahas **manfaat** (kursus yang terbuka,
  penghematan, sertifikat, kemajuan tersimpan) dan pertanyaan umum - cara uang
  dibagi ke educator tidak dijelaskan ke pembeli.
- **Admin** bisa memberi premium tanpa bayar (beasiswa, 1-365 hari) dan
  mencabutnya (mis. setelah pengembalian dana, yang tetap diurus manual).
- **Bagi hasil sesuai pemakaian.** Setiap periode 30 hari yang sudah berakhir:
  potongan platform diambil, sisanya dibagi ke kursus berbayar yang dipelajari
  anggota itu, sebanding dengan jumlah pelajaran yang ia selesaikan dalam
  periode itu, lalu ke pemilik & kontributor kursus sesuai pembagiannya.
  Periode tanpa pemakaian menjadi milik platform. Pembagian dipicu admin dengan
  tombol *Bagikan pendapatan* di `/admin/premium`
  (atau `npm run settle:premium -- --apply`); keduanya aman diulang. Hasilnya tampil di
  `/dashboard/pendapatan` dengan label "Premium".

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
  ketikan, PDF hasil pindai, gambar di dalam PDF, maupun gambar JPEG/PNG) —
  educator tetap wajib meninjau dan menyimpan sendiri, bukan penilaian
  otomatis. Bagian berkas yang tidak terbaca AI ditampilkan sebagai
  peringatan di bawah tombolnya.

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

- Setiap akun bisa membuat **satu kode** di `/dashboard/pendapatan`. Kode tidak bisa
  diganti setelah dibuat, supaya tautan yang sudah tersebar tetap berfungsi.
- Tombol **Bagikan dengan kode referral** di halaman kursus mana pun
  menghasilkan tautan yang memuat kode itu. Siapa pun yang membeli lewat
  tautan tersebut (sampai 30 hari kemudian) otomatis memakai kodenya.
- Kode milik sendiri tidak bisa dipakai untuk pembelian sendiri.

### Dashboard (`/dashboard`)

- **Semua akun:** kursus dan kelas yang diikuti beserta kemajuannya.
- **Educator & admin:** tambahan *Kursus yang Dibuat* dan *Kelas yang Dibuat*
  (peserta, ulasan, tombol kelola/buat baru).
- Pendapatan ada di halaman tersendiri, `/dashboard/pendapatan`
  (tombol "Pendapatan" di dashboard).

### Pendapatan (`/dashboard/pendapatan`)

- **Semua akun:** total pendapatan (royalti + referral), riwayat per
  penjualan, kode referral, dan daftar kursus tempat ia berkontribusi
  beserta persentasenya.
- **Educator & admin:** tambahan bagian *Penjualan Kursus Saya* (penjualan
  kotor, potongan, bagian kontributor).
- Data pembeli tidak pernah ditampilkan ke kontributor maupun perujuk.
- Penarikan dana **belum tersedia**. Dashboard hanya mencatat.

### SynapLab — papan coba-coba (`/lab`)

Sandbox untuk memahami materi sambil mencobanya, dan untuk menjelaskannya ke
orang lain. Membuka `/lab` menampilkan **galeri kartu** semua materi (bergambar,
terlihat sekaligus): **Array** (Lab 01 — 1D, 2D, 3D, N-D), **Linked List**
(Lab 02), **Flowchart** (Lab 03), **Python** (Lab 04), **Pseudocode** (Lab 05),
**Sorting** (Lab 06), dan **Searching** (Lab 07). Dari dalam lab, tombol ☰ di
tepi kiri (di ponsel: tombol "Materi" di tengah bawah) membuka galeri yang sama
sebagai lapisan layar penuh; lab yang sedang dibuka ditandai. Tautan bagikan
langsung membuka lab-nya tanpa melewati galeri. Array tampil sebagai satu kartu;
empat versinya — **1D · 2D · 3D · N-D** — dipilih lewat pengalih di kepala
halaman, dan kartunya kembali ke dimensi yang terakhir dipakai.
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
- **Flowchart** (Lab 03) — menggambar ala draw.io lalu **menjalankannya**:
  - **simbol ANSI/ISO 5807**: Mulai, Selesai, Proses, Input/Output, Keputusan,
    Persiapan, Subproses, Konektor, Dokumen, Data tersimpan, dan Catatan —
    diseret dari panel Simbol (atau diklik untuk ditaruh di tengah);
  - **menyambung**: arahkan ke simbol, seret bulatan biru di sisinya ke simbol
    lain; garis siku digambar otomatis (diluruskan bila dua simbol hampir
    sejajar), cabang Keputusan otomatis berlabel **Yes** lalu **No**. Sisi
    keluar/masuk dan label bisa diubah di Properti; teks yang diketik di
    Properti langsung tampil di kanvas;
  - menyunting: klik ganda untuk mengubah teks/label di tempat, seret sudut
    untuk mengubah ukuran, Shift+seret untuk memilih banyak, salin (Ctrl+D),
    hapus (Del), undo/redo, geser kanvas & zoom (Ctrl+roda), grid, layar penuh;
  - **pemeriksa aturan** (tab Periksa, berupa peringatan — tetap boleh
    menggambar bebas): satu Mulai, ada Selesai, Mulai tanpa garis masuk,
    Selesai tanpa garis keluar, Keputusan tepat dua cabang Yes/No, simbol
    lain satu garis keluar, semua simbol terjangkau dari Mulai dan punya jalan
    ke Selesai, konektor berpasangan, teks yang bisa dijalankan, dan **saran
    bentuk baku Cambridge** (mis. "tulis INPUT, bukan Baca"). Klik temuan untuk
    menyorot simbolnya;
  - **Jalankan** (tab Jalankan): flowchart dieksekusi langkah demi langkah —
    simbol aktif menyala, garis yang dilewati beranimasi, tabel **variabel**
    (yang baru berubah disorot), **keluaran**, dan narasi tiap langkah.
    Putar/jeda/langkah/mundur/sampai akhir, kecepatan 0,5×–4×. Simbol **INPUT**
    memakai masukan yang diisi di muka (mis. `4, 5`) atau berhenti meminta
    nilainya. Perulangan tak berujung dihentikan setelah 5.000 langkah;
  - **bentuk baku penulisan = gaya Cambridge** (silabus IGCSE 0478 / O Level
    2210 menetapkan enam simbol flowchart dan penulisan yang tepat; isinya
    pseudocode Cambridge, sama dengan Lab 05): `START`/`STOP`, `INPUT X`,
    `OUTPUT "Luas = ", Luas` (nilai disambung tanpa spasi), `Total ← Total + X`
    (ketik `<-`), kondisi `X MOD 2 = 0?` atau `Is X > 0?`, `AND`/`OR`/`NOT`,
    `<>`, `&`, `MOD(X, 2)`/`DIV(X, 2)`, fungsi `INT`, `ROUND(X, n)`, `LENGTH`,
    `UCASE`, `LCASE`, dan cabang **Yes/No**. Bentuk Indonesia/lama tetap
    berjalan (Baca, Tampilkan, `x = 1`, `+=`, `++`, `dan`/`atau`/`tidak`, `==`,
    `!=`, `mod`, Ya/Tidak, akar/abs/bulat/min/max) dan hanya mendapat saran di
    tab Periksa. Tab **Panduan** di panel kanan berisi daftar lengkap perintah,
    operator, padanan bentuk lama, dan kesalahan yang sering terjadi.
    Subproses bernama, Dokumen, dan Data dilewati (dikatakan di narasi);
  - **contoh** siap pakai: luas persegi panjang, genap/ganjil, jumlah 1 sampai n;
  - **menyimpan**: tombol Bagikan membuat tautan (diagram dipadatkan), menu
    Berkas menyimpan/membuka `.json` (untuk flowchart besar) dan mengekspor
    **PNG/SVG** berlatar putih untuk laporan. Draf terakhir juga diingat browser.
- **Python** (Lab 04) — menulis dan menjalankan Python 3.14 sungguhan di
  browser (CPython lewat Pyodide), tanpa install dan tanpa akun:
  - editor berwarna dengan nomor baris; Tab menjorokkan 4 spasi, Enter
    meneruskan jorokan (dan menambahnya setelah `:`), Ctrl+Enter menjalankan;
  - **Masukan diisi di muka**: kotak Masukan, satu nilai per baris, dibaca
    `input()` berurutan; nilai yang dibaca ikut tampil di keluaran seperti di
    terminal;
  - **Langkah demi langkah** ala Python Tutor: program direkam lalu diputar
    maju-mundur (tombol, panah ←/→, Home/End, penggeser, kecepatan 0,5×–4×).
    Baris berikutnya disorot biru, baris yang baru dijalankan samar; tabel
    **variabel** per lingkup (global & setiap fungsi yang sedang dipanggil,
    termasuk rekursi), yang berubah disorot; keluaran tumbuh per langkah;
  - **galat** ditampilkan dengan nomor baris, traceback asli, dan **saran
    berbahasa Indonesia** (mis. "hasil input() selalu teks — pakai
    int(input())");
  - batas: satu kali jalan 10 detik (lalu dihentikan; ada tombol **Stop**),
    mode langkah merekam 2.000 langkah dan menghentikan program di 100.000
    langkah (perulangan tak berujung jadi galat yang bisa ditelusuri), keluaran
    100.000 karakter;
  - aman: kode berjalan di Web Worker terpisah tanpa akses ke halaman, akun,
    maupun jaringan (kode dari tautan orang lain tidak bisa memanggil SynapEd
    atas nama Anda). Pustaka standar tersedia; paket seperti numpy belum;
  - Python (±12 MB) baru diunduh saat lab Python dibuka, lalu dari cache.
- **Pseudocode** (Lab 05) — pseudocode gaya **Cambridge International AS & A
  Level Computer Science 9618** (mengikuti *Pseudocode Guide for Teachers*),
  dengan editor, Jalankan, dan langkah demi langkah yang sama seperti Python:
  - `DECLARE`/`CONSTANT`, tipe `INTEGER REAL CHAR STRING BOOLEAN`,
    `ARRAY[1:n]` dan 2D `ARRAY[1:n, 1:m]`, `←` (atau `<-`), `INPUT`, `OUTPUT`;
  - `IF … THEN … ELSE … ENDIF`, `CASE OF … OTHERWISE … ENDCASE` (nilai, daftar,
    rentang `TO`), `FOR … TO … STEP … NEXT`, `WHILE … ENDWHILE`,
    `REPEAT … UNTIL`;
  - `PROCEDURE`/`CALL` dengan `BYVAL`/`BYREF` (BYREF berlaku sampai diganti,
    sesuai panduan), `FUNCTION … RETURNS … RETURN`, rekursi;
  - operator `& MOD DIV AND OR NOT`, fungsi `LENGTH LEFT RIGHT MID UCASE LCASE
    TO_UPPER TO_LOWER NUM_TO_STR STR_TO_NUM IS_NUM ASC CHR INT RAND`;
  - **tipe diperiksa** seperti di ujian: REAL tidak boleh masuk INTEGER, teks
    disambung dengan `&` (bukan `+`), indeks array diperiksa batasnya, setiap
    variabel wajib di-DECLARE (panduan menyebutnya praktik yang baik; lab
    mewajibkannya agar tipe bisa diperiksa). Kesalahan umum dijawab dengan
    bentuk 9618 yang benar: `PRINT` → `OUTPUT`, `x = 5` → `x ← 5`, `ELSEIF`,
    `END IF`, `ENDFOR`, kata kunci huruf kecil;
  - teks yang disalin dari PDF panduan (tanda `−` dan kutip `ꞌ`) tetap terbaca;
  - panel **Panduan** berisi ringkasan dialeknya.
- **Sorting** (Lab 06) — **bubble sort**, **insertion sort**, dan **merge sort**, langkah demi
  langkah dan sengaja **pelan** (kecepatan 0,25×-2×, bisa maju/mundur manual):
  - bubble sort digambar sebagai **batang** (tinggi = nilai): pasangan yang
    dibandingkan, pertukaran yang meluncur, dan bagian kanan yang sudah final;
  - insertion sort memakai batang yang sama: **Kunci** (kartu yang sedang
    disisipkan, berwarna amber) bergerak ke kiri sementara nilai yang lebih besar
    bergeser ke kanan, dengan garis pembatas bagian kiri yang sudah urut;
  - merge sort digambar sebagai **pohon bagi-gabung** seperti di buku teks:
    data dibelah turun sampai satu elemen, lalu hasil gabungannya digambar di
    baris-baris berikutnya (bentuk belah ketupat) dengan **panah** dari induk ke
    anak dan dari anak ke hasil gabungan, **nomor urutan proses** di setiap
    kotak, serta penunjuk `i`, `j`, `k` saat mengisi array bantu;
  - setiap langkah punya **kalimat penjelasan** dan baris **pseudocode
    Cambridge 9618** yang sedang dijalankan disorot (kodenya bisa langsung
    dicoba di Lab 05), plus penghitung perbandingan & pertukaran/pergeseran/penyalinan;
  - data: ketik sendiri (2-12 angka 0-999), acak, atau **contoh kasus**
    (sudah urut, terbalik, hampir urut, ada nilai kembar), arah naik/turun;
    ketiga algoritma memakai data yang sama dan di akhir jumlah kerjanya
    dibandingkan; **Bagikan** menyalin tautan berisi algoritma + data.
- **Searching** (Lab 07) — **linear search**, **binary search**, dan **jump search** dengan
  kendali yang sama seperti Lab 06 (pelan, maju/mundur, garis waktu):
  - data tampil sebagai **kotak berindeks**; penunjuk `i` (linear) atau
    `Kiri`/`Tengah`/`Kanan` (binary) atau `Awal`/`Akhir` (blok jump search) di
    atas kotak, dan bagian yang sudah diperiksa/dibuang diredupkan;
  - jump search melompat per blok berisi ⌊√n⌋ data sambil memeriksa ujung
    blok saja, lalu mencari satu per satu di blok tempat ia berhenti;
  - binary & jump search butuh data urut, jadi data yang belum urut **diurutkan dulu**
    (kotak-kotak meluncur ke tempatnya) dengan penjelasan alasannya;
  - narasi per langkah + pseudocode **Cambridge 9618** yang disorot (bisa dicoba
    di Lab 05), penghitung perbandingan beserta batas maksimalnya (n untuk
    linear, ⌊log₂ n⌋ + 1 untuk binary, ⌈n/m⌉ − 1 + m untuk jump);
  - data 2-32 angka 0-999 + nilai yang dicari: ketik, acak, atau contoh kasus
    (ada di tengah, di awal, tidak ada, nilai kembar, 32 data); di akhir ketiga
    algoritma dibandingkan; **Bagikan** menyalin tautannya.
- Kedua lab kode: **contoh** siap pakai (luas, genap/ganjil, jumlah 1..n,
  CASE, array, validasi masukan, rekursi, BYREF/dictionary), **Bagikan**
  (tautan berisi kode + masukan; kode dari tautan hanya ditampilkan, tidak
  dijalankan otomatis), menu **Berkas** (simpan/buka `.py`/`.txt`), **draf**
  terakhir diingat browser, layar penuh, tema terang/gelap, dan ponsel.
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

- Educator (dan admin) membuat kelas, memberinya **foto profil** (tampil di kotak
  identitas kelas), dan membagikan **kode undangan**.
- Anggota bergabung dengan kode itu di `/kelas`.
- **Perlindungan salin**: di halaman publik teks tidak bisa diblok/disalin dan klik kanan serta pintasan lihat-sumber
  ditahan (kolom isian, editor SynapLab, dan area admin/educator dikecualikan). Situs juga tak bisa dibingkai situs lain,
  dan source map produksi dimatikan. Catatan: ini penghalang untuk pengunjung awam, bukan jaminan mutlak.
- **Gerakan tangan untuk objek 3D**: di mode layar penuh objek 3D ada tombol tangan; kamera depan membaca tangan
  (tangan terbuka bergerak = memutar objek ke kanan/kiri/atas/bawah, telunjuk saja = menunjuk komponen lalu tahan sebentar untuk menampilkan keterangannya, dua jari naik-turun = zoom, kepalan = jeda).
  Panel kontrolnya bawaan berupa batang tegak tipis di tepi kanan (berubah biru saat tangan terdeteksi, bisa diseret naik-turun, tekan untuk membuka, tombol minus untuk mengecilkan lagi). Pratinjau hanya menampilkan kerangka tangan (wajah tidak ditampilkan); gambar kamera hanya diproses di perangkat sendiri, tidak direkam atau dikirim.
- **Kartu kelas** di /kelas dan dashboard: foto profil kelas tampil setinggi kartu di tepi kiri; tekan untuk menutupnya ke kiri (tersisa kotak tipis dan isi kartu melebar mengisi ruangnya), tekan kotak tipis itu untuk membukanya lagi.
- **SyRobo** (`/syrobo`, perlu masuk): robot peliharaan dalam kamar bergaya gambar tangan yang memenuhi satu layar (tanpa footer): dok ikon Main Room/Makan/Mandi/Baju/Toko/Games/Hadiah (tiap menu Makan, Mandi, Baju, dan Toko memindahkan robot ke ruangannya sendiri - dapur, kamar mandi, ruang ganti, toko - yang semua bendanya bisa disentuh; Main Room = kamar utama), robot berkeliling kamar sendiri, bisa diangkat ke mana saja di layar dan menetap di tempat dilepas, menu hanya menutupinya, dan sebelum masuk robotnya mati (ditekan = ke halaman masuk), dan benda di kamar bisa diketuk (lampu, jendela, tanaman, buku, jam). Di Toko ada tab **Main Room** (di kanan tab Pakaian): kamar bawaan plus 6 latar Main Room baru seharga 200 poin bintang masing-masing, tiap latar dengan satu fitur unik yang bisa disentuh (Taman Bunga: bunga mekar dan kupu-kupu; Pantai Senja: tekan matahari dan ia tenggelam, bulan terbit untuk menidurkan robot; Stasiun Angkasa: benda gravitasi nol; Pondok Salju: salju dan perapian; Arcade Neon: skor sampai JACKPOT; Akuarium Laut: peti harta dan ikan) dan tiap latar punya saklar lampu bertema sendiri untuk menidurkan robot, ditambah **Istana Kerajaan** yang tidak dijual dan terbuka gratis selama SynapEd Premium aktif. Menyelesaikan satu kursus sampai sertifikat terbit memberi **+10 poin bintang** SyRobo (sekali per kursus). Menu Games membuka ruang game bergaya lukisan tangan (TV tabung yang bisa diganti permainannya, kantong kacang, rak penuh piala). Halaman ini punya musik latar yang santai dan lucu (dibuat langsung di peramban), dengan tombol musik di bawah kotak poin bintang untuk mematikan dan menyalakannya (pilihan tersimpan di perangkat); musik diam selama game terbuka atau robot tidur. Tautan navbar di kanan FAQ. Pakaian (18 buah, slot kepala dan badan, ukurannya bisa diatur) dibeli di Toko dengan poin, dan robot dimandikan dengan menggosokkan spons ke robot sampai bar Bersih penuh. Bisa lapar, kotor, dan kelelahan seiring waktu: hati di dada robot meredup saat energinya turun, dan bila sangat tipis dan berkedip ia perlu tidur (ada bar Energi; tidurkan dengan mematikan lampu di Main Room: energinya pulih penuh dalam 10 menit tidur, dan robot TETAP tidur walau kamu pindah ruangan, pindah halaman, atau menutup situs, sampai kamu menyalakan lampu untuk membangunkannya; selama tidur robot yang dielus tetap terlelap dengan wajah bahagia (senyum, pipi merona, hati melayang), tetapi yang diangkat jadi marah (alis menukik, pipi merah, uap di kepala); selama tidur menu Makan, Mandi, Baju, Toko, dan Games terkunci (bergembok) sampai ia dibangunkan; Main Room dan Hadiah tetap bisa dibuka), jadi diberi makan (makanan dibeli di kotak makanan dengan poin) dan dimandikan; bisa diganti nama dan bajunya, dan bereaksi saat dielus, diketuk, atau diangkat. Poin didapat dari hadiah harian (masuk 5 bintang, lalu waktu aktif 5 menit 1 bintang, 10 menit 3, 20 menit 5, 30 menit 7, 1 jam 10, 2 jam 15; pemilik Premium aktif +50%) yang diklaim manual. Robot asisten di pojok layar ikut tampak lapar atau kotor bila SyRobo-mu butuh dirawat. Pemilik **SynapEd Premium aktif** mendapat 4 pakaian khusus (topi militer, baju militer (cokelat), mahkota raja, jubah raja) dan 10 **makanan dewa**, semuanya gratis selama premium aktif: satu makanan dewa mengenyangkan penuh dan membekukan bar kenyang 24 jam penuh, dan tiap makanan dewa memberi robot efek khususnya sendiri (ledakan cahaya saat dimakan, lalu aura tenang selama 24 jam): pusaran cahaya emas (Ambrosia), tetes merah muda (Nektar Langit), apel emas mengorbit (Apel Emas), gelembung anggur ungu (Anggur Dewa), lebah dan tetes madu (Madu Surgawi), kelopak persik jatuh (Persik Abadi), butir putih seperti bintang jatuh (Nasi Langit), bulan sabit mengorbit (Kue Bulan), bara dan uap (Sup Naga), serta bintang berkelap-kelip (Roti Bintang). Menu **Games** berisi *Tanjakan Robo* (mirip Hill Climb Racing, pengendaranya robot; desktop: panah/A D dan spasi untuk loncat, Shift untuk nitro, M untuk suara, ponsel: pedal gas/rem serta tombol LONCAT dan NOS (di desktop tanpa tombol di layar); ada batu penghalang untuk dilompati dan tabung nitro biru yang mengisi tangki NOS, lalu tahan Shift/NOS untuk melesat; koin yang dikumpulkan masuk ke akun dan **bisa ditukar poin bintang di menu Toko, tab Koin Game**: 100 koin = 1 bintang, maksimal 1.500 koin disetor per hari WIB), dan *Bola Gabung* (mirip fruit merge: jatuhkan bola ke wadah, dua bola sejenis lebur jadi bola yang lebih besar (kelereng, pingpong, golf, tenis, bisbol, bowling, voli, basket, sepak, pantai, sampai bola dunia), jangan sampai tumpukan melewati garis merah; desktop: mouse/panah membidik, klik/spasi menjatuhkan, tanpa tombol di layar; ponsel: geser lalu lepas; bola menggelinding dan berputar dengan fisika gesekan, wadah ramping, latar berganti (kamar, lapangan, senja, luar angkasa) mengikuti bola terbesar yang dicapai; rekor di perangkat; skor masuk ke saldo Bola Gabung dan harus DITUKAR dulu di Toko, tab Koin Game (1.000 skor = 1 bintang) sebelum jadi poin bintang). Kedua game punya efek suara dan musik latar (dibuat langsung dengan WebAudio, tanpa berkas audio) yang bisa dihidupkan atau dimatikan terpisah lewat tombol pengeras suara (atau M musik, N efek); pilihannya tersimpan di perangkat. Di ponsel, menu Makan, Mandi, Baju, Toko, dan Hadiah berbentuk kotak kecil yang tidak memenuhi layar, dengan tombol silang sebesar di desktop. Game ketiga, *Lari Robo* (endless runner): robot berlari makin cepat; Spasi/↑ loncat (tahan = lebih tinggi), Shift dash (kebal sesaat dan menghancurkan rintangan), Ctrl/↓ menunduk; ponsel: tombol LONCAT, DASH, TUNDUK. Rintangan: peti dan duri (loncat), drone melayang (menunduk), tembok energi (hanya bisa ditembus dash). **Tiap 100 skor = 1 poin bintang** (skor masuk ke saldo Lari Robo dan harus ditukar dulu di Toko, tab Koin Game, yang kini punya tiga baris penukaran: Tanjakan Robo, Lari Robo, Bola Gabung; jatah setoran harian bersama setara 15 bintang), lengkap dengan musik dan efek suara. Tampilan Lari Robo dan ikon kartu ketiga game (Tanjakan Robo, Bola Gabung, Lari Robo) dilukis ulang (kota senja, robot bersyal, bola sungguhan); koin tidak lagi menempel pada rintangan. Mobil di Tanjakan Robo kini lebih kuat menanjak (bantuan menanjak di lereng naik). Tes: `npm run verify:syrobo`, `npm run verify:tanjakan`, `npm run verify:bola`, dan `npm run verify:lari`.
- **Quiz kelompok berrubrik**: pengajar/admin mengisi tabel rubrik (jumlahnya bebas 1-10, boleh ditambah atau dihapus; poin penilaian ditambah sendiri, skala 1 sangat kurang sampai 4 sangat baik) dan menentukan **minimal serta maksimal anggota** per kelompok (2-20, bawaan 2-10). Sebelum mulai satu siswa membuat kelompok: mengisi nama kelompok dan anggotanya (ketik sendiri atau pilih dari anggota kelas). Anggota yang dipilih dari kelas mendapat tombol **Ikuti Quiz “nama kelompok”** dan, setelah menekannya, langsung ikut mengerjakan **satu lembar jawaban bersama**: apa yang ditulis anggota lain tampil di layar semua anggota (diperbarui tiap beberapa detik). Siapa pun di kelompok boleh mengumpulkan. Ada dua nilai yang berdiri sendiri: **nilai kelompok** (poin soal yang diatur pengajar; soal esai dan tabel dinilai manual oleh pengajar/admin, nilai menunggu persetujuan) dan **nilai individu** (rubrik, diberi pengajar untuk tiap anggota satu per satu). Ekspor spreadsheet berisi satu baris per anggota. Tes: `npm run verify:quiz-rubrik`.
- **Roda pemilih** (`/educator/classes/<id>/wheel`, pintasan di bawah kotak kode undangan):
  roda untuk mengundi siswa yang menjawab. Bisa membuat beberapa roda per kelas, mengisinya
  dengan anggota kelas dan/atau nama sendiri, dan menyesuaikan nama, warna, lama putaran, serta
  opsi mengeluarkan pemenang otomatis, warna kustom sendiri, dan pop-up nama pemenang di
  tengah layar (layar diburamkan 2 detik). Roda tersimpan di peramban pengajar (tidak di server).
- Di dalam kelas ada pengumuman/postingan dan balasan. Pengumuman boleh
  berlampiran berkas (atau berkas saja tanpa teks), dan isi serta lampirannya
  bisa diedit setelah terbit. Alamat web (`https://…` / `www.…`) di isi pengumuman, tugas, dan balasan
  otomatis menjadi tautan yang bisa diklik (dibuka di tab baru).
- **Tema kustom** (profil → Pengaturan Laman → Tampilan → *Kustom*): selain Gelap & Terang, pengguna menyusun
  palet sendiri dari empat warna (Latar, Kartu, Teks, Aksen) lewat pemilih warna atau kode `#RRGGBB`, atau memulai
  dari contoh (Samudra, Hutan, Senja, Kertas, Es). Seluruh situs berubah seketika, bertahan setelah muat ulang
  (tersimpan di perangkat ini), dan ada peringatan bila kontras tulisan terlalu rendah.
- **Banner kelas** (pengajar/admin): di tab Tentang → Pengaturan kelas (juga saat membuat kelas) ada isian
  *Banner kelas*. Gambar lebar dikecilkan otomatis (maks 1600 px, JPEG < 2 MB) dan tampil penuh di belakang
  kepala ruang kelas (digelapkan agar tulisan tetap terbaca) bagi semua anggota. Bisa diganti atau dihapus.
- **Banner quiz**: di pembuat quiz ada isian *Banner quiz*; gambarnya melatari judul + deskripsi quiz, baik di
  kartu quiz maupun di halaman quiz siswa (digelapkan agar tulisan tetap terbaca). Bisa diganti atau dibuang.
- **Mengeluarkan siswa** (pengajar/admin): tombol *Keluarkan* di tab Anggota kelas dan di halaman
  Kelola anggota, dengan dialog konfirmasi. Hanya keanggotaan yang dihapus (jawaban tugas & quiz
  tetap tersimpan); siswa bisa bergabung lagi dengan kode undangan selama kodenya belum diganti.
- **Quiz kelas** (tab **Quiz**, di kanan Tugas): pengajar/admin membuat quiz ala Google Form di
  `/educator/classes/<id>/quiz/new` - tiap nomor bisa **pilihan ganda** (dengan kunci), **esai**, atau **tabel** (pengajar mengatur jumlah baris & kolom; tiap sel dijadikan teks tetap, mis. judul, atau sel isian siswa yang dikosongkan untuk diisi; tabel tidak punya kunci jawaban, pengajar memeriksa isiannya dan memberi poin sendiri). Quiz bisa **individu** atau **kelompok**: pada quiz kelompok satu siswa membuat kelompok (nama + anggota) dan anggotanya mengerjakan bersama lewat tombol Ikuti Quiz (nama kelompok tampil di Pantau beserta ringkasan per kelompok dan di ekspor spreadsheet),
  punya poin sendiri, total TEPAT 100 saat diterbitkan (ada tombol *Bagi rata poin*). Setelan: **jadwal mulai**
  (hari/tanggal/jam WIB, atau langsung terbuka begitu diterbitkan), acak
  urutan soal & pilihan per siswa (sulit mencontek), batas waktu pengerjaan (habis → otomatis
  dikumpulkan; jawaban tersimpan otomatis), tambahan waktu untuk semua atau satu siswa, tutup/buka
  quiz. Pilihan ganda dinilai otomatis, esai dinilai pengajar. Tiap quiz punya **papan peringkat
  1-3** di kanannya (nilai tertinggi, seri → tercepat; hanya yang sudah dinilai penuh). Setelah
  quiz ditutup siswa melihat nilai & kunci jawaban. Setelah ada yang mengerjakan, soal terkunci
  (poin masih bisa diubah, nilai dihitung ulang). Halaman **Pantau** (dibuka dengan tombol *Pantau* pada tiap quiz, pengelola saja; bukan tab):
  siapa belum/sedang/sudah mengerjakan, jam mulai-selesai, lama, nilai, umpan aktivitas, nilai esai,
  izinkan mengulang. Satu percobaan per siswa. Di Pantau juga ada: **Analisis soal** (soal mana paling banyak
  tidak benar, jawaban paling banyak dipilih, kunci jawaban, semuanya dalam persen), **Ekspor spreadsheet**
  (.xlsx berisi nama & poin, aktif setelah semua esai dinilai), dan **Peringatkan murid** (siswa yang belum
  memulai melihat peringatan selebar layar + alarm 2 detik; ada jeda 20 detik antar kiriman).
- **Arsip** (pengajar/admin): tombol *Arsipkan* di tiap pengumuman/tugas memindahkannya ke
  tab **Arsip** (di kanan tab Tugas; hanya pengelola yang melihatnya). Yang terarsip
  hilang total bagi siswa (umpan, daftar tugas, lampiran, balasan, pengumpulan baru) tetapi
  datanya utuh; di zona Arsip bisa dibuka, **Pulihkan**, atau dihapus permanen.
- **Berkas pendukung kursus**: PDF, gambar, dan TXT dibuka langsung di tab baru dan tetap bisa diunduh lewat tombol "Unduh"; Office/ZIP langsung diunduh. Kartu objek 3D di pengumuman kini berlabel "3D" tebal (bukan ikon kubus).
- **Objek 3D di materi kursus** (pemilik kursus/admin, form buat & sunting kursus, bagian Isi kursus): pelajaran Modul/Bacaan dan Video boleh melampirkan satu berkas `.glb` (maks 20 MB) dengan judul dan keterangan per komponen, sama seperti pengumuman kelas. Peserta yang berhak hanya melihatnya di ruang belajar (kotak berjudul yang bisa dibuka); tak ada jalan bagi mereka untuk mengubah objek atau keterangannya. Berkas diunggah ke `class-files/{uid}/course-3d/` dan disajikan `/api/courses/[slug]/model`. Tes: `npm run verify:kursus-3d`.
- **Objek 3D di pengumuman** (educator/admin pemilik kelas): lampirkan berkas
  `.glb` (maks 20 MB) dari kotak tulis, lengkap dengan **judul** objek. Di umpan, murid
  melihat kotak berjudul dulu; diklik, kotaknya memanjang ke bawah (itulah "pintunya")
  dan memperlihatkan objeknya (berkas baru diunduh saat dibuka pertama kali) -
  diputar dengan seret atau tombol putar (per sisi: depan → kanan → belakang → kiri), di-zoom dengan gulir/tombol +/-, bisa layar penuh. Pengajar
  menambah keterangan dengan mengeklik bagian objek (judul + penjelasan per titik/komponen);
  tab **Pratinjau** menampilkan persis apa yang dilihat murid. Saat murid mengeklik
  titik/komponen berketerangan (komponen tanpa keterangan tidak bisa disentuh), muncul kartu **hologram** yang ditarik garis ke titik itu,
  dan komponennya menyala. Objek & keterangan bisa diedit atau dibuang setelah terbit.
  Satu komponen hanya boleh punya satu keterangan (komponen yang sudah berketerangan
  hanya dipilih saat diklik di editor, tidak menambah yang baru).
- **Tugas** (mirip Google Classroom), diterbitkan pengajar dari kotak tulis yang
  sama dengan memilih "Tugas":
  - judul, instruksi, dan lampiran berkas (opsional);
  - format jawaban yang diterima, dipilih **per jenis berkas** dan boleh lebih
    dari satu: **teks** yang diketik langsung, **PDF**, **JPG**, **PNG**,
    **Word (.docx)**, **PowerPoint (.pptx)**, **Excel (.xlsx)**, **ZIP** —
    misalnya "hanya .docx". Di formulir dikelompokkan (Teks · PDF & gambar ·
    Dokumen Office · Arsip) dengan tombol *Pilih semua* per kelompok;
  - **tenggat** opsional (ditulis & ditampilkan dalam WIB) dan pilihan
    **menerima pengumpulan setelah tenggat** (ditandai "Terlambat");
  - nilai maksimal (bawaan 100).

  Setelah terbit, tugas tetap bisa **diedit** lewat tombol *Edit tugas* di
  halaman tugas (atau *Edit* di umpan): judul, instruksi, lampiran (tambah /
  buang), format, tenggat (termasuk memperpanjang atau menutup lebih awal),
  izin terlambat, dan nilai maksimal. Kiriman yang sudah masuk tidak berubah,
  dan nilai maksimal tidak bisa diturunkan di bawah nilai yang sudah
  diberikan. Postingan yang disunting diberi tanda *diedit*.
- Siswa melihat semua tugas di tab **Tugas** beserta statusnya (belum
  mengumpulkan / dikumpulkan / terlambat / dinilai), lalu mengumpulkan di
  halaman tugas `/kelas/[id]/tugas/[postId]`. Selama belum dinilai dan
  pengumpulan masih dibuka, kiriman bisa **dibatalkan lalu dikirim ulang**
  (berkas yang sudah dikirim ikut terhapus).
- Pengajar melihat daftar seluruh siswa per tugas di
  `/educator/classes/[id]/tugas/[postId]`, membuka atau mengunduh jawabannya (PDF, gambar, dan TXT langsung terbuka di tab baru tanpa diunduh; Office/ZIP tetap diunduh), lalu memberi
  **nilai + komentar** yang langsung terlihat oleh siswa. Di layar lebar, kolom
  kiri (instruksi & daftar siswa) dan kolom kanan (Ringkasan & Koreksi AI)
  digulir terpisah, sehingga pengaturan AI tetap terjangkau saat menilai.
- Batas: maksimal 5 berkas per postingan/kiriman, masing-masing di bawah 20 MB.
  Siswa tidak bisa melihat jawaban siswa lain.
- **Koreksi dengan AI** (per siswa, di halaman tugas pengajar):
  - tombol di setiap kiriman mengisi kolom **nilai** otomatis (skala nilai
    maksimal tugas). Pengajar tetap meninjau, boleh mengubah, lalu menekan
    *Simpan nilai* sendiri — AI tidak pernah menyimpan;
  - centang **"AI juga mengisi komentar"** (bawaannya diatur per tugas, bisa
    diubah per siswa). Kalau tidak dicentang, catatan AI tetap ditampilkan
    sebagai petunjuk dengan tombol *Pakai sebagai komentar*;
  - kartu **Koreksi AI** berisi **Konteks untuk AI**: satu kotak teks bebas
    (maks. 4.000 karakter) plus berkas opsional (maks. 3 PDF, gambar, atau
    Office). Isinya boleh apa saja dan tanpa format khusus — soal, kunci
    jawaban, rubrik & bobot, rentang nilai, panjang atau gaya komentar — AI
    memahami maksudnya sendiri (skala nilai lain dikonversi ke nilai maksimal
    tugas). Konteks **tidak pernah terlihat siswa**. Pengajar juga memilih apakah
    AI ikut membaca **instruksi & lampiran tugas** atau **hanya konteks** itu;
  - AI membaca **seluruh isi** dokumen: jawaban teks, gambar JPG/PNG, PDF
    (teks **dan** gambar di dalamnya, termasuk PDF hasil pindai/foto), serta
    DOCX/PPTX/XLSX beserta **gambar di dalamnya**, kotak teks, catatan kaki,
    header/footer, komentar, rumus (dibaca linear, mis. `x^(2)`), angka
    grafik, dan teks SmartArt. Posisi tiap gambar ditandai di teks ("[Gambar 2]")
    sehingga AI tahu gambar mana menjawab soal mana;
  - yang **tidak** terbaca selalu muncul sebagai **peringatan** di bawah tombol
    koreksi, lengkap dengan lokasi & sebabnya: isi ZIP, gambar format EMF/WMF,
    gambar yang hanya tautan internet, bentuk garis/panah/coretan tinta di
    Word, diagram/grafik garis (vektor) di PDF, halaman PDF di luar 30 halaman
    pertama, teks yang melebihi batas, dan gambar di atas jatah (2 gambar
    soal/konteks + 3 gambar jawaban sekali koreksi, maks. 4 MB per gambar).
    AI juga diberi tahu bagian mana yang hilang supaya tidak menilainya
    seolah kosong;
  - memakai OpenRouter (model gratis), berbagi kuota harian dengan asisten chat
    dan "Minta Saran AI" kursus, maksimal 8 koreksi per menit per pengajar.
    Jawaban siswa dikirim ke layanan AI pihak ketiga saat dikoreksi.

### Profil & akun

- **Profil** (`/profil`): foto, perkenalan, riwayat pendidikan, keahlian,
  statistik belajar/mengajar, sertifikat.
- **Profil publik** (`/profil/[uid]`): versi yang dilihat orang lain, tanpa
  email dan nomor HP. Menampilkan kursus yang diikuti (beserta kemajuannya)
  dan, untuk educator, kursus yang dibuat. Kursus yang diikuti hanya tampil
  untuk educator dan pengguna yang pernah menulis komentar publik; tidak
  pernah untuk admin.
- **Mini-profil di komentar**: memencet foto/nama penulis komentar di beranda
  membuka kartu berisi banner, kursus yang diikuti (+ kemajuan), dan kursus
  yang dibuat bila educator. Akun admin menampilkan tulisan "FORBIDDEN".
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

Admin juga bisa membuat kursus dan kelas seperti educator (menu "Kursus Saya" dan
"Kelas Saya" di navbar), ditambah fitur admin di bawah.

| Menu | Isi |
|---|---|
| Notifikasi | Pengajuan menjadi educator |
| Pengajuan Kursus | Tayang, sembunyikan, sunting, dan hapus kursus, dengan perbandingan perubahan |
| Pembayaran | Saklar metode bayar, gambar QRIS, **potongan platform & persentase referral**, bukti bayar yang menunggu, penjualan yang perlu ditindaklanjuti |
| Premium | Harga premium, beri/cabut premium per akun, anggota aktif, dan **bagi hasil** periode yang sudah berakhir ke educator |
| Kategori | Kategori kursus |
| Kelas | Seluruh kelas |
| Ulasan | Moderasi ulasan dan **balasan admin** (tampil di kartu komentar beranda dan halaman kursus) |
| Akun | Seluruh akun dan rolenya, dengan **pencarian** dan saringan peran; admin dapat **membuat akun**, **mengubah role**, dan **mengganti kata sandi** (sandi lama tidak bisa dilihat, hanya diganti) |

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

### Moderasi nama & foto akun

Admin dapat mengganti nama dan foto profil akun mana pun (atau menghapus fotonya) di
`/admin/users/<uid>`, untuk menertibkan nama/foto yang tidak pantas.

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
| `npm run realise:sales -- --apply` | Mencatat penjualan lama ke buku royalti (pesanan Premium dilewati) |
| `npm run settle:premium -- --apply` | Membagi hasil periode Premium yang sudah berakhir (sama dengan tombol di `/admin/premium`; boleh dijalankan berkala) |

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
npm run verify:flowchart          # flowchart: ekspresi, mesin jalan, pemeriksa, tautan (murni)
npm run verify:pseudocode         # interpreter pseudocode 9618: bahasa, galat & baris, jejak (murni)
npm run verify:kode               # lab kode: tautan, berkas, penyorot, saran Python, CSP worker (murni)
npm run verify:sorting            # Lab Sorting: hasil stabil, langkah, baris kode, pseudocode dijalankan, tautan (murni)
npm run verify:searching          # Lab Searching: hasil, Kiri/Tengah/Kanan, baris kode, pseudocode dijalankan, tautan (murni)
npm run verify:premium-rules      # Premium: perpanjangan, bagi hasil, Σ = dibayar (murni)
npm run verify:premium            # Premium: akses, pembayaran, cabut, bagi hasil, naik ke paid (dev server)
npm run verify:berkas-ai          # pembaca berkas koreksi AI: gambar di DOCX/PPTX/XLSX/PDF, PDF pindaian, peringatan (murni)
npm run verify:class-assignment   # tugas kelas: format, tenggat, nilai, berkas, pembersihan
npm run verify:chat-knowledge     # pengetahuan asisten sejalan dengan halaman situs (murni)
```

---

## Yang belum ada

- Penarikan dana / payout untuk royalti dan referral.
- Refund otomatis. Kabar refund dari Midtrans hanya ditandai untuk ditindaklanjuti admin.
- Notifikasi email (keputusan pengajuan, penilaian tugas, dsb.).
- Soal kuis selain pilihan tunggal.
- Materi SynapLab lain (string, stack/queue, tree, visualisasi data), linked list ganda (doubly) dan melingkar (circular), serta algoritma pengurutan & pencarian lain di Lab Sorting/Searching (mis. quick sort, jump search).
- Menyimpan & menamai papan SynapLab, dan menautkannya ke kelas atau pelajaran kursus.
- Flowchart: titik belok garis yang diatur manual, pinch-zoom di layar sentuh,
  subproses yang benar-benar memanggil flowchart lain, dan perulangan `for` di
  simbol Persiapan (sekarang ditulis sebagai penugasan + Keputusan).
- Tugas kelas: mengembalikan tugas ke siswa untuk diperbaiki, nilai untuk siswa yang tidak mengumpulkan,
  rekap nilai per kelas, dan koreksi AI untuk semua siswa sekaligus.
- Koreksi AI untuk isi arsip ZIP, gambar garis/diagram vektor di PDF, dan lebih
  dari 5 gambar sekali koreksi (model gratis yang dipakai baru diverifikasi
  sampai jumlah itu).
- Lab Python: paket di luar pustaka standar (numpy, dll.), grafik/turtle, dan
  input interaktif saat program berjalan (masukan diisi di muka). Pyodide
  masih dari CDN — tanpa internet lab Python tidak bisa dibuka.
- Lab Pseudocode: `TYPE` (record, enum, pointer, set), operasi berkas
  (`OPENFILE` dkk.), OOP, tipe `DATE` dan fungsi tanggal.
- Menghubungkan lab kode ke tugas kelas (mengumpulkan & menilai kode).

---

## Riwayat singkat

Bermula dari Laravel + Blade, pindah ke Next.js + NestJS/Prisma, lalu ke
Firebase. Data empat kursus awal dimigrasikan dari array PHP. Akun lama
diimpor beserta hash kata sandinya, jadi kata sandi lama tetap berlaku.
