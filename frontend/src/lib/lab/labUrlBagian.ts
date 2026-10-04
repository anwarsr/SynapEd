/**
 * Penolong urai yang dipakai bersama codec URL ketiga lab.
 *
 * Dipisah dari `labUrl.ts` supaya codec 2D dan N-D bisa memakainya tanpa
 * saling mengimpor melingkar dengan dispatcher-nya.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { cleanLabText, parseLabInt } from "./labTypes";

/**
 * Batas panjang parameter.
 *
 * Papan terberat ketiga lab muat jauh di bawah ini, jadi angka ini bukan
 * batas desain melainkan penjaga: parameter yang lebih panjang pasti bukan
 * buatan pengoder kita, dan diperiksa SEBELUM diurai supaya tautan raksasa
 * tidak pernah sampai ke parser.
 */
export const LAB_MAX_URL_STATE = 1200;

/**
 * Karakter yang membuat tautan berubah arti saat ditempel.
 *
 * `%` memulai persentase-escape, `&` memisah parameter, `#` memulai fragmen,
 * `?` memulai query, dan `+` didekode `URLSearchParams` menjadi SPASI. Semua
 * regex nilai sudah melarangnya, jadi penjaga ini seharusnya tidak pernah
 * menyala — ia dipasang supaya regex yang dilonggarkan suatu hari ketahuan di
 * sini, bukan dari tautan yang rusak di tangan pengguna.
 */
export const KARAKTER_TERLARANG_RE = /[%&#+?]/;

/** Ruas kosong berarti daftar kosong; `"".split(",")` menghasilkan [""], bukan []. */
export function daftar(ruas: string, pemisah = ","): string[] {
  return ruas.length === 0 ? [] : ruas.split(pemisah);
}

/**
 * Bilangan bulat dari satu bagian ruas, atau null.
 *
 * Bagian KOSONG ditolak sendiri lebih dulu karena `Number("")` bernilai 0 dan
 * 0 adalah bilangan bulat yang sah: tanpa penjaga ini `i::utama` akan diurai
 * sebagai penunjuk di indeks 0 — tautan rusak yang memulihkan papan yang
 * salah alih-alih menolak.
 */
export function bagianInt(raw: string, min: number, max: number): number | null {
  if (cleanLabText(raw).length === 0) return null;
  return parseLabInt(raw, min, max);
}
