/**
 * Tautan bagikan Lab Searching: `?c=1l~43~38,27,43,3`.
 *
 *   1  versi skema
 *   l  algoritma: l = linear, b = binary, j = jump
 *   43 nilai yang dicari
 *   …  data, dipisah koma
 *
 * Tanpa kompresi (≤ 32 angka). Semua-atau-tidak: satu bagian rusak = `null`,
 * lab dibuka dengan data bawaan plus pemberitahuan. Dibaca di server.
 *
 * Modul netral.
 */
import { uraiData, uraiDicari } from "./searchData";
import type { AlgoCari } from "./searchTypes";

export const CARI_URL_PARAM = "c";
const CARI_URL_MAKS = 200;

export interface IsiCari {
  algo: AlgoCari;
  dicari: number;
  nilai: number[];
}

const HURUF_ALGO: Record<AlgoCari, string> = { linear: "l", binary: "b", jump: "j" };

export function encodeCari(isi: IsiCari): string {
  return `1${HURUF_ALGO[isi.algo]}~${isi.dicari}~${isi.nilai.join(",")}`;
}

export function decodeCari(kode: string): IsiCari | null {
  if (kode.length > CARI_URL_MAKS) return null;
  const m = /^1([lbj])~(\d+)~(\d+(?:,\d+)*)$/.exec(kode);
  if (!m) return null;
  const dicari = uraiDicari(m[2]);
  const data = uraiData(m[3]);
  if (!dicari.ok || !data.ok) return null;
  return { algo: m[1] === "l" ? "linear" : m[1] === "b" ? "binary" : "jump", dicari: dicari.nilai, nilai: data.nilai };
}
