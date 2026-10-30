/**
 * Pengetahuan Asisten SynapEd tentang situs ini — apa yang bisa dilakukan
 * pengguna dan bagaimana caranya.
 *
 * WAJIB DIPERBARUI bersama setiap perubahan fitur yang terlihat pengguna,
 * sama seperti README.md (aturan di CLAUDE.md). Asisten hanya tahu apa yang
 * tertulis di sini: fitur yang tidak tercantum akan dijawab "tidak tahu",
 * dan fitur yang sudah berubah akan dijelaskan dengan cara lama — keduanya
 * pernah terjadi (asisten sempat bersikeras kursus berbayar belum bisa
 * dibeli berminggu-minggu setelah pembayaran aktif).
 *
 * Yang TIDAK ditulis di sini karena dibaca langsung dari sistem setiap
 * permintaan (lihat chatPrompt.ts): katalog kursus, metode pembayaran yang
 * sedang aktif, persentase referral, dan kontak resmi. Daftar halaman yang
 * boleh ditautkan ada di chatLinks.ts dan diperiksa `verify-chat-knowledge`.
 *
 * Tulis apa adanya (perilaku SISTEM SEBENARNYA, bukan rencana), dan jangan
 * memuat detail teknis internal — asisten dilarang membocorkannya.
 *
 * Modul netral tanpa impor supaya skrip verifikasi bisa membacanya.
 */
export const PENGETAHUAN_SITUS = `## Akun
- Daftar di /register atau masuk di /login dengan email + kata sandi, atau
  tombol "Masuk dengan Google" (sekaligus mendaftar kalau emailnya belum ada).
- Ada tiga jenis akun: pengguna, educator, dan admin.
- Profil (/profil) berisi kursus & kelas yang diikuti, tombol Lanjutkan
  Belajar, dan sertifikat. Foto, perkenalan, riwayat pendidikan, dan keahlian
  diubah di /profil/edit. Orang lain melihat profil publik tanpa email, nomor
  HP, atau kursus yang sedang diikuti.
- Pengaturan (/pengaturan): username, nomor HP, email, kata sandi, cara
  masuk, dan hapus akun. Username dibuat otomatis dari email dan bisa diganti
  sekali setiap 14 hari. Akun Google tanpa kata sandi bisa membuat kata sandi
  di sana.

## Belajar di kursus
- Katalog ada di /courses, bisa disaring per kategori. Halaman detail kursus
  menampilkan deskripsi, kurikulum, ulasan, harga, dan penyusunnya.
- Kursus gratis: tekan "Daftar Kursus Ini" (harus masuk dulu). Kursus berbayar:
  tekan "Beli Kursus Ini" — metode bayarnya lihat bagian "Info terkini".
- Jenis pelajaran: bacaan (PDF yang dibaca di halaman, bisa diperbesar dan
  diunduh), video (YouTube), penugasan (peserta mengunggah berkas jawaban lalu
  educator menilai), dan kuis (pilihan ganda, dinilai otomatis).
- Kemajuan tersimpan otomatis; tombol "Lanjutkan Belajar" membawa kembali ke
  pelajaran terakhir. Bacaan/video ditandai selesai lewat tombol di halaman
  belajar, penugasan dianggap selesai saat dikumpulkan, kuis saat lulus.
- Kuis punya nilai lulus dan bisa punya batas jumlah percobaan. Pembahasan
  tiap soal baru tampil setelah lulus atau kehabisan percobaan.
- Penugasan kursus bisa dikumpulkan ulang; mengumpulkan ulang menghapus nilai
  lama dan menunggu dinilai lagi.
- Sertifikat terbit otomatis setelah SEMUA pelajaran selesai DAN nilai tugas &
  kuis mencapai nilai lulus kursus (bawaan 70). Penugasan harus sudah dinilai
  educator dulu. Sertifikat dilihat & dicetak dari /profil; siapa pun bisa
  memeriksa keasliannya di /verify/{kode} tanpa masuk akun.
- Peserta yang sudah menyelesaikan kursus bisa memberi ulasan bintang dan
  komentar. Semua komentar peserta bisa dibaca di /komentar.
- /dashboard merangkum kursus dan kelas yang sedang diikuti (dan, untuk
  educator, yang dibuatnya).

## Membeli kursus
- Pembelian lewat Midtrans membuka akses otomatis begitu pembayaran masuk.
- Pembelian lewat QRIS manual: pindai QR, unggah bukti bayar, lalu admin
  mencocokkannya dengan mutasi rekening sebelum akses dibuka. Pesanan QRIS
  manual berlaku 24 jam.
- Kode referral: pembeli bisa memasukkan kode orang lain saat membeli, atau
  kode terisi sendiri kalau membuka tautan bagikan (berlaku 30 hari). Harga
  bagi pembeli TIDAK berubah. Kode milik sendiri tidak bisa dipakai.
- Pengembalian dana: pembelian bersifat final, kecuali beberapa keadaan
  (misalnya terbayar ganda, akses terkunci dan tidak terselesaikan dalam 7
  hari kerja, atau isi kursus tidak sesuai yang dijanjikan). Pengajuan lewat
  email paling lambat 7 hari kalender sejak pembayaran. Rinciannya di
  /pengembalian-dana — jangan menjanjikan pengembalian di luar itu.

## Kode referral & pendapatan
- Setiap akun bisa membuat SATU kode referral di /dashboard/pendapatan. Kode tidak bisa
  diganti setelah dibuat.
- Tombol "Bagikan dengan kode referral" di halaman kursus mana pun membuat
  tautan berisi kode itu. Pemilik kode mendapat bagian dari setiap pembelian
  lewat tautannya (persentasenya lihat "Info terkini").
- /dashboard/pendapatan menampilkan total pendapatan (royalti + referral), riwayat per
  penjualan, dan kursus tempat ia berkontribusi. Data pembeli tidak pernah
  ditampilkan.
- Penarikan dana BELUM tersedia; dashboard hanya mencatat pendapatan.

## Kelas
- Kelas adalah ruang belajar kelompok milik educator, terpisah dari kursus.
- Educator membuat kelas di /educator/classes lalu membagikan kode undangan
  8 karakter. Peserta bergabung di /kelas dengan memasukkan kode itu. Peserta
  bisa keluar dari kelas kapan saja.
- Di dalam kelas ada tab Pengumuman (pengumuman pengajar, boleh berlampiran;
  anggota bisa membalas), Tugas, Anggota, dan Tentang. Hanya pengajar yang
  bisa memposting. Pengajar juga bisa melampirkan objek 3D (berkas .glb) di
  pengumuman: tampil sebagai kotak berjudul yang dibuka murid dengan mengeklik
  judulnya (kotaknya memanjang ke bawah), lalu murid bisa memutar, memperbesar, dan
  mengeklik komponen yang diberi keterangan untuk membaca keterangannya dalam kartu hologram; pengajar menulis keterangan tiap
  komponen dan punya mode Pratinjau sebelum mengirim.
  Pengajar juga bisa mengarsipkan pengumuman atau tugas (hilang dari tampilan siswa,
  tersimpan di tab Arsip (di kanan tab Tugas) yang hanya terlihat pengajar, bisa dipulihkan).
  Tab Quiz (di kanan Tugas): pengajar membuat quiz pilihan ganda dan esai seperti
  Google Form dengan poin tiap nomor (total 100), setelan jadwal mulai (hari, tanggal, jam; atau langsung dibuka), acak urutan soal per siswa,
  batas waktu (habis waktu otomatis dikumpulkan) dan tambahan waktu. Siswa mengerjakan satu
  kali, tiap quiz punya papan peringkat 1-3 (nilai tertinggi, seri dipilih yang tercepat),
  dan kunci jawaban baru terbuka setelah pengajar menutup quiz. Pengajar memantau siswa lewat tombol Pantau
  pada tiap quiz. Di halaman Pantau ada analisis soal (soal yang paling banyak salah, jawaban terbanyak,
  kunci, dalam persen), ekspor spreadsheet nama dan poin (setelah semua esai dinilai), dan tombol
  Peringatkan murid (siswa yang belum mengerjakan melihat peringatan layar penuh dengan bunyi alarm 2 detik).
  Alamat web yang ditulis di pengumuman otomatis bisa diklik.
  Objek 3D di pengumuman punya mode layar penuh dengan kontrol gerakan tangan lewat kamera: tangan terbuka bergerak
  memutar objek, telunjuk saja untuk menunjuk komponen dan menampilkan keterangannya (tahan sebentar), dua jari naik-turun untuk zoom, kepalan untuk jeda (kamera hanya diproses di perangkat, tidak direkam).
  Tampilan situs bisa Gelap, Terang, atau Kustom (profil, Pengaturan Laman): pengguna menyusun palet sendiri
  dari empat warna (latar, kartu, teks, aksen); pilihan tersimpan di perangkat itu saja.
  Quiz juga bisa diberi banner yang melatari judul dan deskripsinya.
  Pengajar bisa memasang banner kelas (gambar lebar di kepala ruang kelas) lewat Pengaturan kelas.
  Pengajar bisa mengeluarkan siswa dari kelas (tab Anggota); jawaban siswa tetap tersimpan.
  Pengajar bisa mengedit pengumuman dan tugas setelah terbit
  (judul, instruksi, lampiran, format, tenggat, nilai maksimal); kiriman siswa
  yang sudah masuk tidak berubah.
- Tugas kelas: pengajar menentukan format jawaban yang diterima, satu per
  jenis berkas (teks yang diketik langsung, PDF, JPG, PNG, Word .docx,
  PowerPoint .pptx, Excel .xlsx, atau ZIP — misalnya "hanya .docx"), tenggat opsional dalam WIB, apakah pengumpulan setelah tenggat masih
  diterima (ditandai "Terlambat"), dan nilai maksimal.
- Peserta mengumpulkan di halaman tugas: maksimal 5 berkas, masing-masing di
  bawah 20 MB. Selama belum dinilai dan pengumpulan masih dibuka, kiriman bisa
  dibatalkan lalu dikirim ulang (berkas yang sudah dikirim ikut terhapus).
  Setelah dinilai, peserta melihat nilai + komentar pengajar dan kiriman tidak
  bisa dibatalkan lagi. Peserta tidak bisa melihat jawaban peserta lain.
- Status tugas: belum mengumpulkan, dikumpulkan, terlambat, dinilai.
- Pengajar bisa menekan "Koreksi dengan AI" pada kiriman tiap siswa: AI mengisi
  nilai (dan komentar, kalau pengajar memintanya), lalu pengajar meninjau,
  boleh mengubah, dan menyimpannya sendiri. Nilai baru terlihat siswa setelah
  disimpan pengajar. Di kartu Koreksi AI, pengajar bisa menulis "Konteks untuk
  AI" secara bebas (soal, kunci jawaban, rubrik, rentang nilai, panjang atau
  gaya komentar) dan/atau mengunggah berkas konteks; AI memahami isinya
  sendiri, dan konteks ini tidak pernah terlihat siswa. AI bisa ikut membaca
  instruksi & lampiran tugas, atau hanya konteks dari pengajar. Jawaban ZIP dan
  PDF hasil pindai belum bisa dibaca AI.

## Menjadi educator
- Ajukan diri lewat tombol "Jadi Educator" di navbar atau halaman /educator.
  Tidak ada persyaratan khusus; admin meninjau dan hasilnya tampil di halaman
  yang sama.
- Educator membuat kursus di /educator/courses: judul, deskripsi, harga,
  kategori, gambar sampul, nilai lulus, dan kurikulum bebas berisi bacaan,
  video, penugasan, dan kuis.
- Kursus baru tersembunyi dulu. Menayangkan, menyembunyikan, menyunting, dan
  menghapus kursus semuanya diajukan ke admin; kursus yang tayang tetap seperti
  semula sampai perubahannya disetujui.
- Kursus bisa disusun beberapa orang (maksimal 10, dicari lewat username, tidak
  harus educator). Pemilik mengatur persentase tiap kontributor; bagian pemilik
  minimal 10%. Bagian penyusun dihitung dari penjualan setelah potongan
  platform, dan perubahan pembagian hanya berlaku untuk penjualan berikutnya.
- Educator menilai penugasan kursus di halaman peserta kursusnya. Tombol
  "Minta Saran AI" mengisi draf nilai + catatan, tetapi educator tetap harus
  meninjau dan menyimpannya sendiri.

## SynapLab
- /lab adalah papan untuk memahami struktur data dan pemrograman sambil
  mencobanya, terbuka untuk siapa saja tanpa login.
- Materi: Array (1D, 2D, 3D yang tampil sebagai kubus yang bisa diputar, dan
  N-dimensi) serta Linked List (singly). Operasi dijalankan lewat tombol dan
  form, bukan menulis kode, lalu diputar langkah demi langkah dengan narasi
  Bahasa Indonesia; kecepatannya bisa diatur.
- Ada lima algoritma pengurutan dengan animasi: bubble, selection, insertion,
  merge, dan quick sort.
- Papan bisa dibagikan lewat tautan, tetapi tidak tersimpan di server —
  menutup tab berarti papannya hilang. Ada juga mode presentasi.
- Flowchart (Lab 03): menggambar flowchart dengan simbol standar
  (Mulai/Selesai, Proses, Input/Output, Keputusan, Persiapan, Subproses,
  Konektor, Dokumen, Data, Catatan), menyambungnya dengan menyeret bulatan di
  sisi simbol, lalu memeriksa aturannya (tab Periksa) dan MENJALANKANNYA langkah
  demi langkah (tab Jalankan) dengan variabel, masukan, dan keluaran.
  Bentuk baku penulisannya gaya Cambridge (IGCSE/O Level), sama dengan Lab 05:
  START/STOP, "INPUT X", "OUTPUT Total", penugasan "Total ← Total + X" (ketik
  <- untuk ←), kondisi "X MOD 2 = 0?", AND/OR/NOT, cabang Yes/No. Tulisan gaya
  lama (Baca, Tampilkan, x = x + 1, Ya/Tidak) tetap bisa dijalankan, hanya
  disarankan diganti di tab Periksa. Daftar lengkap perintahnya ada di tab
  Panduan pada panel kanan. Flowchart bisa dibagikan lewat tautan,
  disimpan/dibuka sebagai berkas .json, dan diekspor ke PNG atau SVG. Ada
  contoh siap pakai.
- Python (Lab 04): menulis dan menjalankan Python 3 sungguhan langsung di
  browser (tanpa install, tanpa akun). Masukan untuk input() diisi di muka di
  kotak Masukan, satu nilai per baris. Tombol "Langkah demi langkah" memutar
  ulang program baris per baris: baris aktif disorot, tabel variabel (termasuk
  variabel di dalam fungsi), dan keluaran. Galat ditampilkan dengan nomor
  baris dan saran berbahasa Indonesia. Pustaka standar tersedia; paket
  tambahan seperti numpy belum bisa dipasang, dan akses internet dari kode
  dimatikan. Satu kali jalan maksimal 10 detik (ada tombol Stop). Pertama kali
  dibuka perlu mengunduh Python ±12 MB.
- Pseudocode (Lab 05): pseudocode gaya Cambridge International AS & A Level
  9618 (DECLARE, INPUT/OUTPUT, IF/CASE, FOR/WHILE/REPEAT, ARRAY 1D & 2D,
  PROCEDURE/FUNCTION dengan BYVAL/BYREF, fungsi teks seperti LENGTH, MID,
  LEFT). Bisa dijalankan dan diikuti langkah demi langkah seperti lab Python.
  Kata kunci ditulis huruf besar dan setiap variabel wajib di-DECLARE dengan
  tipenya; galat menyebut barisnya dan cara memperbaikinya. Belum mendukung
  TYPE (record), operasi berkas, dan OOP. Panduan singkat ada di panel lab.
- Kode Python dan pseudocode bisa dibagikan lewat tautan atau disimpan/dibuka
  sebagai berkas (.py/.txt). Masing-masing punya contoh siap pakai.

## Yang belum tersedia
Penarikan dana pendapatan, notifikasi email, pengembalian dana otomatis,
dan menyimpan papan SynapLab ke akun. Kalau
ditanya, katakan terus terang bahwa fitur itu belum ada.`;
