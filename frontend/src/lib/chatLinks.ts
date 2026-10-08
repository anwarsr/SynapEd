/**
 * Halaman yang boleh ditautkan Asisten SynapEd, dan halaman yang SENGAJA tidak.
 *
 * Modul NETRAL (tanpa impor) karena dipakai dua pihak: chatPrompt.ts menyusun
 * daftar tautan untuk model dari sini, dan `scripts/verify-chat-knowledge.ts`
 * mencocokkannya dengan folder `app/`. Pemeriksaan itulah yang membuat
 * pengetahuan asisten tidak diam-diam tertinggal: begitu ada halaman baru
 * (atau halaman lama berganti alamat), suite memerah sampai halamannya
 * didaftarkan di salah satu dari dua daftar di bawah — dan siapa pun yang
 * mendaftarkannya terpaksa memutuskan apakah asisten perlu tahu soal itu.
 *
 * `{nama}` = bagian alamat yang berubah-ubah (padanan `[nama]` di folder app).
 */

export interface ChatLink {
  path: string;
  ket: string;
}

export const CHAT_LINKS: readonly ChatLink[] = [
  { path: "/register", ket: "daftar akun baru" },
  { path: "/login", ket: "masuk" },
  { path: "/courses", ket: "katalog semua kursus" },
  {
    path: "/courses/{slug}",
    ket: "halaman detail satu kursus — HANYA slug yang benar-benar tercantum di katalog kursus, jangan menebak",
  },
  { path: "/profil", ket: "profil: kursus & kelas yang diikuti, Lanjutkan Belajar, sertifikat" },
  { path: "/profil/edit", ket: "menyunting foto, perkenalan, riwayat pendidikan, keahlian" },
  { path: "/pengaturan", ket: "username, nomor HP, email, kata sandi, cara masuk, hapus akun" },
  { path: "/dashboard", ket: "pendapatan royalti & referral, kode referral" },
  { path: "/kelas", ket: "kelas yang diikuti dan bergabung ke kelas dengan kode undangan" },
  { path: "/lab", ket: "SynapLab, papan visualisasi struktur data" },
  { path: "/educator", ket: "pengajuan menjadi educator" },
  { path: "/educator/courses", ket: "(educator) membuat & mengelola kursus" },
  { path: "/educator/classes", ket: "(educator) membuat & mengelola kelas" },
  {
    path: "/verify/{kode}",
    ket: "verifikasi sertifikat — HANYA kalau pengguna sendiri memberi kodenya; jangan mengarang kode",
  },
  { path: "/kontak", ket: "kontak & dukungan" },
  { path: "/syarat-ketentuan", ket: "syarat & ketentuan" },
  { path: "/kebijakan-privasi", ket: "kebijakan privasi" },
  { path: "/pengembalian-dana", ket: "kebijakan pengembalian dana" },
];

/**
 * Halaman yang sengaja TIDAK ditautkan, beserta alasannya. Kunci = awalan
 * alamat; satu kunci menutup halaman itu dan seluruh turunannya.
 */
export const CHAT_LINKS_DIKECUALIKAN: Readonly<Record<string, string>> = {
  "/": "beranda — tidak ada yang perlu diarahkan ke sana",
  "/admin": "panel admin, bukan untuk pengguna umum",
  "/courses/{slug}/learn": "halaman belajar butuh pendaftaran; arahkan ke halaman detail kursus",
  "/courses/{slug}/complete": "halaman perayaan setelah kursus selesai, muncul sendiri",
  "/dashboard/certificates": "sertifikat pribadi; dibuka dari /profil",
  "/educator/courses/": "turunan pengelolaan kursus; cukup arahkan ke /educator/courses",
  "/educator/classes/": "turunan pengelolaan kelas; cukup arahkan ke /educator/classes",
  "/kelas/": "ID kelas tidak diketahui asisten; arahkan ke /kelas",
  "/profil/{uid}": "profil orang lain, butuh uid yang tidak diketahui asisten",
};
