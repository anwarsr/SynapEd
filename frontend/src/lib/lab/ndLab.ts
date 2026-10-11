/**
 * Lab array N-dimensi: berapa pun jumlah dimensinya (dalam batas tampilan).
 *
 * Isinya disimpan DATAR dalam urutan baris-demi-baris (row-major) — persis
 * seperti array multidimensi tersimpan di memori. Bentuk (`shape`) hanyalah
 * cara membaca deret datar itu. Itulah inti pelajarannya, dan karena itu
 * model ini dipilih: `ubahBentuk` (reshape) tidak memindahkan satu elemen pun
 * di memori, sementara `tukarSumbu` benar-benar menyusun ulang deretnya.
 *
 * Indeks `fokus` di setiap langkah adalah OFFSET datar (posisi di memori).
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/`.
 */
import { mulberry32 } from "./labRandom";
import { galatTerlaluPanjang, isArahUrut, langkahUrut, type ArahUrut, type DeretUrut, type KindUrut } from "./labSort";
import {
  LAB_MAX_STEPS_URUT,
  cleanLabText,
  LAB_MAX_ITEM_CHARS,
  LAB_MOVE_HOLD_MS,
  LAB_STEP_HOLD_MS,
  LAB_VISIT_HOLD_MS,
  type LabKelompok,
  LAB_VALUE_RE,
  type LabOpResult,
  type LabStep,
  type LabTone,
} from "./labTypes";

/** Lebih dari 6 dimensi, kotak bersarangnya tidak lagi terbaca di layar. */
export const ND_MAX_DIMS = 6;
/** Panjang maksimal tiap dimensi. */
export const ND_MAX_SIZE = 6;
/** Batas jumlah elemen keseluruhan — papan tetap muat di satu layar. */
export const ND_MAX_ELEMENTS = 120;
export const ND_MAX_SLICES = 4;
/** Penelusuran 120 elemen + pembuka + penutup. */
export const ND_MAX_STEPS = 130;
const ND_MAX_RANDOM_VALUE = Math.pow(10, LAB_MAX_ITEM_CHARS) - 1;

export interface NdCell {
  id: number;
  value: string;
}

/** Irisan yang disorot: semua elemen yang koordinat sumbu `axis`-nya `index`. */
export interface NdSlice {
  axis: number;
  index: number;
  tone: LabTone;
}

export interface NdLabState {
  /** Panjang tiap dimensi; `[]` = array kosong. */
  shape: number[];
  /** Isi datar, urutan row-major. Panjangnya = hasil kali `shape`. */
  cells: NdCell[];
  /** Kursor indeks (satu penunjuk multi-koordinat), atau null. */
  cursor: number[] | null;
  slices: NdSlice[];
  nextId: number;
}

export type NdStep = LabStep<NdLabState>;
export type NdOpResult = LabOpResult<NdLabState>;

export type NdOp =
  | { kind: "buat"; bentuk: string }
  | { kind: "isiAcak"; maks: number; benih: number }
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "ubahBentuk"; bentuk: string }
  | { kind: "kosongkan" }
  | { kind: "bacaElemen"; indeks: string }
  | { kind: "setElemen"; indeks: string; nilai: string }
  | { kind: "setKursor"; indeks: string }
  | { kind: "hapusKursor" }
  | { kind: "sorotIrisan"; sumbu: number; posisi: number; tone: LabTone }
  | { kind: "hapusSorotan" }
  | { kind: "telusuri" }
  | { kind: "tukarSumbu"; sumbuA: number; sumbuB: number }
  /** `sumbu: null` = seluruh array sebagai satu deret (urutan memori). */
  | { kind: KindUrut; arah: ArahUrut; sumbu: number | null };

// ---------------------------------------------------------------------------
// Aritmetika bentuk & indeks — diekspor karena papan memakainya juga
// ---------------------------------------------------------------------------

/** Jumlah elemen; 0 untuk array kosong. */
export function ndTotal(shape: readonly number[]): number {
  return shape.length === 0 ? 0 : shape.reduce((a, b) => a * b, 1);
}

/**
 * Langkah alamat tiap sumbu: berapa posisi memori yang dilompati kalau indeks
 * sumbu itu naik satu. Untuk bentuk [2,3,4] hasilnya [12, 4, 1].
 */
export function ndStrides(shape: readonly number[]): number[] {
  const hasil = new Array<number>(shape.length).fill(1);
  for (let k = shape.length - 2; k >= 0; k--) hasil[k] = hasil[k + 1] * shape[k + 1];
  return hasil;
}

export function ndOffset(indeks: readonly number[], shape: readonly number[]): number {
  const s = ndStrides(shape);
  return indeks.reduce((n, v, k) => n + v * s[k], 0);
}

export function ndKoordinat(offset: number, shape: readonly number[]): number[] {
  const s = ndStrides(shape);
  return s.map((stride, k) => Math.floor(offset / stride) % shape[k]);
}

/** `[1][2][0]` — notasi yang dipakai di narasi dan label papan. */
export function ndLabelIndeks(indeks: readonly number[]): string {
  return indeks.map((v) => `[${v}]`).join("");
}

/** `[2][3][4]` sebagai deklarasi bentuk. */
export function ndLabelBentuk(shape: readonly number[]): string {
  return shape.length === 0 ? "kosong" : shape.map((v) => `[${v}]`).join("");
}

/**
 * Mengurai bentuk dari teks: `2,3,4`, `2 3 4`, `2x3x4`, atau `[2][3][4]`.
 * Mengembalikan pesan galat berbahasa Indonesia kalau tidak sah.
 */
export function parseNdBentuk(raw: string): number[] | string {
  const potong = raw
    .split(/[,\s×x\]\[]+/i)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (potong.length === 0) return "Tuliskan panjang tiap dimensi, mis. 2, 3, 4.";
  if (potong.length > ND_MAX_DIMS) return `Paling banyak ${ND_MAX_DIMS} dimensi.`;

  const shape: number[] = [];
  for (const p of potong) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > ND_MAX_SIZE) {
      return `Panjang setiap dimensi harus 1 sampai ${ND_MAX_SIZE}; "${p}" tidak sah.`;
    }
    shape.push(n);
  }
  const total = ndTotal(shape);
  if (total > ND_MAX_ELEMENTS) {
    return `Bentuk ${ndLabelBentuk(shape)} berisi ${total} elemen; paling banyak ${ND_MAX_ELEMENTS} supaya papan tetap terbaca.`;
  }
  return shape;
}

/** Mengurai indeks: `1,2,0`, `1 2 0`, atau `[1][2][0]`. */
export function parseNdIndeks(raw: string, shape: readonly number[]): number[] | string {
  if (shape.length === 0) return "Array masih kosong. Buat bentuknya dulu.";
  const potong = raw
    .split(/[,\s\]\[]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (potong.length !== shape.length) {
    return `Array ${shape.length} dimensi butuh ${shape.length} indeks, mis. ${ndLabelIndeks(shape.map(() => 0))}; yang diberikan ${potong.length}.`;
  }
  const indeks: number[] = [];
  for (let k = 0; k < potong.length; k++) {
    const n = Number(potong[k]);
    if (!Number.isInteger(n) || n < 0 || n >= shape[k]) {
      return `Indeks sumbu ${k} harus 0 sampai ${shape[k] - 1}; "${potong[k]}" tidak sah.`;
    }
    indeks.push(n);
  }
  return indeks;
}

// ---------------------------------------------------------------------------
// Pembentuk & penjaga
// ---------------------------------------------------------------------------

export function emptyNdState(): NdLabState {
  return { shape: [], cells: [], cursor: null, slices: [], nextId: 0 };
}

/** Keadaan dari bentuk & nilai datar yang SUDAH sah; id diberikan berurutan. */
export function ndStateFromValues(shape: readonly number[], values: readonly string[]): NdLabState {
  let nextId = 0;
  return settleNd({
    shape: [...shape],
    cells: values.map((value) => ({ id: nextId++, value })),
    cursor: null,
    slices: [],
    nextId,
  });
}

function kursorSah(cursor: readonly number[] | null, shape: readonly number[]): boolean {
  return (
    cursor !== null &&
    cursor.length === shape.length &&
    cursor.every((v, k) => Number.isInteger(v) && v >= 0 && v < shape[k])
  );
}

/** Kursor yang tidak lagi cocok dengan bentuk dilepas; irisan di luar batas dibuang. */
export function settleNd(state: NdLabState): NdLabState {
  if (state.shape.length === 0) return { shape: [], cells: [], cursor: null, slices: [], nextId: state.nextId };
  return {
    ...state,
    cursor: kursorSah(state.cursor, state.shape) ? state.cursor : null,
    slices: state.slices.filter(
      (s) => Number.isInteger(s.axis) && s.axis >= 0 && s.axis < state.shape.length && s.index >= 0 && s.index < state.shape[s.axis],
    ),
  };
}

export function assertNdInvariants(state: NdLabState): string | null {
  const { shape, cells } = state;
  if (shape.length > ND_MAX_DIMS) return `Dimensi ${shape.length} melebihi ${ND_MAX_DIMS}.`;
  for (const n of shape) {
    if (!Number.isInteger(n) || n < 1 || n > ND_MAX_SIZE) return `Panjang dimensi ${n} tidak sah.`;
  }
  const total = ndTotal(shape);
  if (total > ND_MAX_ELEMENTS) return `Jumlah elemen ${total} melebihi ${ND_MAX_ELEMENTS}.`;
  if (cells.length !== total) return `Isi ${cells.length} elemen tidak cocok dengan bentuk ${ndLabelBentuk(shape)}.`;

  const ids = new Set<number>();
  for (const c of cells) {
    if (!LAB_VALUE_RE.test(c.value)) return `Nilai "${c.value}" tidak sah.`;
    if (ids.has(c.id)) return `Id ${c.id} ganda.`;
    if (c.id >= state.nextId) return `Id ${c.id} tidak lebih kecil dari nextId.`;
    ids.add(c.id);
  }

  if (state.cursor !== null && !kursorSah(state.cursor, shape)) return "Kursor keluar dari bentuk array.";
  if (shape.length === 0 && state.cursor !== null) return "Array kosong tidak boleh punya kursor.";

  if (state.slices.length > ND_MAX_SLICES) return "Sorotan terlalu banyak.";
  for (const s of state.slices) {
    if (s.axis < 0 || s.axis >= shape.length || s.index < 0 || s.index >= shape[s.axis]) {
      return `Irisan sumbu ${s.axis} posisi ${s.index} keluar dari bentuk.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penolong internal
// ---------------------------------------------------------------------------

function gagal(error: string): NdOpResult {
  return { ok: false, error };
}

function langkah(
  state: NdLabState,
  narasi: string,
  fokus: number[] = [],
  tahanMs = LAB_STEP_HOLD_MS,
  tanda: Pick<NdStep, "kelompok" | "jalur"> = {},
): NdStep {
  return { state: settleNd(state), narasi, fokus, tahanMs, ...tanda };
}

/** Warna asal menurut indeks sel pada satu sumbu. */
function kelompokSumbu(state: NdLabState, sumbu: number, label: (x: number) => string): LabKelompok {
  const warna: Record<number, number> = {};
  state.cells.forEach((c, o) => (warna[c.id] = ndKoordinat(o, state.shape)[sumbu]));
  return { warna, label: Array.from({ length: state.shape[sumbu] }, (_, x) => label(x)) };
}

/**
 * Langkah-langkah mempersempit alamat, satu sumbu per langkah: setiap indeks
 * memilih satu kotak di dalam kotak sebelumnya. Karena urutannya row-major,
 * isi kotak dengan awalan yang sama selalu BERDERET di memori — itu juga
 * terlihat di pita memori.
 */
function langkahPersempit(state: NdLabState, indeks: readonly number[]): NdStep[] {
  const strides = ndStrides(state.shape);
  const steps: NdStep[] = [];
  let mulai = 0;
  for (let d = 0; d < indeks.length - 1; d++) {
    mulai += indeks[d] * strides[d];
    const awalan = ndLabelIndeks(indeks.slice(0, d + 1));
    steps.push(
      langkah(
        state,
        `Indeks ke-${d + 1} [${indeks[d]}] (sumbu ${d}): masuk ke kotak ${awalan} - tersisa ${strides[d]} elemen, yang berderet di memori mulai offset ${mulai}.`,
        Array.from({ length: strides[d] }, (_, x) => mulai + x),
      ),
    );
  }
  return steps;
}

function berhasil(steps: NdStep[]): NdOpResult {
  if (steps.length > ND_MAX_STEPS) {
    return { ok: true, steps: [...steps.slice(0, ND_MAX_STEPS - 1), steps[steps.length - 1]] };
  }
  return { ok: true, steps };
}

const GALAT_KOSONG = "Array masih kosong. Buat bentuknya dulu lewat kelompok Bentuk & isi.";

/** Rumus offset yang ditulis lengkap: `1×12 + 2×4 + 0×1 = 20`. */
function rumusOffset(indeks: readonly number[], shape: readonly number[]): string {
  const s = ndStrides(shape);
  const suku = indeks.map((v, k) => `${v}×${s[k]}`).join(" + ");
  return `${suku} = ${ndOffset(indeks, shape)}`;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyNdOp(state: NdLabState, op: NdOp): NdOpResult {
  const { shape } = state;
  const total = ndTotal(shape);

  switch (op.kind) {
    case "buat": {
      const bentuk = parseNdBentuk(op.bentuk);
      if (typeof bentuk === "string") return gagal(bentuk);
      const n = ndTotal(bentuk);
      let nextId = state.nextId;
      // Diisi 0, 1, 2, … supaya urutan memori langsung terbaca di papan.
      const cells = Array.from({ length: n }, (_, i) => ({ id: nextId++, value: String(i) }));
      const akhir: NdLabState = { shape: bentuk, cells, cursor: null, slices: [], nextId };
      return berhasil([
        langkah(
          akhir,
          `Array ${bentuk.length} dimensi ${ndLabelBentuk(bentuk)} dibuat: ${n} elemen, diisi 0 sampai ${n - 1} sesuai urutannya di memori.`,
        ),
      ]);
    }

    case "isiAcak": {
      if (total === 0) return gagal(GALAT_KOSONG);
      if (!Number.isInteger(op.maks) || op.maks < 1 || op.maks > ND_MAX_RANDOM_VALUE) {
        return gagal(`Nilai terbesar harus 1 sampai ${ND_MAX_RANDOM_VALUE}.`);
      }
      if (!Number.isInteger(op.benih)) return gagal("Benih acak harus bilangan bulat.");
      const acak = mulberry32(op.benih);
      const cells = state.cells.map((c) => ({ ...c, value: String(Math.floor(acak() * (op.maks + 1))) }));
      return berhasil([
        langkah({ ...state, cells }, `Seluruh ${total} elemen diisi angka acak 0 sampai ${op.maks} dengan benih ${op.benih}.`),
      ]);
    }

    case "isiDariTeks": {
      if (total === 0) return gagal(GALAT_KOSONG);
      const nilai = op.teks
        .split(/[,\s;]+/)
        .map((v) => cleanLabText(v))
        .filter((v) => v.length > 0);
      if (nilai.length !== total) {
        return gagal(`Bentuk ${ndLabelBentuk(shape)} butuh tepat ${total} nilai (urutan memori); yang diberikan ${nilai.length}.`);
      }
      for (const v of nilai) {
        if (!LAB_VALUE_RE.test(v)) return gagal(`"${v}" tidak sah: nilai 1 sampai ${LAB_MAX_ITEM_CHARS} karakter berisi huruf, angka, titik, atau minus.`);
      }
      const cells = state.cells.map((c, i) => ({ ...c, value: nilai[i] }));
      return berhasil([langkah({ ...state, cells }, `${total} nilai diisikan mengikuti urutan memori (row-major).`)]);
    }

    case "ubahBentuk": {
      if (total === 0) return gagal(GALAT_KOSONG);
      const bentuk = parseNdBentuk(op.bentuk);
      if (typeof bentuk === "string") return gagal(bentuk);
      const n = ndTotal(bentuk);
      if (n !== total) {
        return gagal(`Bentuk baru ${ndLabelBentuk(bentuk)} berisi ${n} elemen, padahal array ini berisi ${total}. Reshape harus mempertahankan jumlah elemen.`);
      }
      // Kursor dibawa lewat OFFSET-nya: elemen yang ditunjuk tetap elemen yang
      // sama di memori, hanya alamat bersarangnya yang berubah.
      const cursor = state.cursor === null ? null : ndKoordinat(ndOffset(state.cursor, shape), bentuk);
      const akhir: NdLabState = { ...state, shape: bentuk, cursor, slices: [] };
      const kelompok = kelompokSumbu(state, 0, (x) => `kotak [${x}] semula`);
      return berhasil([
        langkah(
          state,
          `Reshape ${ndLabelBentuk(shape)} → ${ndLabelBentuk(bentuk)}: hanya cara MENGELOMPOKKAN yang berubah. Tiap kotak terluar diberi warna; perhatikan pita memori di bawah.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(
          akhir,
          `Sel meluncur ke kotak barunya, tapi pita memori di bawah TIDAK bergerak sama sekali - urutan di memori tetap sama, warnanya tetap berderet.`,
          [],
          LAB_MOVE_HOLD_MS,
          { kelompok },
        ),
        langkah(akhir, `Bentuk kini ${ndLabelBentuk(bentuk)}; urutan memori tetap sama.`),
      ]);
    }

    case "kosongkan":
      if (total === 0) return berhasil([langkah(state, "Array sudah kosong.")]);
      return berhasil([langkah(emptyNdState(), `Seluruh ${total} elemen dihapus; array kini kosong.`)]);

    case "bacaElemen": {
      const indeks = parseNdIndeks(op.indeks, shape);
      if (typeof indeks === "string") return gagal(indeks);
      const o = ndOffset(indeks, shape);
      return berhasil([
        ...langkahPersempit(state, indeks),
        langkah(
          state,
          `arr${ndLabelIndeks(indeks)} ada di offset ${rumusOffset(indeks, shape)} pada memori, dan nilainya ${state.cells[o].value}.`,
          [o],
        ),
      ]);
    }

    case "setElemen": {
      const indeks = parseNdIndeks(op.indeks, shape);
      if (typeof indeks === "string") return gagal(indeks);
      const nilai = cleanLabText(op.nilai);
      if (!LAB_VALUE_RE.test(nilai)) return gagal(`Nilai harus 1 sampai ${LAB_MAX_ITEM_CHARS} karakter berisi huruf, angka, titik, atau minus.`);
      const o = ndOffset(indeks, shape);
      const lama = state.cells[o].value;
      const cells = state.cells.map((c, i) => (i === o ? { ...c, value: nilai } : c));
      return berhasil([
        ...langkahPersempit(state, indeks),
        langkah({ ...state, cells }, `arr${ndLabelIndeks(indeks)} (offset ${o}) diubah dari ${lama} menjadi ${nilai}.`, [o]),
      ]);
    }

    case "setKursor": {
      const indeks = parseNdIndeks(op.indeks, shape);
      if (typeof indeks === "string") return gagal(indeks);
      const o = ndOffset(indeks, shape);
      return berhasil([
        langkah({ ...state, cursor: indeks }, `Kursor dipasang di arr${ndLabelIndeks(indeks)} - offset ${o}, nilai ${state.cells[o].value}.`, [o]),
      ]);
    }

    case "hapusKursor":
      if (state.cursor === null) return berhasil([langkah(state, "Kursor memang tidak terpasang.")]);
      return berhasil([langkah({ ...state, cursor: null }, "Kursor dilepas dari papan.")]);

    case "sorotIrisan": {
      if (total === 0) return gagal(GALAT_KOSONG);
      if (!Number.isInteger(op.sumbu) || op.sumbu < 0 || op.sumbu >= shape.length) {
        return gagal(`Sumbu harus 0 sampai ${shape.length - 1}.`);
      }
      if (!Number.isInteger(op.posisi) || op.posisi < 0 || op.posisi >= shape[op.sumbu]) {
        return gagal(`Posisi di sumbu ${op.sumbu} harus 0 sampai ${shape[op.sumbu] - 1}.`);
      }
      const lain = state.slices.filter((s) => !(s.axis === op.sumbu && s.index === op.posisi));
      if (lain.length >= ND_MAX_SLICES) return gagal(`Sorotan sudah ${ND_MAX_SLICES}. Hapus sorotan dulu.`);
      const ukuranIrisan = total / shape[op.sumbu];
      const pola = shape.map((_, k) => (k === op.sumbu ? `[${op.posisi}]` : "[*]")).join("");
      return berhasil([
        langkah(
          { ...state, slices: [...lain, { axis: op.sumbu, index: op.posisi, tone: op.tone }] },
          `Irisan arr${pola} disorot: ${ukuranIrisan} elemen yang indeks sumbu ${op.sumbu}-nya ${op.posisi}.`,
        ),
      ]);
    }

    case "hapusSorotan":
      if (state.slices.length === 0) return berhasil([langkah(state, "Tidak ada sorotan yang perlu dihapus.")]);
      return berhasil([langkah({ ...state, slices: [] }, `${state.slices.length} sorotan dihapus.`)]);

    case "telusuri": {
      if (total === 0) return gagal("Array masih kosong, tidak ada elemen yang bisa ditelusuri.");
      const strides = ndStrides(shape);
      const steps: NdStep[] = [
        langkah(
          state,
          `Penelusuran mengikuti urutan memori: indeks paling kanan berubah paling cepat. Langkah alamat tiap sumbu: ${strides.join(", ")}.`,
        ),
      ];
      const jalur: number[] = [];
      for (let o = 0; o < total; o++) {
        const indeks = ndKoordinat(o, shape);
        jalur.push(state.cells[o].id);
        steps.push(
          langkah(
            { ...state, cursor: indeks },
            `Offset ${o} → arr${ndLabelIndeks(indeks)} = ${state.cells[o].value}.`,
            [o],
            LAB_VISIT_HOLD_MS,
            { jalur: [...jalur] },
          ),
        );
      }
      steps.push(
        langkah(state, `Penelusuran selesai: ${total} elemen dikunjungi dalam urutan memori. Perhatikan pola panahnya.`, [], LAB_STEP_HOLD_MS, { jalur }),
      );
      return berhasil(steps);
    }

    case "tukarSumbu": {
      if (total === 0) return gagal(GALAT_KOSONG);
      const { sumbuA: a, sumbuB: b } = op;
      for (const s of [a, b]) {
        if (!Number.isInteger(s) || s < 0 || s >= shape.length) return gagal(`Sumbu harus 0 sampai ${shape.length - 1}.`);
      }
      if (a === b) return berhasil([langkah(state, `Sumbu ${a} ditukar dengan dirinya sendiri, jadi tidak ada yang berubah.`)]);

      const tukar = <T,>(arr: readonly T[]): T[] => {
        const hasil = [...arr];
        [hasil[a], hasil[b]] = [hasil[b], hasil[a]];
        return hasil;
      };
      const bentuk = tukar(shape);
      const cells = new Array<NdCell>(total);
      for (let o = 0; o < total; o++) {
        cells[ndOffset(tukar(ndKoordinat(o, shape)), bentuk)] = state.cells[o];
      }
      const akhir: NdLabState = {
        ...state,
        shape: bentuk,
        cells,
        cursor: state.cursor === null ? null : tukar(state.cursor),
        slices: state.slices.map((s) => ({ ...s, axis: s.axis === a ? b : s.axis === b ? a : s.axis })),
      };
      const kelompok = kelompokSumbu(state, a, (x) => `sumbu ${a} = ${x} semula`);
      return berhasil([
        langkah(
          state,
          `Menukar sumbu ${a} dan ${b}: elemen yang indeks sumbu ${a}-nya p dan sumbu ${b}-nya q pindah ke posisi sebaliknya (untuk array 2D, ini transpose). Warna = indeks sumbu ${a} semula.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(
          akhir,
          `Sel meluncur ke alamat barunya, dan kali ini pita memori IKUT tersusun ulang - beda utama dengan reshape. Bentuk ${ndLabelBentuk(shape)} menjadi ${ndLabelBentuk(bentuk)}.`,
          [],
          LAB_MOVE_HOLD_MS,
          { kelompok },
        ),
        langkah(akhir, `Tukar sumbu selesai; elemennya tersusun ulang di memori.`),
      ]);
    }

    case "bubbleSort":
    case "selectionSort":
    case "insertionSort":
    case "mergeSort":
    case "quickSort":
      return urutkanNd(state, op);

    default: {
      const _lengkap: never = op;
      throw new Error(`applyNdOp: operasi tidak dikenal (${JSON.stringify(_lengkap)}).`);
    }
  }
}

/**
 * Pengurutan N-D: seluruhnya (urutan memori), atau setiap garis di sepanjang
 * satu sumbu — garis = semua elemen yang indeks lainnya sama, misalnya
 * `arr[1][*][2]` untuk sumbu 1. Satu rumus untuk berapa pun dimensinya.
 */
function urutkanNd(state: NdLabState, op: { kind: KindUrut; arah: ArahUrut; sumbu: number | null }): NdOpResult {
  const { shape } = state;
  const total = ndTotal(shape);
  if (total === 0) return gagal("Array masih kosong, tidak ada yang bisa diurutkan.");
  if (!isArahUrut(op.arah)) return gagal("Arah pengurutan harus naik atau turun.");
  const s = op.sumbu;
  if (s !== null && (!Number.isInteger(s) || s < 0 || s >= shape.length)) {
    return gagal(`Sumbu harus 0 sampai ${shape.length - 1}, atau pilih seluruh array.`);
  }
  const strides = ndStrides(shape);
  let deret: DeretUrut[];
  let pembuka: string;
  if (s === null) {
    deret = [{ posisi: Array.from({ length: total }, (_, o) => o), awalan: "" }];
    pembuka = `seluruh ${total} elemen diurutkan sebagai SATU deret mengikuti urutan memori; perhatikan pita memori di bawah papan.`;
  } else {
    deret = [];
    for (let o = 0; o < total; o++) {
      const k = ndKoordinat(o, shape);
      if (k[s] !== 0) continue;
      const pola = k.map((v, d) => (d === s ? "[*]" : `[${v}]`)).join("");
      deret.push({ posisi: Array.from({ length: shape[s] }, (_, t) => o + t * strides[s]), awalan: `Garis arr${pola}: ` });
    }
    pembuka = `setiap garis di sepanjang sumbu ${s} (${deret.length} garis, masing-masing ${shape[s]} elemen) diurutkan sendiri-sendiri.`;
  }
  const susun = (pen: ReadonlyMap<number, number>) => state.cells.map((_, x) => state.cells[pen.get(x) ?? x]);
  const { steps } = langkahUrut<NdLabState>({
    kind: op.kind,
    arah: op.arah,
    deret,
    nilaiDi: (x) => state.cells[x].value,
    idDi: (x) => state.cells[x].id,
    nama: (x) => `arr${ndLabelIndeks(ndKoordinat(x, shape))}`,
    bingkai: (pen) => settleNd({ ...state, cells: susun(pen), slices: [] }),
    akhir: (pen) => settleNd({ ...state, cells: susun(pen) }),
    pembuka,
  });
  if (steps.length > LAB_MAX_STEPS_URUT) return gagal(galatTerlaluPanjang(op.kind, steps.length, LAB_MAX_STEPS_URUT));
  return { ok: true, steps };
}
