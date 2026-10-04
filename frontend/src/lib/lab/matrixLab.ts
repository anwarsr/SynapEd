/**
 * Lab array 2 dimensi: model kisi, reducer, dan penghasil langkah animasi.
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/` —
 * supaya `scripts/verify-lab.ts` bisa mengujinya langsung.
 *
 * Aturannya sama dengan lab 1D: `applyMatrixOp` TIDAK PERNAH melempar untuk
 * masukan pengguna (mengembalikan `{ ok:false, error }` yang siap tampil),
 * keadaan tidak disentuh saat ditolak, dan setiap langkah membawa keadaan
 * UTUH supaya papan cukup menggambar apa adanya.
 *
 * Kisi selalu persegi panjang: setiap baris sama panjang. Kisi tanpa baris
 * ATAU tanpa kolom dinormalkan menjadi kisi kosong (`rows: []`), supaya tidak
 * ada keadaan aneh "3 baris berisi 0 kolom" yang tidak bisa digambar.
 *
 * Indeks `fokus` di setiap langkah adalah indeks DATAR baris-demi-baris
 * (`baris * jumlahKolom + kolom`) terhadap keadaan langkah itu sendiri.
 */
import { mulberry32 } from "./labRandom";
import {
  cleanLabText,
  LAB_MAX_ITEM_CHARS,
  LAB_MAX_NOTE_CHARS,
  LAB_NOTE_RE,
  LAB_POINTER_NAME_RE,
  LAB_MOVE_HOLD_MS,
  LAB_STEP_HOLD_MS,
  LAB_VALUE_RE,
  LAB_VISIT_HOLD_MS,
  type LabKelompok,
  type LabOpResult,
  type LabPointerTone,
  type LabStep,
  type LabTone,
} from "./labTypes";

/**
 * Lebih dari ini, sel menjadi terlalu kecil untuk dibaca di proyektor.
 *
 * Baris dan kolom SENGAJA dibatasi sama: transpose dan putar 90° menukar
 * keduanya, jadi batas yang berbeda membuat kisi 2×10 yang sah berubah
 * menjadi 10×2 yang melanggar batas — operasi yang sah menghasilkan papan
 * yang tidak sah (ditemukan oleh uji acak verify-lab).
 */
const MATRIX_MAX_SIDE = 8;
export const MATRIX_MAX_ROWS = MATRIX_MAX_SIDE;
export const MATRIX_MAX_COLS = MATRIX_MAX_SIDE;
export const MATRIX_MAX_POINTERS = 4;
export const MATRIX_MAX_RANGES = 4;
/** Catatan dibatasi supaya tautan bagikan tetap pendek. */
export const MATRIX_MAX_NOTES = 12;
/** Penelusuran 8×8 = 64 kunjungan + pembuka + penutup, dengan sisa ruang. */
export const MATRIX_MAX_STEPS = 100;
const MATRIX_MAX_RANDOM_VALUE = Math.pow(10, LAB_MAX_ITEM_CHARS) - 1;

export interface MatrixCell {
  /** Kunci stabil untuk animasi: sel yang berpindah tetap sel yang sama. */
  id: number;
  value: string;
  note: string | null;
}

export interface MatrixPointer {
  name: string;
  row: number;
  col: number;
  tone: LabPointerTone;
}

/** Sorotan persegi panjang, INKLUSIF di keempat sisinya. */
export interface MatrixRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  tone: LabTone;
}

export interface MatrixLabState {
  rows: MatrixCell[][];
  pointers: MatrixPointer[];
  ranges: MatrixRange[];
  /** Pencacah monoton — BUKAN nilai acak (hydration mismatch di React). */
  nextId: number;
}

export type MatrixStep = LabStep<MatrixLabState>;
export type MatrixOpResult = LabOpResult<MatrixLabState>;

export type MatrixOp =
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "acak"; jumlahBaris: number; jumlahKolom: number; maks: number; benih: number }
  | { kind: "kosongkan" }
  | { kind: "tambahBaris"; baris: number; nilai: string }
  | { kind: "hapusBaris"; baris: number }
  | { kind: "tambahKolom"; kolom: number; nilai: string }
  | { kind: "hapusKolom"; kolom: number }
  | { kind: "setSel"; baris: number; kolom: number; nilai: string }
  | { kind: "bacaSel"; baris: number; kolom: number }
  | { kind: "catat"; baris: number; kolom: number; catatan: string }
  | { kind: "setPenunjuk"; nama: string; baris: number; kolom: number; tone: LabPointerTone }
  | { kind: "geserPenunjuk"; nama: string; dBaris: number; dKolom: number }
  | { kind: "hapusPenunjuk"; nama: string }
  | { kind: "sorotBaris"; baris: number; tone: LabTone }
  | { kind: "sorotKolom"; kolom: number; tone: LabTone }
  | {
      kind: "sorotSubKisi";
      dariBaris: number;
      dariKolom: number;
      sampaiBaris: number;
      sampaiKolom: number;
      tone: LabTone;
    }
  | { kind: "hapusSorotan" }
  | { kind: "telusurBaris" }
  | { kind: "telusurKolom" }
  | { kind: "telusurDiagonal" }
  | { kind: "transpose" }
  | { kind: "balikTiapBaris" }
  | { kind: "balikUrutanBaris" }
  | { kind: "putar90" };

// ---------------------------------------------------------------------------
// Pembentuk & penjaga
// ---------------------------------------------------------------------------

export function emptyMatrixState(): MatrixLabState {
  return { rows: [], pointers: [], ranges: [], nextId: 0 };
}

/** Jumlah kolom; 0 untuk kisi kosong. */
export function matrixCols(state: MatrixLabState): number {
  return state.rows[0]?.length ?? 0;
}

/**
 * Kisi dari nilai baris-demi-baris, id diberikan berurutan.
 *
 * Dianggap SUDAH sah (persegi panjang, dalam batas) — pemanggil yang memeriksa:
 * reducer dengan pesan galatnya, dekoder URL dengan penolakan semua-atau-tidak.
 */
export function matrixStateFromValues(values: readonly (readonly string[])[]): MatrixLabState {
  let nextId = 0;
  const rows = values.map((baris) => baris.map((value) => ({ id: nextId++, value, note: null })));
  return settleMatrix({ rows, pointers: [], ranges: [], nextId });
}

/**
 * Penjaga terakhir di setiap langkah.
 *
 * Kisi tanpa kolom dinormalkan menjadi kosong. Penunjuk di-clamp ke dalam
 * kisi — dan DIBUANG kalau kisinya kosong, karena di kisi kosong tidak ada sel
 * untuk ditunjuk. Sorotan yang keluar batas dibuang SELURUHNYA, tidak dipotong:
 * persegi panjang yang dipotong diam-diam menyorot petak yang tidak pernah
 * dipilih siapa pun.
 */
export function settleMatrix(state: MatrixLabState): MatrixLabState {
  const R = state.rows.length;
  const C = matrixCols(state);
  if (R === 0 || C === 0) return { rows: [], pointers: [], ranges: [], nextId: state.nextId };

  const pointers = state.pointers.map((p) => ({
    ...p,
    row: Math.min(Math.max(p.row, 0), R - 1),
    col: Math.min(Math.max(p.col, 0), C - 1),
  }));
  const ranges = state.ranges.filter(
    (r) => r.r1 >= 0 && r.c1 >= 0 && r.r1 <= r.r2 && r.c1 <= r.c2 && r.r2 < R && r.c2 < C,
  );
  return { rows: state.rows, pointers, ranges, nextId: state.nextId };
}

/** Kalimat masalah pertama, atau null kalau keadaannya sehat. */
export function assertMatrixInvariants(state: MatrixLabState): string | null {
  const R = state.rows.length;
  const C = matrixCols(state);

  if (R > MATRIX_MAX_ROWS) return `Jumlah baris ${R} melebihi ${MATRIX_MAX_ROWS}.`;
  if (C > MATRIX_MAX_COLS) return `Jumlah kolom ${C} melebihi ${MATRIX_MAX_COLS}.`;
  if (R > 0 && C === 0) return "Kisi berbaris tapi tanpa kolom.";

  const ids = new Set<number>();
  let catatan = 0;
  for (let r = 0; r < R; r++) {
    if (state.rows[r].length !== C) return `Baris ${r} tidak sama panjang dengan baris 0.`;
    for (const sel of state.rows[r]) {
      if (!LAB_VALUE_RE.test(sel.value)) return `Nilai "${sel.value}" tidak sah.`;
      if (sel.note !== null) {
        if (!LAB_NOTE_RE.test(sel.note)) return `Catatan "${sel.note}" tidak sah.`;
        catatan++;
      }
      if (ids.has(sel.id)) return `Id sel ${sel.id} ganda.`;
      if (sel.id >= state.nextId) return `Id sel ${sel.id} tidak lebih kecil dari nextId ${state.nextId}.`;
      ids.add(sel.id);
    }
  }
  if (catatan > MATRIX_MAX_NOTES) return `Catatan ${catatan} melebihi ${MATRIX_MAX_NOTES}.`;

  if (state.pointers.length > MATRIX_MAX_POINTERS) return "Penunjuk terlalu banyak.";
  if (R === 0 && state.pointers.length > 0) return "Kisi kosong tidak boleh punya penunjuk.";
  const nama = new Set<string>();
  for (const p of state.pointers) {
    if (!LAB_POINTER_NAME_RE.test(p.name)) return `Nama penunjuk "${p.name}" tidak sah.`;
    if (nama.has(p.name)) return `Nama penunjuk "${p.name}" ganda.`;
    nama.add(p.name);
    if (p.row < 0 || p.row >= R || p.col < 0 || p.col >= C) {
      return `Penunjuk "${p.name}" di (${p.row}, ${p.col}) keluar dari kisi ${R}×${C}.`;
    }
  }

  if (state.ranges.length > MATRIX_MAX_RANGES) return "Sorotan terlalu banyak.";
  for (const r of state.ranges) {
    if (r.r1 < 0 || r.c1 < 0 || r.r1 > r.r2 || r.c1 > r.c2 || r.r2 >= R || r.c2 >= C) {
      return `Sorotan (${r.r1},${r.c1})–(${r.r2},${r.c2}) keluar dari kisi.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penolong internal
// ---------------------------------------------------------------------------

function gagal(error: string): MatrixOpResult {
  return { ok: false, error };
}

function langkah(
  state: MatrixLabState,
  narasi: string,
  fokus: number[] = [],
  tahanMs: number = LAB_STEP_HOLD_MS,
  tanda: Pick<MatrixStep, "kelompok" | "jalur"> = {},
): MatrixStep {
  return { state: settleMatrix(state), narasi, fokus, tahanMs, ...tanda };
}

/** Warna asal per BARIS: id sel → nomor barisnya sekarang. */
function kelompokBaris(state: MatrixLabState): LabKelompok {
  const warna: Record<number, number> = {};
  state.rows.forEach((row, r) => row.forEach((c) => (warna[c.id] = r)));
  return { warna, label: state.rows.map((_, r) => `baris ${r} semula`) };
}

/** Warna asal per KOLOM: id sel → nomor kolomnya sekarang. */
function kelompokKolom(state: MatrixLabState): LabKelompok {
  const warna: Record<number, number> = {};
  state.rows.forEach((row) => row.forEach((c, k) => (warna[c.id] = k)));
  return { warna, label: Array.from({ length: matrixCols(state) }, (_, k) => `kolom ${k} semula`) };
}

/** Offset datar semua sel yang id-nya ada di himpunan — untuk menyorot satu kelompok di keadaan mana pun. */
function offsetDariId(state: MatrixLabState, ids: ReadonlySet<number>): number[] {
  return state.rows.flat().flatMap((c, o) => (ids.has(c.id) ? [o] : []));
}

function berhasil(steps: MatrixStep[]): MatrixOpResult {
  // Langkah TERAKHIR adalah keadaan yang masuk riwayat undo; kalau kelebihan,
  // yang dipangkas frame tengah, bukan ujungnya.
  if (steps.length > MATRIX_MAX_STEPS) {
    return { ok: true, steps: [...steps.slice(0, MATRIX_MAX_STEPS - 1), steps[steps.length - 1]] };
  }
  return { ok: true, steps };
}

function nilaiBersih(raw: string): string | null {
  const v = cleanLabText(raw);
  return LAB_VALUE_RE.test(v) ? v : null;
}

const GALAT_NILAI = `Nilai harus 1 sampai ${LAB_MAX_ITEM_CHARS} karakter berisi huruf, angka, spasi, titik, atau tanda minus.`;

function ukuran(state: MatrixLabState): string {
  return `${state.rows.length}×${matrixCols(state)}`;
}

function datar(state: MatrixLabState, baris: number, kolom: number): number {
  return baris * matrixCols(state) + kolom;
}

function galatBaris(state: MatrixLabState, baris: number): string | null {
  const R = state.rows.length;
  if (R === 0) return "Array 2D masih kosong. Isi dulu lewat kelompok Bentuk & isi.";
  if (!Number.isInteger(baris) || baris < 0 || baris >= R) {
    return `Baris ${baris} tidak ada; baris yang ada hanya 0 sampai ${R - 1}.`;
  }
  return null;
}

function galatKolom(state: MatrixLabState, kolom: number): string | null {
  const C = matrixCols(state);
  if (C === 0) return "Array 2D masih kosong. Isi dulu lewat kelompok Bentuk & isi.";
  if (!Number.isInteger(kolom) || kolom < 0 || kolom >= C) {
    return `Kolom ${kolom} tidak ada; kolom yang ada hanya 0 sampai ${C - 1}.`;
  }
  return null;
}

function galatSel(state: MatrixLabState, baris: number, kolom: number): string | null {
  return galatBaris(state, baris) ?? galatKolom(state, kolom);
}

/** Sorotan baru; yang batasnya sama persis ditimpa supaya tidak menghabiskan jatah. */
function tambahSorotan(state: MatrixLabState, r: MatrixRange): MatrixLabState | string {
  const lain = state.ranges.filter(
    (x) => !(x.r1 === r.r1 && x.c1 === r.c1 && x.r2 === r.r2 && x.c2 === r.c2),
  );
  if (lain.length >= MATRIX_MAX_RANGES) {
    return `Sorotan sudah ${MATRIX_MAX_RANGES}. Hapus sorotan dulu sebelum menambah yang baru.`;
  }
  return { ...state, ranges: [...lain, r] };
}

/** Bingkai sementara animasi: sorotan pengguna disembunyikan, diganti sorotan bantu. */
function bingkai(state: MatrixLabState, ranges: MatrixRange[]): MatrixLabState {
  return { ...state, ranges };
}

function sorotBarisPenuh(state: MatrixLabState, baris: number, tone: LabTone): MatrixRange {
  return { r1: baris, c1: 0, r2: baris, c2: matrixCols(state) - 1, tone };
}

function sorotKolomPenuh(state: MatrixLabState, kolom: number, tone: LabTone): MatrixRange {
  return { r1: 0, c1: kolom, r2: state.rows.length - 1, c2: kolom, tone };
}

function isiBaris(row: readonly MatrixCell[]): string {
  return row.map((c) => c.value).join(", ");
}

/** Sel baru; pemanggil yang menaikkan pencacah id-nya. */
function selBaru(nextId: number, value: string): MatrixCell {
  return { id: nextId, value, note: null };
}

// ── Pemetaan transformasi (sel membawa id & catatannya) ─────────────────

function transposeState(state: MatrixLabState): MatrixLabState {
  const R = state.rows.length;
  const C = matrixCols(state);
  const rows: MatrixCell[][] = Array.from({ length: C }, (_, c) =>
    Array.from({ length: R }, (_, r) => state.rows[r][c]),
  );
  return {
    rows,
    pointers: state.pointers.map((p) => ({ ...p, row: p.col, col: p.row })),
    ranges: state.ranges.map((x) => ({ r1: x.c1, c1: x.r1, r2: x.c2, c2: x.r2, tone: x.tone })),
    nextId: state.nextId,
  };
}

function balikTiapBarisState(state: MatrixLabState): MatrixLabState {
  const C = matrixCols(state);
  return {
    rows: state.rows.map((row) => [...row].reverse()),
    pointers: state.pointers.map((p) => ({ ...p, col: C - 1 - p.col })),
    ranges: state.ranges.map((x) => ({ ...x, c1: C - 1 - x.c2, c2: C - 1 - x.c1 })),
    nextId: state.nextId,
  };
}

function balikUrutanBarisState(state: MatrixLabState): MatrixLabState {
  const R = state.rows.length;
  return {
    rows: [...state.rows].reverse(),
    pointers: state.pointers.map((p) => ({ ...p, row: R - 1 - p.row })),
    ranges: state.ranges.map((x) => ({ ...x, r1: R - 1 - x.r2, r2: R - 1 - x.r1 })),
    nextId: state.nextId,
  };
}

/** Teks isian kisi: baris dipisah `;` atau baris baru, nilai dipisah koma/spasi. */
function uraiTeksKisi(teks: string): string[][] {
  return teks
    .split(/[;\r\n]+/)
    .map((baris) =>
      baris
        .split(/[,\s]+/)
        .map((v) => cleanLabText(v))
        .filter((v) => v.length > 0),
    )
    .filter((baris) => baris.length > 0);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyMatrixOp(state: MatrixLabState, op: MatrixOp): MatrixOpResult {
  const R = state.rows.length;
  const C = matrixCols(state);

  switch (op.kind) {
    // ── Bentuk & isi ──────────────────────────────────────────────────────
    case "isiDariTeks": {
      const kisi = uraiTeksKisi(op.teks);
      if (kisi.length === 0) return gagal("Tulis minimal satu baris nilai, mis. 1 2 3; 4 5 6.");
      if (kisi.length > MATRIX_MAX_ROWS) return gagal(`Paling banyak ${MATRIX_MAX_ROWS} baris.`);

      const lebar = kisi[0].length;
      if (lebar > MATRIX_MAX_COLS) return gagal(`Paling banyak ${MATRIX_MAX_COLS} kolom per baris.`);
      for (let r = 1; r < kisi.length; r++) {
        if (kisi[r].length !== lebar) {
          return gagal(
            `Baris ${r} berisi ${kisi[r].length} nilai, padahal baris 0 berisi ${lebar}. Array 2D harus berbentuk persegi panjang.`,
          );
        }
      }
      for (const baris of kisi) {
        for (const v of baris) if (!LAB_VALUE_RE.test(v)) return gagal(`"${v}": ${GALAT_NILAI}`);
      }

      let nextId = state.nextId;
      const rows = kisi.map((baris) => baris.map((v) => selBaru(nextId++, v)));
      // Penunjuk dibawa (lalu di-clamp), sorotan dibuang: sorotan menunjuk
      // petak yang isinya sudah diganti, sedangkan penunjuk masih bermakna.
      const akhir: MatrixLabState = { rows, pointers: state.pointers, ranges: [], nextId };
      return berhasil([
        langkah(akhir, `Array 2D diisi ulang menjadi ${kisi.length} baris × ${lebar} kolom.`),
      ]);
    }

    case "acak": {
      const { jumlahBaris, jumlahKolom, maks, benih } = op;
      if (!Number.isInteger(jumlahBaris) || jumlahBaris < 1 || jumlahBaris > MATRIX_MAX_ROWS) {
        return gagal(`Jumlah baris harus 1 sampai ${MATRIX_MAX_ROWS}.`);
      }
      if (!Number.isInteger(jumlahKolom) || jumlahKolom < 1 || jumlahKolom > MATRIX_MAX_COLS) {
        return gagal(`Jumlah kolom harus 1 sampai ${MATRIX_MAX_COLS}.`);
      }
      if (!Number.isInteger(maks) || maks < 1 || maks > MATRIX_MAX_RANDOM_VALUE) {
        return gagal(`Nilai terbesar harus 1 sampai ${MATRIX_MAX_RANDOM_VALUE}.`);
      }
      if (!Number.isInteger(benih)) return gagal("Benih acak harus bilangan bulat.");

      const acak = mulberry32(benih);
      let nextId = state.nextId;
      const rows = Array.from({ length: jumlahBaris }, () =>
        Array.from({ length: jumlahKolom }, () => selBaru(nextId++, String(Math.floor(acak() * (maks + 1))))),
      );
      const akhir: MatrixLabState = { rows, pointers: state.pointers, ranges: [], nextId };
      return berhasil([
        langkah(akhir, `Array 2D ${jumlahBaris}×${jumlahKolom} diisi angka acak 0 sampai ${maks} dengan benih ${benih}.`),
      ]);
    }

    case "kosongkan":
      if (R === 0) return berhasil([langkah(state, "Array 2D sudah kosong, tidak ada yang perlu dihapus.")]);
      return berhasil([
        langkah({ ...state, rows: [] }, `Seluruh ${R * C} elemen dihapus; array 2D kini kosong.`),
      ]);

    case "tambahBaris": {
      const nilai = nilaiBersih(op.nilai);
      if (nilai === null) return gagal(GALAT_NILAI);
      if (R >= MATRIX_MAX_ROWS) return gagal(`Array 2D sudah ${MATRIX_MAX_ROWS} baris, tidak bisa ditambah lagi.`);
      if (!Number.isInteger(op.baris) || op.baris < 0 || op.baris > R) {
        return gagal(`Baris baru bisa disisipkan di posisi 0 sampai ${R}.`);
      }

      let nextId = state.nextId;
      const lebar = Math.max(C, 1);
      const baru = Array.from({ length: lebar }, () => selBaru(nextId++, nilai));
      const rows = [...state.rows.slice(0, op.baris), baru, ...state.rows.slice(op.baris)];
      const k = op.baris;
      const akhir: MatrixLabState = {
        rows,
        pointers: state.pointers.map((p) => (p.row >= k ? { ...p, row: p.row + 1 } : p)),
        ranges: state.ranges
          .filter((x) => x.r2 < k || x.r1 >= k)
          .map((x) => (x.r1 >= k ? { ...x, r1: x.r1 + 1, r2: x.r2 + 1 } : x)),
        nextId,
      };
      const fokus = baru.map((_, c) => k * lebar + c);
      return berhasil([
        langkah(bingkai(akhir, [sorotBarisPenuh(akhir, k, "hasil")]), `Baris baru berisi ${nilai} disisipkan di indeks ${k}.`, fokus),
        langkah(akhir, `Ukuran array 2D kini ${ukuran(akhir)}.`),
      ]);
    }

    case "hapusBaris": {
      const g = galatBaris(state, op.baris);
      if (g) return gagal(g);
      const k = op.baris;
      const akhir: MatrixLabState = {
        rows: state.rows.filter((_, r) => r !== k),
        pointers: state.pointers.map((p) => (p.row > k ? { ...p, row: p.row - 1 } : p)),
        ranges: state.ranges
          .filter((x) => x.r2 < k || x.r1 > k)
          .map((x) => (x.r1 > k ? { ...x, r1: x.r1 - 1, r2: x.r2 - 1 } : x)),
        nextId: state.nextId,
      };
      const fokus = state.rows[k].map((_, c) => datar(state, k, c));
      return berhasil([
        langkah(bingkai(state, [sorotBarisPenuh(state, k, "buang")]), `Baris ${k} (${isiBaris(state.rows[k])}) akan dihapus.`, fokus),
        langkah(akhir, akhir.rows.length === 0 ? "Baris terakhir dihapus; array 2D kini kosong." : `Baris ${k} dihapus; ukuran kini ${ukuran(akhir)}.`),
      ]);
    }

    case "tambahKolom": {
      const nilai = nilaiBersih(op.nilai);
      if (nilai === null) return gagal(GALAT_NILAI);
      if (C >= MATRIX_MAX_COLS) return gagal(`Array 2D sudah ${MATRIX_MAX_COLS} kolom, tidak bisa ditambah lagi.`);
      if (!Number.isInteger(op.kolom) || op.kolom < 0 || op.kolom > C) {
        return gagal(`Kolom baru bisa disisipkan di posisi 0 sampai ${C}.`);
      }

      let nextId = state.nextId;
      const k = op.kolom;
      const sumber = R === 0 ? [[] as MatrixCell[]] : state.rows;
      const rows = sumber.map((row) => [...row.slice(0, k), selBaru(nextId++, nilai), ...row.slice(k)]);
      const akhir: MatrixLabState = {
        rows,
        pointers: state.pointers.map((p) => (p.col >= k ? { ...p, col: p.col + 1 } : p)),
        ranges: state.ranges
          .filter((x) => x.c2 < k || x.c1 >= k)
          .map((x) => (x.c1 >= k ? { ...x, c1: x.c1 + 1, c2: x.c2 + 1 } : x)),
        nextId,
      };
      const lebarBaru = matrixCols(akhir);
      const fokus = rows.map((_, r) => r * lebarBaru + k);
      return berhasil([
        langkah(bingkai(akhir, [sorotKolomPenuh(akhir, k, "hasil")]), `Kolom baru berisi ${nilai} disisipkan di indeks ${k}.`, fokus),
        langkah(akhir, `Ukuran array 2D kini ${ukuran(akhir)}.`),
      ]);
    }

    case "hapusKolom": {
      const g = galatKolom(state, op.kolom);
      if (g) return gagal(g);
      const k = op.kolom;
      const akhir: MatrixLabState = {
        rows: state.rows.map((row) => row.filter((_, c) => c !== k)),
        pointers: state.pointers.map((p) => (p.col > k ? { ...p, col: p.col - 1 } : p)),
        ranges: state.ranges
          .filter((x) => x.c2 < k || x.c1 > k)
          .map((x) => (x.c1 > k ? { ...x, c1: x.c1 - 1, c2: x.c2 - 1 } : x)),
        nextId: state.nextId,
      };
      const fokus = state.rows.map((_, r) => datar(state, r, k));
      return berhasil([
        langkah(bingkai(state, [sorotKolomPenuh(state, k, "buang")]), `Kolom ${k} akan dihapus dari setiap baris.`, fokus),
        langkah(akhir, matrixCols(akhir) === 0 ? "Kolom terakhir dihapus; array 2D kini kosong." : `Kolom ${k} dihapus; ukuran kini ${ukuran(akhir)}.`),
      ]);
    }

    // ── Akses ─────────────────────────────────────────────────────────────
    case "setSel":
    case "bacaSel": {
      const g = galatSel(state, op.baris, op.kolom);
      if (g) return gagal(g);
      const { baris: i, kolom: j } = op;
      const nilai = op.kind === "setSel" ? nilaiBersih(op.nilai) : null;
      if (op.kind === "setSel" && nilai === null) return gagal(GALAT_NILAI);

      // arr[i][j] diurai dua langkah, seperti cara membacanya: indeks pertama
      // memilih SATU BARIS (yang sendirinya sebuah array 1D), indeks kedua
      // memilih sel di baris itu. Siswa awam sering mengira [i] adalah kolom;
      // melihat barisnya menyala lebih dulu meluruskan itu.
      const o = datar(state, i, j);
      const lama = state.rows[i][j];
      const steps: MatrixStep[] = [
        langkah(
          bingkai(state, [sorotBarisPenuh(state, i, "sorot")]),
          `Indeks pertama [${i}] memilih BARIS: arr[${i}] adalah baris ke-${i + 1} dari atas, isinya ${isiBaris(state.rows[i])}.`,
        ),
        langkah(
          bingkai(state, [sorotBarisPenuh(state, i, "sorot"), sorotKolomPenuh(state, j, "banding")]),
          `Indeks kedua [${j}] memilih KOLOM ke-${j + 1} dari kiri. Tempat baris ${i} dan kolom ${j} bersilangan adalah arr[${i}][${j}].`,
          [o],
        ),
      ];
      if (op.kind === "bacaSel") {
        // Membaca tidak mengubah apa pun: langkah terakhir adalah keadaan semula.
        steps.push(langkah(state, `arr[${i}][${j}] bernilai ${lama.value}.`, [o]));
      } else {
        const rows = state.rows.map((row, r) =>
          r === i ? row.map((sel, c) => (c === j ? { ...sel, value: nilai as string } : sel)) : row,
        );
        steps.push(langkah({ ...state, rows }, `arr[${i}][${j}] diubah dari ${lama.value} menjadi ${nilai}.`, [o]));
      }
      return berhasil(steps);
    }

    case "catat": {
      const g = galatSel(state, op.baris, op.kolom);
      if (g) return gagal(g);
      const catatan = cleanLabText(op.catatan);
      const target = state.rows[op.baris][op.kolom];

      if (catatan.length === 0) {
        if (target.note === null) {
          return berhasil([langkah(state, `arr[${op.baris}][${op.kolom}] memang tidak punya catatan.`, [datar(state, op.baris, op.kolom)])]);
        }
      } else {
        if (!LAB_NOTE_RE.test(catatan)) {
          return gagal(`Catatan harus paling banyak ${LAB_MAX_NOTE_CHARS} karakter berisi huruf, angka, spasi, titik, atau tanda minus.`);
        }
        const terpakai = state.rows.flat().filter((s) => s.note !== null && s.id !== target.id).length;
        if (terpakai >= MATRIX_MAX_NOTES) {
          return gagal(`Catatan sudah ${MATRIX_MAX_NOTES}. Lepas catatan lain dulu.`);
        }
      }

      const note = catatan.length === 0 ? null : catatan;
      const rows = state.rows.map((row, r) =>
        r === op.baris ? row.map((sel, c) => (c === op.kolom ? { ...sel, note } : sel)) : row,
      );
      return berhasil([
        langkah(
          { ...state, rows },
          note === null ? `Catatan di arr[${op.baris}][${op.kolom}] dilepas.` : `arr[${op.baris}][${op.kolom}] diberi catatan "${note}".`,
          [datar(state, op.baris, op.kolom)],
        ),
      ]);
    }

    // ── Penanda ───────────────────────────────────────────────────────────
    case "setPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      if (!LAB_POINTER_NAME_RE.test(nama)) {
        return gagal("Nama penunjuk diawali huruf, berisi huruf kecil atau angka, paling banyak 6 karakter.");
      }
      const g = galatSel(state, op.baris, op.kolom);
      if (g) return gagal(g);
      const lain = state.pointers.filter((p) => p.name !== nama);
      if (lain.length >= MATRIX_MAX_POINTERS) {
        return gagal(`Penunjuk sudah ${MATRIX_MAX_POINTERS}. Hapus salah satu dulu.`);
      }
      const p: MatrixPointer = { name: nama, row: op.baris, col: op.kolom, tone: op.tone };
      return berhasil([
        langkah(
          { ...state, pointers: [...lain, p] },
          `Penunjuk ${nama} dipasang di arr[${op.baris}][${op.kolom}], yang bernilai ${state.rows[op.baris][op.kolom].value}.`,
          [datar(state, op.baris, op.kolom)],
        ),
      ]);
    }

    case "geserPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      const p = state.pointers.find((x) => x.name === nama);
      if (!p) return gagal(`Penunjuk ${nama || "itu"} belum dipasang di papan.`);
      if (!Number.isInteger(op.dBaris) || !Number.isInteger(op.dKolom)) {
        return gagal("Jarak geser harus bilangan bulat.");
      }
      const row = p.row + op.dBaris;
      const col = p.col + op.dKolom;
      if (row < 0 || row >= R || col < 0 || col >= C) {
        return gagal(`Penunjuk ${nama} akan keluar kisi di (${row}, ${col}); kisinya ${R}×${C}.`);
      }
      const pointers = state.pointers.map((x) => (x.name === nama ? { ...x, row, col } : x));
      return berhasil([
        langkah(
          { ...state, pointers },
          `Penunjuk ${nama} bergeser dari arr[${p.row}][${p.col}] ke arr[${row}][${col}].`,
          [datar(state, row, col)],
        ),
      ]);
    }

    case "hapusPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      if (!state.pointers.some((p) => p.name === nama)) return gagal(`Penunjuk ${nama || "itu"} memang tidak ada.`);
      return berhasil([
        langkah({ ...state, pointers: state.pointers.filter((p) => p.name !== nama) }, `Penunjuk ${nama} dilepas dari papan.`),
      ]);
    }

    case "sorotBaris": {
      const g = galatBaris(state, op.baris);
      if (g) return gagal(g);
      const hasil = tambahSorotan(state, sorotBarisPenuh(state, op.baris, op.tone));
      if (typeof hasil === "string") return gagal(hasil);
      return berhasil([langkah(hasil, `Baris ${op.baris} disorot: ${isiBaris(state.rows[op.baris])}.`)]);
    }

    case "sorotKolom": {
      const g = galatKolom(state, op.kolom);
      if (g) return gagal(g);
      const hasil = tambahSorotan(state, sorotKolomPenuh(state, op.kolom, op.tone));
      if (typeof hasil === "string") return gagal(hasil);
      const isi = state.rows.map((row) => row[op.kolom].value).join(", ");
      return berhasil([langkah(hasil, `Kolom ${op.kolom} disorot: ${isi}.`)]);
    }

    case "sorotSubKisi": {
      const g =
        galatSel(state, op.dariBaris, op.dariKolom) ?? galatSel(state, op.sampaiBaris, op.sampaiKolom);
      if (g) return gagal(g);
      if (op.dariBaris > op.sampaiBaris || op.dariKolom > op.sampaiKolom) {
        return gagal("Sudut awal sub-kisi harus di kiri-atas sudut akhirnya.");
      }
      const hasil = tambahSorotan(state, {
        r1: op.dariBaris,
        c1: op.dariKolom,
        r2: op.sampaiBaris,
        c2: op.sampaiKolom,
        tone: op.tone,
      });
      if (typeof hasil === "string") return gagal(hasil);
      const tinggi = op.sampaiBaris - op.dariBaris + 1;
      const lebar = op.sampaiKolom - op.dariKolom + 1;
      return berhasil([
        langkah(
          hasil,
          `Sub-kisi ${tinggi}×${lebar} dari arr[${op.dariBaris}][${op.dariKolom}] sampai arr[${op.sampaiBaris}][${op.sampaiKolom}] disorot.`,
        ),
      ]);
    }

    case "hapusSorotan":
      if (state.ranges.length === 0) return berhasil([langkah(state, "Tidak ada sorotan yang perlu dihapus.")]);
      return berhasil([langkah({ ...state, ranges: [] }, `${state.ranges.length} sorotan dihapus dari papan.`)]);

    // ── Penelusuran ───────────────────────────────────────────────────────
    case "telusurBaris":
    case "telusurKolom": {
      if (R === 0) return gagal("Array 2D masih kosong, tidak ada elemen yang bisa ditelusuri.");
      const perBaris = op.kind === "telusurBaris";
      const steps: MatrixStep[] = [
        langkah(
          state,
          perBaris
            ? `Penelusuran baris demi baris: untuk setiap baris i, kunjungi kolom j dari 0 sampai ${C - 1}.`
            : `Penelusuran kolom demi kolom: untuk setiap kolom j, kunjungi baris i dari 0 sampai ${R - 1}.`,
        ),
      ];

      let ke = 0;
      const jalur: number[] = [];
      const luar = perBaris ? R : C;
      const dalam = perBaris ? C : R;
      for (let a = 0; a < luar; a++) {
        for (let b = 0; b < dalam; b++) {
          const r = perBaris ? a : b;
          const c = perBaris ? b : a;
          ke++;
          jalur.push(state.rows[r][c].id);
          const bantu = perBaris ? sorotBarisPenuh(state, r, "sorot") : sorotKolomPenuh(state, c, "sorot");
          // Pindah baris/kolom diberi kalimat sendiri: di situlah lompatan
          // panjang pada jejaknya terjadi, dan di situlah siswa bingung.
          const pindah = b === 0 && a > 0 ? (perBaris ? `Baris ${r - 1} habis, turun ke baris ${r}. ` : `Kolom ${c - 1} habis, pindah ke kolom ${c}. `) : "";
          steps.push(
            langkah(
              bingkai(state, [bantu]),
              `${pindah}Kunjungan ke-${ke}: i=${r}, j=${c}, arr[${r}][${c}] = ${state.rows[r][c].value}.`,
              [datar(state, r, c)],
              LAB_VISIT_HOLD_MS,
              { jalur: [...jalur] },
            ),
          );
        }
      }
      steps.push(
        langkah(
          state,
          `Penelusuran ${perBaris ? "baris demi baris" : "kolom demi kolom"} selesai: ${R * C} elemen dikunjungi. Perhatikan pola panahnya.`,
          [],
          LAB_STEP_HOLD_MS,
          { jalur },
        ),
      );
      return berhasil(steps);
    }

    case "telusurDiagonal": {
      if (R === 0) return gagal("Array 2D masih kosong, tidak ada elemen yang bisa ditelusuri.");
      const panjang = Math.min(R, C);
      const steps: MatrixStep[] = [
        langkah(state, `Penelusuran diagonal utama: elemen arr[k][k] untuk k dari 0 sampai ${panjang - 1}.`),
      ];
      const nilai: string[] = [];
      const jalur: number[] = [];
      for (let k = 0; k < panjang; k++) {
        nilai.push(state.rows[k][k].value);
        jalur.push(state.rows[k][k].id);
        steps.push(
          langkah(
            state,
            `Kunjungan ke-${k + 1}: arr[${k}][${k}] = ${state.rows[k][k].value} — indeks baris dan kolomnya sama-sama ${k}.`,
            [datar(state, k, k)],
            LAB_VISIT_HOLD_MS,
            { jalur: [...jalur] },
          ),
        );
      }
      steps.push(langkah(state, `Diagonal utama selesai ditelusuri: ${nilai.join(", ")}.`, [], LAB_STEP_HOLD_MS, { jalur }));
      return berhasil(steps);
    }

    // ── Transformasi ──────────────────────────────────────────────────────
    case "transpose": {
      if (R === 0) return berhasil([langkah(state, "Array 2D masih kosong, tidak ada yang berubah.")]);
      const diagonal = Array.from({ length: Math.min(R, C) }, (_, k) => datar(state, k, k));
      const hasil = transposeState(state);
      const kelompok = kelompokBaris(state);
      const steps: MatrixStep[] = [
        langkah(
          state,
          `Transpose: setiap BARIS akan berdiri menjadi KOLOM — arr[i][j] pindah ke arr[j][i]. Tiap baris diberi warna sendiri; ikuti warnanya.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(
          state,
          `Sel bercincin ada di diagonal utama (i = j), jadi tempatnya tidak berubah. Sel lain akan berpindah.`,
          diagonal,
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(
          hasil,
          `Semua sel meluncur bersamaan ke posisi barunya; ukuran ${R}×${C} menjadi ${C}×${R}.`,
          [],
          LAB_MOVE_HOLD_MS,
          { kelompok },
        ),
      ];
      for (let k = 0; k < R; k++) {
        steps.push(
          langkah(
            hasil,
            `Baris ${k} semula (${isiBaris(state.rows[k])}) kini berdiri sebagai kolom ${k}.`,
            offsetDariId(hasil, new Set(state.rows[k].map((c) => c.id))),
            LAB_STEP_HOLD_MS,
            { kelompok },
          ),
        );
      }
      steps.push(langkah(hasil, `Transpose selesai; ukuran kini ${ukuran(hasil)}.`));
      return berhasil(steps);
    }

    case "balikTiapBaris": {
      if (R === 0 || C < 2) {
        return berhasil([langkah(state, `Setiap baris berisi ${C} elemen, jadi membaliknya tidak mengubah apa pun.`)]);
      }
      const kelompok = kelompokKolom(state);
      const steps: MatrixStep[] = [
        langkah(
          state,
          `Setiap baris akan dibalik kiri-kanan: kolom j bertukar tempat dengan kolom ${C - 1}−j. Tiap kolom diberi warna; ikuti warnanya.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
      ];
      let berjalan: MatrixLabState = { ...state };
      for (let r = 0; r < R; r++) {
        const lama = isiBaris(berjalan.rows[r]);
        berjalan = { ...berjalan, rows: berjalan.rows.map((row, i) => (i === r ? [...row].reverse() : row)) };
        steps.push(
          langkah(
            berjalan,
            `Baris ${r} dibalik: ${lama} menjadi ${isiBaris(berjalan.rows[r])}.`,
            Array.from({ length: C }, (_, c) => r * C + c),
            LAB_MOVE_HOLD_MS,
            { kelompok },
          ),
        );
      }
      steps.push(langkah(balikTiapBarisState(state), "Setiap baris selesai dibalik — hasilnya cerminan kiri-kanan."));
      return berhasil(steps);
    }

    case "balikUrutanBaris": {
      if (R < 2) {
        return berhasil([langkah(state, `Array 2D berisi ${R} baris, jadi membalik urutannya tidak mengubah apa pun.`)]);
      }
      const kelompok = kelompokBaris(state);
      const steps: MatrixStep[] = [
        langkah(
          state,
          `Urutan baris akan dibalik dengan menukar pasangan baris dari kedua ujung. Tiap baris diberi warna; ikuti warnanya.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
      ];
      let rows = [...state.rows];
      for (let a = 0, b = R - 1; a < b; a++, b--) {
        [rows[a], rows[b]] = [rows[b], rows[a]];
        rows = [...rows];
        const sementara: MatrixLabState = { ...state, rows };
        steps.push(
          langkah(
            sementara,
            `Baris ${a} bertukar tempat dengan baris ${b}.`,
            [...Array.from({ length: C }, (_, c) => a * C + c), ...Array.from({ length: C }, (_, c) => b * C + c)],
            LAB_MOVE_HOLD_MS,
            { kelompok },
          ),
        );
      }
      steps.push(langkah(balikUrutanBarisState(state), "Urutan baris selesai dibalik — hasilnya cerminan atas-bawah."));
      return berhasil(steps);
    }

    case "putar90": {
      if (R === 0) return berhasil([langkah(state, "Array 2D masih kosong, tidak ada yang berubah.")]);
      const tengah = transposeState(state);
      const akhir = balikTiapBarisState(tengah);
      const kelompok = kelompokBaris(state);
      return berhasil([
        langkah(
          state,
          `Memutar 90° searah jarum jam = transpose, lalu balik setiap baris. Tiap baris diberi warna; ikuti warnanya.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(tengah, `Tahap 1 — transpose: baris menjadi kolom, ukuran ${R}×${C} menjadi ${C}×${R}.`, [], LAB_MOVE_HOLD_MS, { kelompok }),
        langkah(akhir, "Tahap 2 — setiap baris dibalik kiri-kanan.", [], LAB_MOVE_HOLD_MS, { kelompok }),
        langkah(
          akhir,
          `Baris 0 semula kini menjadi kolom paling kanan (kolom ${R - 1}) — persis seperti kertas yang diputar searah jarum jam.`,
          offsetDariId(akhir, new Set(state.rows[0].map((c) => c.id))),
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(akhir, `Array 2D selesai diputar 90° searah jarum jam; ukuran kini ${ukuran(akhir)}.`),
      ]);
    }

    default: {
      const _lengkap: never = op;
      throw new Error(`applyMatrixOp: operasi tidak dikenal (${JSON.stringify(_lengkap)}).`);
    }
  }
}
