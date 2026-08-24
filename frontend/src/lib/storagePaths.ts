/**
 * Nama folder di Firebase Storage.
 *
 * Modul ini sengaja netral — tanpa "use client" maupun "server-only" — karena
 * dipakai di kedua sisi: browser menyusun path saat mengunggah, server
 * memeriksa ulang awalannya. Menaruhnya di berkas ber-"use client" pernah
 * membuat kode server menerima referensi klien alih-alih string, sehingga
 * setiap perbandingan diam-diam bernilai false tanpa satu pun galat tipe.
 */

/** Materi pelajaran — tertutup, hanya lewat route API bertanda tangan. */
export const COURSE_ASSETS = "course-assets";

/** Gambar latar kursus — terbuka, tampil di katalog publik. */
export const COURSE_THUMBNAILS = "course-thumbnails";

/** Foto profil — satu folder per pengguna. */
export const AVATARS = "avatars";

/** Gambar QRIS merchant — terbuka, karena harus bisa dipindai calon pembeli. */
export const QRIS_IMAGES = "payment-qris";

/**
 * Bukti bayar — TERTUTUP, satu folder per pengguna.
 *
 * Isinya tangkapan layar mutasi rekening milik orang lain. Disajikan hanya
 * lewat route API yang memeriksa peran, tidak pernah sebagai URL langsung —
 * pola yang sama dengan COURSE_ASSETS.
 */
export const PAYMENT_PROOFS = "payment-proofs";
