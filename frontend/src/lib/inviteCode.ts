/**
 * Kode acak yang aman diketik ulang manusia.
 *
 * Modul ini sengaja NETRAL — tanpa `server-only` dan tanpa `use client`.
 * Alfabetnya dipakai server saat membangkitkan kode, dan dipakai browser saat
 * memvalidasi masukan formulir sebelum dikirim. Menaruhnya di modul server
 * berarti formulirnya tidak bisa mengenali huruf yang mustahil ada.
 *
 * Sebelum ada berkas ini, alfabetnya hanya hidup di certificates.ts. Dua
 * definisi alfabet yang sama akan pelan-pelan melenceng, dan yang melenceng
 * di sini berarti kode yang dicetak tidak cocok dengan kode yang diterima.
 */

/**
 * Alfabet Crockford base32 — tanpa I, L, O, dan U.
 *
 * I/L/1 dan O/0 saling tertukar saat dibaca manusia, dan U dibuang supaya
 * kode acak tidak sengaja membentuk kata yang tidak pantas.
 */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Panjang kode undangan kelas. 32^8 ~ 1,1 triliun kemungkinan. */
export const INVITE_CODE_LENGTH = 8;

/**
 * Menormalkan kode yang diketik pengguna.
 *
 * Orang mengetik huruf kecil, menyisipkan spasi, dan menempelkan kode beserta
 * tanda baca di sekelilingnya. Tanpa penormalan ini, kode yang benar ditolak
 * hanya karena bentuk ketikannya — dan pengguna tidak punya cara menebak apa
 * yang salah, sebab kode yang ia lihat memang sama persis.
 *
 * O dan I dipetakan ke 0 dan 1, bukan dibuang: itulah dua salah baca yang
 * paling sering terjadi, dan alfabetnya memang tidak pernah memuat keduanya.
 */
export function normalizeInviteCode(raw: unknown): string {
  if (typeof raw !== "string") return "";

  return raw
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .split("")
    .filter((c) => CROCKFORD.includes(c))
    .join("");
}
