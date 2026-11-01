/**
 * Tautan bagikan Lab Sorting: `?u=1b~n~38,27,43,3`.
 *
 *   1  versi skema
 *   b  algoritma: b = bubble, i = insertion, m = merge
 *   n  arah: n = naik, t = turun
 *   …  data, dipisah koma
 *
 * Isinya pendek (≤ 12 angka), jadi tanpa kompresi — tautannya tetap terbaca.
 * Dekode semua-atau-tidak: satu bagian rusak = `null`, dan lab dibuka dengan
 * data bawaan plus pemberitahuan, sama seperti lab lain.
 *
 * Modul netral; dibaca di server (`app/lab/page.tsx`).
 */
import { uraiData } from "./sortData";
import type { AlgoSort, ArahSort } from "./sortTypes";

export const SORT_URL_PARAM = "u";
const SORT_URL_MAKS = 120;

export interface IsiSort {
  algo: AlgoSort;
  arah: ArahSort;
  nilai: number[];
}

const HURUF_ALGO: Record<AlgoSort, string> = { bubble: "b", insertion: "i", merge: "m" };

export function encodeSort(isi: IsiSort): string {
  return `1${HURUF_ALGO[isi.algo]}~${isi.arah === "naik" ? "n" : "t"}~${isi.nilai.join(",")}`;
}

export function decodeSort(kode: string): IsiSort | null {
  if (kode.length > SORT_URL_MAKS) return null;
  const m = /^1([bim])~([nt])~([0-9,]+)$/.exec(kode);
  if (!m) return null;
  // Koma ganda / di ujung = tautan yang terpotong atau disunting tangan.
  if (!/^\d+(,\d+)*$/.test(m[3])) return null;
  const data = uraiData(m[3]);
  if (!data.ok) return null;
  return { algo: m[1] === "b" ? "bubble" : m[1] === "i" ? "insertion" : "merge", arah: m[2] === "n" ? "naik" : "turun", nilai: data.nilai };
}
