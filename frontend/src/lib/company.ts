/**
 * Identitas resmi penyelenggara — satu sumber kebenaran.
 *
 * Nilai-nilai ini muncul di empat halaman legal, di footer, dan di formulir
 * pendaftaran. Ditulis ulang di tiap tempat, cepat atau lambat salah satunya
 * tertinggal saat ada yang berubah — dan pada dokumen yang mengikat pembeli,
 * alamat atau kontak yang basi bukan sekadar kesalahan kosmetik.
 *
 * Modul netral (tanpa "use client" / "server-only") karena dipakai di kedua
 * sisi: halaman legal dirender server, footer dan formulir di klien.
 */

export const COMPANY = {
  /** Nama merek yang dikenal pengguna. */
  name: "SynapEd",

  /** Nama penyelenggara sebagaimana disebut di dokumen legal. */
  legalName: "Synapse Education",

  address:
    "Gedung VI Lantai 3, Fakultas Teknik, Universitas Sebelas Maret, " +
    "Jl. Ir. Sutami No. 36A, Kentingan, Jebres, Surakarta, Jawa Tengah 57126",

  /** Pertanyaan umum, dukungan, dan keluhan pembelian. */
  supportEmail: "support@synapedu.com",

  /**
   * Khusus permintaan data pribadi: akses, koreksi, penghapusan.
   *
   * Sengaja terpisah dari support. UU PDP mewajibkan kanal yang jelas untuk
   * hak subjek data, dan permintaan semacam itu punya tenggat — kalau
   * bercampur dengan tiket dukungan biasa, ia tenggelam.
   *
   * Ditulis "privacy", bukan "privasi": awalan alamat email hampir selalu
   * bahasa Inggris sekalipun situsnya berbahasa Indonesia, dan orang yang
   * membaca bentuk Indonesia cenderung tetap mengetik bentuk Inggris —
   * emailnya lalu memantul tanpa siapa pun tahu.
   */
  privacyEmail: "privacy@synapedu.com",

  phone: "+62 812-7448-4415",
  /** Bentuk tanpa spasi untuk href="tel:". */
  phoneHref: "+6281274484415",

  supportHours: "Senin–Jumat, 08.00–15.00 WIB",

  domain: "synapedu.com",
  siteUrl: "https://synapedu.com",
} as const;

/**
 * Tanggal berlaku dokumen legal.
 *
 * Dipatok manual, BUKAN tanggal hari ini yang dihitung otomatis: dokumen yang
 * tanggalnya berubah sendiri setiap halaman dimuat tidak bisa dipakai sebagai
 * bukti versi mana yang disetujui seseorang saat ia mendaftar.
 */
export const LEGAL_EFFECTIVE_DATE = "19 Agustus 2026";
