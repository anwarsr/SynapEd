/**
 * Codec URL lab linked list. Empat ruas data sesudah kepala `1l`:
 *
 *   1l~3,8,1~~~
 *      └ nilai dalam urutan list (dari head); tiga ruas sisanya dicadangkan
 *        dan WAJIB kosong.
 *
 * Yang dibagikan hanya isi list. Alamat memori dihitung ulang dari id saat
 * dibuka, jadi tautan yang sama selalu memulihkan papan yang sama. Ruas
 * cadangan diperiksa kosong supaya tautan dari versi masa depan yang
 * mengisinya ditolak utuh, bukan dibaca sebagian.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { assertListInvariants, LIST_MAX_NODES, listStateFromValues, nilaiList, type ListLabState } from "./listLab";
import { cleanLabText, LAB_VALUE_RE } from "./labTypes";
import { daftar } from "./labUrlBagian";

export function encodeList(state: ListLabState): string[] | null {
  if (assertListInvariants(state) !== null) return null;
  return [nilaiList(state).join(","), "", "", ""];
}

export function decodeList(ruas: readonly string[]): ListLabState | null {
  if (ruas[1] !== "" || ruas[2] !== "" || ruas[3] !== "") return null;
  const nilai = daftar(ruas[0]).map((v) => cleanLabText(v));
  if (nilai.length > LIST_MAX_NODES || !nilai.every((v) => LAB_VALUE_RE.test(v))) return null;
  const state = listStateFromValues(nilai);
  return assertListInvariants(state) === null ? state : null;
}
