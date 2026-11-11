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

## SynapEd Premium
- Premium membuka SEMUA kursus publik berbayar selama 30 hari dengan satu
  pembayaran (harganya lihat "Info terkini"). Beli atau perpanjang di /premium,
  lewat metode bayar yang sama dengan membeli kursus; kode referral berlaku.
  Tautan "Premium" ada di navbar; kartu kursus berbayar bertanda "Termasuk Premium".
- Pelajar maupun educator boleh membeli Premium. Educator mendapat akses ke
  kursus educator lain; kursusnya sendiri tetap ia kelola seperti biasa.
- Tidak ada langganan otomatis: membeli lagi saat masih aktif menambah 30 hari
  di belakang tanggal berakhir, jadi sisa hari tidak hilang.
- Anggota premium membuka kursus berbayar dengan tombol "Pelajari dengan
  Premium" di halaman kursus. Kursus gratis tetap gratis untuk semua orang;
  kursus privat tidak termasuk; kursus milik sendiri tidak perlu premium.
- Kalau premium berakhir atau dicabut, akses kursus yang dibuka lewat premium
  berhenti, tetapi kemajuan, nilai, dan sertifikat tetap tersimpan. Perpanjang
  untuk melanjutkan, atau beli kursusnya (kemajuannya ikut terbawa).
- Status dan tanggal berakhir tampil di /premium dan /dashboard; lencana
  "Premium" muncul di navbar dan profil. Pengingat muncul 5 hari sebelum berakhir.
- Ketika menjelaskan Premium ke calon pembeli, tekankan manfaatnya. Hanya bila
  EDUCATOR bertanya soal pendapatan: uang premium dibagikan ke educator kursus
  yang benar-benar dipelajari anggota, sebanding dengan pelajaran yang
  diselesaikan, dan tampil di /dashboard/pendapatan berlabel "Premium".

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
  Tab Quiz (di kanan Tugas): pengajar membuat quiz pilihan ganda, esai, dan tabel seperti
  Google Form (soal tabel: pengajar mengatur jumlah baris dan kolom, sel isian dikosongkan untuk siswa dan
  diperiksa pengajar sendiri tanpa kunci jawaban;
  quiz bisa individu atau kelompok, pada quiz kelompok satu siswa membuat kelompok dan anggotanya mengerjakan bersama) dengan poin tiap nomor (total 100), setelan jadwal mulai (hari, tanggal, jam; atau langsung dibuka), acak urutan soal per siswa,
  batas waktu (habis waktu otomatis dikumpulkan) dan tambahan waktu. Siswa mengerjakan satu
  kali, tiap quiz punya papan peringkat 1-3 (nilai tertinggi, seri dipilih yang tercepat),
  dan kunci jawaban baru terbuka setelah pengajar menutup quiz. Pengajar memantau siswa lewat tombol Pantau
  pada tiap quiz. Di halaman Pantau ada analisis soal (soal yang paling banyak salah, jawaban terbanyak,
  kunci, dalam persen), ekspor spreadsheet nama dan poin (setelah semua esai dinilai), dan tombol
  Peringatkan murid (siswa yang belum mengerjakan melihat peringatan layar penuh dengan bunyi alarm 2 detik).
  Alamat web yang ditulis di pengumuman otomatis bisa diklik.
  Pemilik kursus dan admin juga bisa melampirkan satu objek 3D (.glb) beserta keterangan tiap komponen pada pelajaran Modul/Bacaan dan Video saat membuat atau menyunting kursus; peserta hanya bisa melihatnya di ruang belajar, tidak bisa mengubahnya.
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

## Quiz kelompok & rubrik
- Quiz kelas bisa dibuat individu atau kelompok. Quiz kelompok: pengajar mengisi
  tabel rubrik penilaian (jumlah tabelnya bebas, bisa ditambah atau dihapus; poin
  penilaian bisa ditambah, skor 1 sampai 4: sangat kurang, kurang, baik, sangat
  baik) dan menentukan jumlah minimal dan maksimal anggota tiap kelompok.
- Sebelum mulai, satu siswa membuat kelompok: memasukkan nama kelompok dan
  anggotanya (mengetik sendiri atau memilih anggota kelas yang sudah bergabung).
  Anggota yang dipilih dari kelas mendapat tombol "Ikuti Quiz" dengan nama
  kelompok, lalu langsung bisa ikut menjawab. Jawaban satu kelompok dipakai
  bersama: yang ditulis anggota lain tampil di layar semua anggota (diperbarui
  tiap beberapa detik), dan siapa pun yang sudah ikut boleh mengumpulkan. Satu
  orang hanya bisa di satu kelompok untuk satu quiz.
- Ada dua nilai yang berdiri sendiri: nilai kelompok (poin soal yang diatur
  pengajar; soal esai dan tabel dinilai manual oleh pengajar atau admin, jadi
  nilainya menunggu penilaian) dan nilai individu (persen rubrik, diberi pengajar
  untuk tiap anggota satu per satu). Ekspor spreadsheet berisi satu baris per
  anggota dengan keduanya.

## SyRobo
- /syrobo adalah robot peliharaan di akun masing-masing (perlu masuk). Robot
  bisa lapar dan kotor seiring waktu: beri makan (makanan dibeli di "Kotak
  makanan" dengan poin) dan mandikan. Robot juga bisa diganti nama dan bajunya
  (18 pakaian dibeli di Toko dengan poin: slot kepala seperti topi, mahkota,
  kacamata, headphone, kupluk, topi pesta, dan slot badan seperti dasi, jubah,
  rompi, jaket, ransel, medali; ukuran
  tiap pakaian bisa diatur). Memandikan: ambil spons di menu Mandi lalu
  gosokkan ke robot sampai bar Bersih penuh, serta merespons saat
  dielus, diketuk, atau ditahan lalu diangkat ke mana saja di layar (ia menetap di tempat dilepas) dan
  berjalan-jalan sendiri di kamarnya. Menu dok: Main Room (kamar utama), Makan,
  Mandi, Baju, Toko (tiap menu membawa robot ke ruangannya sendiri: dapur, kamar
  mandi, ruang ganti, toko, yang bendanya bisa disentuh), Games, dan Hadiah.
  Pemilik SynapEd Premium aktif mendapat gratis 4 pakaian khusus (topi militer,
  baju militer (cokelat), mahkota raja, jubah raja) dan 10 makanan dewa; satu makanan dewa
  mengenyangkan penuh dan menjaga bar kenyang tidak turun selama 24 jam. Menu
  Games berisi Tanjakan Robo (mobil menanjak bukit, pengendaranya robot, mirip
  Hill Climb Racing; ada juga Bola Gabung, mirip fruit merge: jatuhkan bola, dua bola sejenis lebur jadi bola yang lebih besar, dari kelereng sampai bola dunia, jangan sampai melewati garis merah, skornya juga jadi koin: 1.000 skor = 1 bintang; Tanjakan Robo di desktop panah/A D untuk gas dan rem, spasi untuk loncat, Shift untuk nitro; di ponsel pedal serta tombol LONCAT dan NOS, sedangkan di desktop layar bersih tanpa tombol; ada batu penghalang untuk dilompati dan tabung nitro biru yang mengisi tangki NOS, lalu Shift/tombol NOS ditahan untuk melesat). Koin yang dikumpulkan di game bisa ditukar poin bintang di menu
  Toko (tab Koin Game, di samping tab Pakaian): 100 koin = 1 bintang, dengan batas setoran harian). Sebelum masuk robotnya mati; ditekan akan
  membawa ke halaman masuk. Benda di
  kamarnya juga bisa diketuk: lampu (kamar gelap), jendela, tanaman, buku
  (tips belajar), dan jam. Robot bisa kelelahan: hati di dadanya meredup seiring waktu terjaga, dan bila sangat tipis dan berkedip
  berarti ia perlu tidur. Tidurkan dengan mematikan lampu di Main Room (kamar utama); selagi lampu padam energinya pulih, lalu
  nyalakan lampu lagi untuk membangunkannya. Halamannya satu layar penuh tanpa footer.
- Poin didapat dari "Poin harian": hadiah masuk hari ini (5 bintang), lalu hadiah saat
  waktu aktif di halaman SyRobo mencapai 5 menit (1 bintang), 10 menit (3), 20 menit (5), 30 menit (7), 1 jam (10), dan 2 jam (15).
  Pemilik SynapEd Premium aktif mendapat bonus +50% di tiap hadiah.
  Hadiah diklaim manual dan hitungannya mulai dari nol setiap hari (WIB).
- Robot asisten di pojok layar ikut menunjukkan kondisi SyRobo pengguna yang
  sudah masuk: tampak lapar atau kotor bila SyRobo-nya butuh dirawat.

## SynapLab
- /lab adalah papan untuk memahami struktur data dan pemrograman sambil
  mencobanya, terbuka untuk siapa saja tanpa login. Halaman /lab dibuka dengan
  galeri kartu semua lab (Lab 01 Array sampai Lab 07 Searching); tombol menu
  (☰, di ponsel tombol "Materi") di dalam lab membuka galeri yang sama untuk
  pindah lab.
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
- Sorting (Lab 06): bubble sort, insertion sort, dan merge sort diperagakan
  langkah demi langkah secara pelan (kecepatan 0,25x sampai 2x, atau
  maju/mundur manual). Bubble sort tampil sebagai batang yang bertukar;
  insertion sort sebagai batang dengan "Kunci" yang disisipkan ke bagian kiri
  yang sudah urut; merge sort sebagai pohon seperti di buku teks: dibagi turun
  sampai satu elemen, lalu hasil gabungannya digambar di baris-baris di
  bawahnya, lengkap dengan panah dan nomor urutan proses. Setiap langkah dijelaskan dengan
  kalimat dan baris pseudocode Cambridge 9618 yang sedang berjalan disorot.
  Data bisa diketik (2-12 angka 0-999), diacak, atau dipilih dari contoh kasus
  (sudah urut, terbalik, hampir urut, ada nilai kembar), dan dibagikan lewat
  tautan. Selection sort dan quick sort ada sebagai operasi urut di lab Array.
- Searching (Lab 07): linear search, binary search, dan jump search langkah
  demi langkah, dengan kendali yang sama seperti Lab Sorting. Data tampil
  sebagai kotak berindeks dengan penunjuk i (linear), Kiri/Tengah/Kanan
  (binary), atau Awal/Akhir per blok (jump search melompat per blok berisi
  akar n data, lalu mencari satu per satu di blok terakhir); bagian yang sudah
  diperiksa atau dibuang diredupkan. Binary dan jump search hanya untuk data
  urut, jadi data yang belum urut diurutkan dulu secara otomatis. Ada
  pseudocode 9618 yang disorot, penghitung perbandingan, data 2-32 angka
  (ketik, acak, atau contoh kasus seperti "tidak ada" dan "32 data"), nilai
  yang dicari bisa diatur, dan bisa dibagikan lewat tautan.

## Yang belum tersedia
Penarikan dana pendapatan, notifikasi email, pengembalian dana otomatis,
dan menyimpan papan SynapLab ke akun. Kalau
ditanya, katakan terus terang bahwa fitur itu belum ada.`;
