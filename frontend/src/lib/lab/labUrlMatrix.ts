/**
 * Codec URL lab 2D. Empat ruas data sesudah kepala `1m`:
 *
 *   1m~1,2,3;4,5,6~p:0:1:utama~0:0:0:2:sorot~1:1:pivot
 *      │            │           │             └ catatan: baris:kolom:teks
 *      │            │           └ sorotan: r1:c1:r2:c2:nada (inklusif)
 *      │            └ penunjuk: nama:baris:kolom:nada
 *      └ baris dipisah titik koma, nilai dipisah koma
 *
 * Dekode SEMUA-ATAU-TIDAK, sama seperti lab 1D: satu bagian rusak membatalkan
 * seluruh pemulihan.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import {
  assertMatrixInvariants,
  MATRIX_MAX_COLS,
  MATRIX_MAX_NOTES,
  MATRIX_MAX_POINTERS,
  MATRIX_MAX_RANGES,
  MATRIX_MAX_ROWS,
  matrixStateFromValues,
  type MatrixLabState,
  type MatrixPointer,
  type MatrixRange,
} from "./matrixLab";
import {
  cleanLabText,
  isLabPointerTone,
  isLabTone,
  LAB_NOTE_RE,
  LAB_POINTER_NAME_RE,
  LAB_VALUE_RE,
} from "./labTypes";
import { bagianInt, daftar } from "./labUrlBagian";

export function encodeMatrix(state: MatrixLabState): string[] | null {
  if (assertMatrixInvariants(state) !== null) return null;
  const nilai = state.rows.map((row) => row.map((c) => c.value).join(",")).join(";");
  const penunjuk = state.pointers.map((p) => `${p.name}:${p.row}:${p.col}:${p.tone}`).join(",");
  const sorotan = state.ranges.map((r) => `${r.r1}:${r.c1}:${r.r2}:${r.c2}:${r.tone}`).join(",");
  const catatan: string[] = [];
  state.rows.forEach((row, r) =>
    row.forEach((c, k) => {
      if (c.note !== null) catatan.push(`${r}:${k}:${c.note}`);
    }),
  );
  return [nilai, penunjuk, sorotan, catatan.join(",")];
}

export function decodeMatrix(ruas: readonly string[]): MatrixLabState | null {
  // ── Nilai ──────────────────────────────────────────────────────────────
  const barisMentah = daftar(ruas[0], ";");
  if (barisMentah.length > MATRIX_MAX_ROWS) return null;

  const nilai: string[][] = [];
  for (const b of barisMentah) {
    const baris = daftar(b).map((v) => cleanLabText(v));
    if (baris.length === 0 || baris.length > MATRIX_MAX_COLS) return null;
    if (nilai.length > 0 && baris.length !== nilai[0].length) return null;
    if (!baris.every((v) => LAB_VALUE_RE.test(v))) return null;
    nilai.push(baris);
  }

  const dasar = matrixStateFromValues(nilai);
  const R = dasar.rows.length;
  const C = dasar.rows[0]?.length ?? 0;

  // ── Penunjuk ───────────────────────────────────────────────────────────
  const bagianPenunjuk = daftar(ruas[1]);
  if (bagianPenunjuk.length > MATRIX_MAX_POINTERS) return null;
  const pointers: MatrixPointer[] = [];
  const nama = new Set<string>();
  for (const b of bagianPenunjuk) {
    const p = b.split(":");
    if (p.length !== 4) return null;
    const n = cleanLabText(p[0]);
    if (!LAB_POINTER_NAME_RE.test(n) || nama.has(n)) return null;
    nama.add(n);
    const row = bagianInt(p[1], 0, R - 1);
    const col = bagianInt(p[2], 0, C - 1);
    if (row === null || col === null || !isLabPointerTone(p[3])) return null;
    pointers.push({ name: n, row, col, tone: p[3] });
  }

  // ── Sorotan ────────────────────────────────────────────────────────────
  const bagianSorotan = daftar(ruas[2]);
  if (bagianSorotan.length > MATRIX_MAX_RANGES) return null;
  const ranges: MatrixRange[] = [];
  for (const b of bagianSorotan) {
    const p = b.split(":");
    if (p.length !== 5) return null;
    const r1 = bagianInt(p[0], 0, R - 1);
    const c1 = bagianInt(p[1], 0, C - 1);
    const r2 = bagianInt(p[2], 0, R - 1);
    const c2 = bagianInt(p[3], 0, C - 1);
    if (r1 === null || c1 === null || r2 === null || c2 === null || r1 > r2 || c1 > c2) return null;
    if (!isLabTone(p[4])) return null;
    ranges.push({ r1, c1, r2, c2, tone: p[4] });
  }

  // ── Catatan ────────────────────────────────────────────────────────────
  const bagianCatatan = daftar(ruas[3]);
  if (bagianCatatan.length > MATRIX_MAX_NOTES) return null;
  const catatan = new Map<string, string>();
  for (const b of bagianCatatan) {
    const p = b.split(":");
    if (p.length !== 3) return null;
    const r = bagianInt(p[0], 0, R - 1);
    const c = bagianInt(p[1], 0, C - 1);
    if (r === null || c === null) return null;
    const kunci = `${r}:${c}`;
    if (catatan.has(kunci)) return null;
    const teks = cleanLabText(p[2]);
    if (!LAB_NOTE_RE.test(teks)) return null;
    catatan.set(kunci, teks);
  }

  const rows = dasar.rows.map((row, r) =>
    row.map((sel, c) => {
      const note = catatan.get(`${r}:${c}`);
      return note === undefined ? sel : { ...sel, note };
    }),
  );
  const state: MatrixLabState = { rows, pointers, ranges, nextId: dasar.nextId };
  return assertMatrixInvariants(state) === null ? state : null;
}
