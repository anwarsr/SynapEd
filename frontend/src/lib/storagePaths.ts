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

/**
 * Berkas tugas yang dikumpulkan peserta — TERTUTUP, satu folder per orang.
 *
 * Jenisnya bebas (dokumen, gambar, arsip), jadi folder ini TIDAK boleh
 * terbaca publik: satu berkas yang bisa dieksekusi ditambah URL terbuka
 * sama dengan menyediakan tempat menitipkan berkas berbahaya di domain ini.
 * Disajikan hanya lewat route API yang memeriksa peran.
 */
export const SUBMISSION_FILES = "submissions";

/**
 * Lampiran postingan kelas dari pengajar — TERTUTUP, satu folder per pengajar
 * (`class-files/{uid}/{classId}/…`). Yang boleh membaca hanya anggota kelas
 * itu, jadi tidak bisa berupa URL publik; disajikan lewat
 * /api/classes/attachment yang memeriksa keanggotaan.
 */
export const CLASS_FILES = "class-files";

/**
 * Berkas jawaban tugas kelas dari siswa — TERTUTUP, satu folder per siswa
 * (`class-submissions/{uid}/{classId}/{postId}/…`). Hanya siswa itu sendiri
 * dan pengelola kelasnya yang boleh mengunduh, lewat /api/classes/submission.
 */
export const CLASS_SUBMISSION_FILES = "class-submissions";
