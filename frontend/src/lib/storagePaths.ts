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
