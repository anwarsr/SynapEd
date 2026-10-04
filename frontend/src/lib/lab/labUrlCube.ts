/**
 * Codec URL lab 3D. Empat ruas data sesudah kepala `1c`:
 *
 *   1c~2x2x3~0,1,2,…,11~p:1:0:2:utama~0:1:0:1:1:2:sorot
 *      │     │          │              └ sorotan kotak: k1:i1:j1:k2:i2:j2:nada (inklusif)
 *      │     │          └ penunjuk: nama:lapisan:baris:kolom:nada
 *      │     └ nilai dalam urutan memori (row-major), dipisah koma
 *      └ bentuk lapisan x baris x kolom (kosong = kubus kosong)
 *
 * Dekode SEMUA-ATAU-TIDAK, sama seperti lab lain.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import {
  assertCubeInvariants,
  CUBE_MAX_BOXES,
  CUBE_MAX_POINTERS,
  CUBE_MAX_SIDE,
  cubeStateFromValues,
  cubeTotal,
  type CubeBox,
  type CubeLabState,
  type CubePointer,
  type Koord3,
} from "./cubeLab";
import { cleanLabText, isLabPointerTone, isLabTone, LAB_POINTER_NAME_RE, LAB_VALUE_RE } from "./labTypes";
import { bagianInt, daftar } from "./labUrlBagian";

export function encodeCube(state: CubeLabState): string[] | null {
  if (assertCubeInvariants(state) !== null) return null;
  const kosong = state.shape[0] === 0;
  return [
    kosong ? "" : state.shape.join("x"),
    state.cells.map((c) => c.value).join(","),
    state.pointers.map((p) => `${p.name}:${p.at.join(":")}:${p.tone}`).join(","),
    state.boxes.map((b) => `${b.from.join(":")}:${b.to.join(":")}:${b.tone}`).join(","),
  ];
}

/** Tiga bilangan dalam batas sumbu, atau null. */
function koord(bagian: readonly string[], shape: Koord3): Koord3 | null {
  const hasil: number[] = [];
  for (let k = 0; k < 3; k++) {
    const v = bagianInt(bagian[k], 0, shape[k] - 1);
    if (v === null) return null;
    hasil.push(v);
  }
  return [hasil[0], hasil[1], hasil[2]];
}

export function decodeCube(ruas: readonly string[]): CubeLabState | null {
  // ── Bentuk ─────────────────────────────────────────────────────────────
  let shape: Koord3 = [0, 0, 0];
  if (ruas[0].length > 0) {
    const b = daftar(ruas[0], "x");
    if (b.length !== 3) return null;
    const n = b.map((x) => bagianInt(x, 1, CUBE_MAX_SIDE));
    if (n[0] === null || n[1] === null || n[2] === null) return null;
    shape = [n[0], n[1], n[2]];
  }
  const total = shape[0] === 0 ? 0 : cubeTotal(shape);

  // ── Nilai ──────────────────────────────────────────────────────────────
  const nilai = daftar(ruas[1]).map((v) => cleanLabText(v));
  if (nilai.length !== total || !nilai.every((v) => LAB_VALUE_RE.test(v))) return null;
  const dasar = cubeStateFromValues(shape, nilai);

  // ── Penunjuk ───────────────────────────────────────────────────────────
  const bagianPenunjuk = daftar(ruas[2]);
  if (bagianPenunjuk.length > CUBE_MAX_POINTERS) return null;
  const pointers: CubePointer[] = [];
  const nama = new Set<string>();
  for (const b of bagianPenunjuk) {
    const p = b.split(":");
    if (p.length !== 5) return null;
    const n = cleanLabText(p[0]);
    if (!LAB_POINTER_NAME_RE.test(n) || nama.has(n)) return null;
    nama.add(n);
    const at = koord(p.slice(1, 4), shape);
    if (at === null || !isLabPointerTone(p[4])) return null;
    pointers.push({ name: n, at, tone: p[4] });
  }

  // ── Sorotan ────────────────────────────────────────────────────────────
  const bagianSorotan = daftar(ruas[3]);
  if (bagianSorotan.length > CUBE_MAX_BOXES) return null;
  const boxes: CubeBox[] = [];
  for (const b of bagianSorotan) {
    const p = b.split(":");
    if (p.length !== 7) return null;
    const from = koord(p.slice(0, 3), shape);
    const to = koord(p.slice(3, 6), shape);
    if (from === null || to === null || from.some((v, k) => v > to[k]) || !isLabTone(p[6])) return null;
    boxes.push({ from, to, tone: p[6] });
  }

  const state: CubeLabState = { ...dasar, pointers, boxes };
  return assertCubeInvariants(state) === null ? state : null;
}
