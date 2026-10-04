/**
 * Codec URL lab N-dimensi. Empat ruas data sesudah kepala `1n`:
 *
 *   1n~2x3x4~0,1,2,…,23~1x2x0~1:0:sorot
 *      │     │          │     └ sorotan irisan: sumbu:posisi:nada
 *      │     │          └ kursor: indeks per sumbu dipisah "x" (kosong = tanpa kursor)
 *      │     └ nilai dalam urutan memori (row-major), dipisah koma
 *      └ bentuk: panjang tiap dimensi dipisah "x"
 *
 * Dekode SEMUA-ATAU-TIDAK.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import {
  assertNdInvariants,
  ND_MAX_DIMS,
  ND_MAX_ELEMENTS,
  ND_MAX_SIZE,
  ND_MAX_SLICES,
  ndStateFromValues,
  ndTotal,
  type NdLabState,
  type NdSlice,
} from "./ndLab";
import { cleanLabText, isLabTone, LAB_VALUE_RE } from "./labTypes";
import { bagianInt, daftar } from "./labUrlBagian";

export function encodeNd(state: NdLabState): string[] | null {
  if (assertNdInvariants(state) !== null) return null;
  return [
    state.shape.join("x"),
    state.cells.map((c) => c.value).join(","),
    state.cursor === null ? "" : state.cursor.join("x"),
    state.slices.map((s) => `${s.axis}:${s.index}:${s.tone}`).join(","),
  ];
}

export function decodeNd(ruas: readonly string[]): NdLabState | null {
  // ── Bentuk ─────────────────────────────────────────────────────────────
  const bagianBentuk = daftar(ruas[0], "x");
  if (bagianBentuk.length > ND_MAX_DIMS) return null;
  const shape: number[] = [];
  for (const b of bagianBentuk) {
    const n = bagianInt(b, 1, ND_MAX_SIZE);
    if (n === null) return null;
    shape.push(n);
  }
  const total = ndTotal(shape);
  if (total > ND_MAX_ELEMENTS) return null;

  // ── Nilai ──────────────────────────────────────────────────────────────
  const nilai = daftar(ruas[1]).map((v) => cleanLabText(v));
  if (nilai.length !== total || !nilai.every((v) => LAB_VALUE_RE.test(v))) return null;

  const dasar = ndStateFromValues(shape, nilai);

  // ── Kursor ─────────────────────────────────────────────────────────────
  let cursor: number[] | null = null;
  if (ruas[2].length > 0) {
    const bagian = daftar(ruas[2], "x");
    if (bagian.length !== shape.length) return null;
    cursor = [];
    for (let k = 0; k < bagian.length; k++) {
      const v = bagianInt(bagian[k], 0, shape[k] - 1);
      if (v === null) return null;
      cursor.push(v);
    }
  }

  // ── Sorotan irisan ─────────────────────────────────────────────────────
  const bagianSorotan = daftar(ruas[3]);
  if (bagianSorotan.length > ND_MAX_SLICES) return null;
  const slices: NdSlice[] = [];
  for (const b of bagianSorotan) {
    const p = b.split(":");
    if (p.length !== 3) return null;
    const axis = bagianInt(p[0], 0, shape.length - 1);
    if (axis === null) return null;
    const index = bagianInt(p[1], 0, shape[axis] - 1);
    if (index === null || !isLabTone(p[2])) return null;
    slices.push({ axis, index, tone: p[2] });
  }

  const state: NdLabState = { ...dasar, cursor, slices };
  return assertNdInvariants(state) === null ? state : null;
}
