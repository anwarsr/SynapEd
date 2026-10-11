/**
 * Lab array 3 dimensi: model kubus `arr[lapisan][baris][kolom]`, reducer, dan
 * penghasil langkah animasi.
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/` —
 * supaya `scripts/verify-lab.ts` bisa mengujinya langsung.
 *
 * Aturannya sama dengan lab lain: `applyCubeOp` TIDAK PERNAH melempar untuk
 * masukan pengguna, keadaan tidak disentuh saat ditolak, dan setiap langkah
 * membawa keadaan UTUH.
 *
 * Sel disimpan DATAR dalam urutan memori (row-major: kolom berubah paling
 * cepat, lapisan paling lambat), sama seperti lab N-D. Dengan begitu rumus
 * offset yang dinarasikan (`k×R×C + i×C + j`) adalah indeks sungguhan di
 * larik ini, dan setiap transformasi cukup ditulis sebagai PEMETAAN KOORDINAT
 * — sel, penunjuk, dan sorotan dipindahkan oleh pemetaan yang sama, jadi
 * mustahil salah satunya tertinggal.
 *
 * Indeks `fokus` di setiap langkah adalah offset datar terhadap keadaan
 * langkah itu sendiri.
 */
import { mulberry32 } from "./labRandom";
import { galatTerlaluPanjang, isArahUrut, langkahUrut, type ArahUrut, type DeretUrut, type KindUrut } from "./labSort";
import {
  LAB_MAX_STEPS_URUT,
  cleanLabText,
  LAB_MAX_ITEM_CHARS,
  LAB_MOVE_HOLD_MS,
  LAB_POINTER_NAME_RE,
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
 * Panjang maksimum SETIAP sumbu. Satu angka untuk ketiganya, bukan tiga: putar
 * dan tukar sumbu memindahkan panjang dari satu sumbu ke sumbu lain, dan batas
 * yang berbeda membuat operasi sah menghasilkan kubus yang tidak sah (bug yang
 * sama pernah tertangkap di lab 2D). 5×5×5 = 125 elemen masih terbaca saat
 * kubusnya diputar, dan tautannya masih muat di batas URL.
 */
export const CUBE_MAX_SIDE = 5;
export const CUBE_MAX_POINTERS = 4;
export const CUBE_MAX_BOXES = 4;
/** Penelusuran 125 kunjungan + pembuka + penutup. */
export const CUBE_MAX_STEPS = 140;
const CUBE_MAX_RANDOM_VALUE = Math.pow(10, LAB_MAX_ITEM_CHARS) - 1;

/** `[lapisan, baris, kolom]`. */
export type Koord3 = readonly [number, number, number];

export interface CubeCell {
  /** Identitas stabil untuk animasi; bertahan saat sel berpindah. */
  id: number;
  value: string;
}

export interface CubePointer {
  name: string;
  at: Koord3;
  tone: LabPointerTone;
}

/** Kotak sorotan, inklusif di kedua ujung pada ketiga sumbu. */
export interface CubeBox {
  from: Koord3;
  to: Koord3;
  tone: LabTone;
}

export interface CubeLabState {
  /** `[0,0,0]` untuk kubus kosong; selain itu ketiganya 1..CUBE_MAX_SIDE. */
  shape: Koord3;
  /** Urutan memori (row-major). */
  cells: CubeCell[];
  pointers: CubePointer[];
  boxes: CubeBox[];
  nextId: number;
}

export type CubeStep = LabStep<CubeLabState>;
export type CubeOpResult = LabOpResult<CubeLabState>;

export type CubeOp =
  | { kind: "buat"; jumlahLapisan: number; jumlahBaris: number; jumlahKolom: number }
  | { kind: "acak"; jumlahLapisan: number; jumlahBaris: number; jumlahKolom: number; maks: number; benih: number }
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "kosongkan" }
  | { kind: "tambahLapisan"; lapisan: number; nilai: string }
  | { kind: "hapusLapisan"; lapisan: number }
  | { kind: "bacaSel"; lapisan: number; baris: number; kolom: number }
  | { kind: "setSel"; lapisan: number; baris: number; kolom: number; nilai: string }
  | { kind: "setPenunjuk"; nama: string; lapisan: number; baris: number; kolom: number; tone: LabPointerTone }
  | { kind: "geserPenunjuk"; nama: string; dLapisan: number; dBaris: number; dKolom: number }
  | { kind: "hapusPenunjuk"; nama: string }
  | { kind: "sorotLapisan"; lapisan: number; tone: LabTone }
  | { kind: "sorotBaris"; baris: number; tone: LabTone }
  | { kind: "sorotKolom"; kolom: number; tone: LabTone }
  | { kind: "sorotPilar"; baris: number; kolom: number; tone: LabTone }
  | { kind: "hapusSorotan" }
  | { kind: "telusurLapisan" }
  | { kind: "telusurPilar" }
  | { kind: "telusurDiagonal" }
  | { kind: "transposeTiapLapisan" }
  | { kind: "putarTiapLapisan" }
  | { kind: "balikUrutanLapisan" }
  | { kind: "tukarSumbu"; sumbuA: number; sumbuB: number }
  | { kind: KindUrut; arah: ArahUrut; cakupan: CakupanKubus };

/**
 * Apa yang diurutkan pada kubus: garis di sepanjang satu sumbu (tiap baris
 * mendatar, tiap kolom tegak, tiap pilar menembus lapisan), atau seluruhnya
 * sebagai satu deret mengikuti urutan memori.
 */
export type CakupanKubus = "baris" | "kolom" | "pilar" | "semua";
export const CAKUPAN_KUBUS: readonly CakupanKubus[] = ["baris", "kolom", "pilar", "semua"];

/** Nama sumbu untuk narasi; indeksnya sama dengan posisi di `Koord3`. */
export const CUBE_NAMA_SUMBU = ["lapisan", "baris", "kolom"] as const;

// ---------------------------------------------------------------------------
// Aritmetika bentuk — diekspor karena papan memakainya juga
// ---------------------------------------------------------------------------

export function cubeTotal(shape: Koord3): number {
  return shape[0] * shape[1] * shape[2];
}

export function cubeOffset(at: Koord3, shape: Koord3): number {
  return (at[0] * shape[1] + at[1]) * shape[2] + at[2];
}

export function cubeKoord(offset: number, shape: Koord3): [number, number, number] {
  const RC = shape[1] * shape[2];
  return [Math.floor(offset / RC), Math.floor(offset / shape[2]) % shape[1], offset % shape[2]];
}

export function cubeLabel(at: Koord3): string {
  return `[${at[0]}][${at[1]}][${at[2]}]`;
}

/** Kubus kosong tidak punya lapisan sama sekali. */
export function cubeKosong(state: CubeLabState): boolean {
  return state.shape[0] === 0;
}

export function cubeDiDalam(at: Koord3, shape: Koord3): boolean {
  return at.every((v, k) => Number.isInteger(v) && v >= 0 && v < shape[k]);
}

export function cubeDalamKotak(at: Koord3, box: CubeBox): boolean {
  return at.every((v, k) => v >= box.from[k] && v <= box.to[k]);
}

// ---------------------------------------------------------------------------
// Pembentuk & penjaga
// ---------------------------------------------------------------------------

export function emptyCubeState(): CubeLabState {
  return { shape: [0, 0, 0], cells: [], pointers: [], boxes: [], nextId: 0 };
}

/** Kubus dari bentuk & nilai datar yang SUDAH sah; id diberikan berurutan. */
export function cubeStateFromValues(shape: Koord3, values: readonly string[]): CubeLabState {
  let nextId = 0;
  return settleCube({
    shape: [shape[0], shape[1], shape[2]],
    cells: values.map((value) => ({ id: nextId++, value })),
    pointers: [],
    boxes: [],
    nextId,
  });
}

/**
 * Penjaga terakhir di setiap langkah: penunjuk dijepit ke dalam kubus (dan
 * dibuang kalau kubusnya kosong); kotak sorotan yang keluar batas dibuang
 * UTUH, tidak dipotong — potongan diam-diam menyorot sel yang tidak pernah
 * dipilih siapa pun.
 */
export function settleCube(state: CubeLabState): CubeLabState {
  const { shape } = state;
  if (shape.some((n) => n <= 0)) return { ...emptyCubeState(), nextId: state.nextId };
  const jepit = (v: number, k: number) => Math.min(Math.max(v, 0), shape[k] - 1);
  return {
    ...state,
    pointers: state.pointers.map((p) => ({ ...p, at: [jepit(p.at[0], 0), jepit(p.at[1], 1), jepit(p.at[2], 2)] })),
    boxes: state.boxes.filter(
      (b) => cubeDiDalam(b.from, shape) && cubeDiDalam(b.to, shape) && b.from.every((v, k) => v <= b.to[k]),
    ),
  };
}

/** Kalimat masalah pertama, atau null kalau keadaannya sehat. */
export function assertCubeInvariants(state: CubeLabState): string | null {
  const { shape, cells } = state;
  if (shape.length !== 3) return "Bentuk kubus harus tiga angka.";
  const kosong = shape.every((n) => n === 0);
  if (!kosong) {
    for (const n of shape) {
      if (!Number.isInteger(n) || n < 1 || n > CUBE_MAX_SIDE) return `Panjang sumbu ${n} tidak sah.`;
    }
  }
  const total = kosong ? 0 : cubeTotal(shape);
  if (cells.length !== total) return `Isi ${cells.length} sel tidak cocok dengan bentuk ${shape.join("×")}.`;

  const ids = new Set<number>();
  for (const c of cells) {
    if (!LAB_VALUE_RE.test(c.value)) return `Nilai "${c.value}" tidak sah.`;
    if (ids.has(c.id)) return `Id ${c.id} ganda.`;
    if (c.id >= state.nextId) return `Id ${c.id} tidak lebih kecil dari nextId.`;
    ids.add(c.id);
  }

  if (state.pointers.length > CUBE_MAX_POINTERS) return "Penunjuk terlalu banyak.";
  if (kosong && state.pointers.length > 0) return "Kubus kosong tidak boleh punya penunjuk.";
  const nama = new Set<string>();
  for (const p of state.pointers) {
    if (!LAB_POINTER_NAME_RE.test(p.name)) return `Nama penunjuk "${p.name}" tidak sah.`;
    if (nama.has(p.name)) return `Nama penunjuk "${p.name}" ganda.`;
    nama.add(p.name);
    if (!cubeDiDalam(p.at, shape)) return `Penunjuk "${p.name}" di ${cubeLabel(p.at)} keluar dari kubus.`;
  }

  if (state.boxes.length > CUBE_MAX_BOXES) return "Sorotan terlalu banyak.";
  for (const b of state.boxes) {
    if (!cubeDiDalam(b.from, shape) || !cubeDiDalam(b.to, shape) || b.from.some((v, k) => v > b.to[k])) {
      return `Sorotan ${cubeLabel(b.from)}–${cubeLabel(b.to)} keluar dari kubus.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penolong internal
// ---------------------------------------------------------------------------

function gagal(error: string): CubeOpResult {
  return { ok: false, error };
}

function langkah(
  state: CubeLabState,
  narasi: string,
  fokus: number[] = [],
  tahanMs = LAB_STEP_HOLD_MS,
  tanda: Pick<CubeStep, "kelompok" | "jalur"> = {},
): CubeStep {
  return { state: settleCube(state), narasi, fokus, tahanMs, ...tanda };
}

/** Warna asal menurut indeks sel pada satu sumbu (0 lapisan, 1 baris, 2 kolom). */
function kelompokSumbu(state: CubeLabState, sumbu: 0 | 1 | 2): LabKelompok {
  const warna: Record<number, number> = {};
  state.cells.forEach((c, o) => (warna[c.id] = cubeKoord(o, state.shape)[sumbu]));
  return {
    warna,
    label: Array.from({ length: state.shape[sumbu] }, (_, x) => `${CUBE_NAMA_SUMBU[sumbu]} ${x} semula`),
  };
}

/** Offset semua sel di satu lapisan. */
function offsetLapisan(shape: Koord3, k: number): number[] {
  const RC = shape[1] * shape[2];
  return Array.from({ length: RC }, (_, x) => k * RC + x);
}

function berhasil(steps: CubeStep[]): CubeOpResult {
  if (steps.length > CUBE_MAX_STEPS) {
    return { ok: true, steps: [...steps.slice(0, CUBE_MAX_STEPS - 1), steps[steps.length - 1]] };
  }
  return { ok: true, steps };
}

const GALAT_KOSONG = "Array 3D masih kosong. Isi dulu lewat kelompok Bentuk & isi.";
const GALAT_NILAI = `Nilai harus 1 sampai ${LAB_MAX_ITEM_CHARS} karakter berisi huruf, angka, spasi, titik, atau tanda minus.`;

function nilaiBersih(raw: string): string | null {
  const v = cleanLabText(raw);
  return LAB_VALUE_RE.test(v) ? v : null;
}

function ukuran(shape: Koord3): string {
  return `${shape[0]}×${shape[1]}×${shape[2]}`;
}

function galatSumbu(state: CubeLabState, sumbu: 0 | 1 | 2, v: number): string | null {
  if (cubeKosong(state)) return GALAT_KOSONG;
  const n = state.shape[sumbu];
  if (!Number.isInteger(v) || v < 0 || v >= n) {
    return `${CUBE_NAMA_SUMBU[sumbu][0].toUpperCase()}${CUBE_NAMA_SUMBU[sumbu].slice(1)} ${v} tidak ada; yang ada hanya 0 sampai ${n - 1}.`;
  }
  return null;
}

function galatSel(state: CubeLabState, at: Koord3): string | null {
  return galatSumbu(state, 0, at[0]) ?? galatSumbu(state, 1, at[1]) ?? galatSumbu(state, 2, at[2]);
}

function galatUkuran(nama: string, n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > CUBE_MAX_SIDE) return `Jumlah ${nama} harus 1 sampai ${CUBE_MAX_SIDE}.`;
  return null;
}

/** Bingkai sementara animasi: sorotan pengguna disembunyikan, diganti sorotan bantu. */
function bingkai(state: CubeLabState, boxes: CubeBox[]): CubeLabState {
  return { ...state, boxes };
}

function kotakLapisan(shape: Koord3, k: number, tone: LabTone): CubeBox {
  return { from: [k, 0, 0], to: [k, shape[1] - 1, shape[2] - 1], tone };
}

function kotakPilar(shape: Koord3, i: number, j: number, tone: LabTone): CubeBox {
  return { from: [0, i, j], to: [shape[0] - 1, i, j], tone };
}

function tambahKotak(state: CubeLabState, box: CubeBox): CubeLabState | string {
  const sama = (a: Koord3, b: Koord3) => a.every((v, k) => v === b[k]);
  const lain = state.boxes.filter((b) => !(sama(b.from, box.from) && sama(b.to, box.to)));
  if (lain.length >= CUBE_MAX_BOXES) return `Sorotan sudah ${CUBE_MAX_BOXES}. Hapus sorotan dulu sebelum menambah yang baru.`;
  return { ...state, boxes: [...lain, box] };
}

/** Rumus offset yang ditulis lengkap: `1×12 + 2×4 + 0 = 20`. */
function rumusOffset(at: Koord3, shape: Koord3): string {
  return `${at[0]}×${shape[1] * shape[2]} + ${at[1]}×${shape[2]} + ${at[2]} = ${cubeOffset(at, shape)}`;
}

/**
 * Memindahkan SELURUH isi kubus lewat satu pemetaan koordinat. Sel, penunjuk,
 * dan kotak sorotan memakai pemetaan yang sama; kotak dipetakan lewat kedua
 * sudutnya lalu dinormalkan, yang sah karena setiap transformasi di lab ini
 * hanya menukar dan/atau membalik sumbu.
 */
function petakan(state: CubeLabState, shapeBaru: Koord3, peta: (at: Koord3) => Koord3): CubeLabState {
  const cells = new Array<CubeCell>(state.cells.length);
  for (let o = 0; o < state.cells.length; o++) {
    cells[cubeOffset(peta(cubeKoord(o, state.shape)), shapeBaru)] = state.cells[o];
  }
  return {
    shape: shapeBaru,
    cells,
    pointers: state.pointers.map((p) => ({ ...p, at: peta(p.at) })),
    boxes: state.boxes.map((b) => {
      const a = peta(b.from);
      const z = peta(b.to);
      return {
        from: [Math.min(a[0], z[0]), Math.min(a[1], z[1]), Math.min(a[2], z[2])],
        to: [Math.max(a[0], z[0]), Math.max(a[1], z[1]), Math.max(a[2], z[2])],
        tone: b.tone,
      };
    }),
    nextId: state.nextId,
  };
}

/**
 * Teks isian kubus: lapisan dipisah `|` atau baris kosong, baris dipisah `;`
 * atau baris baru, nilai dipisah koma/spasi.
 */
function uraiTeksKubus(teks: string): string[][][] {
  return teks
    .split(/\||\r?\n[ \t]*\r?\n/)
    .map((lapisan) =>
      lapisan
        .split(/[;\r\n]+/)
        .map((baris) =>
          baris
            .split(/[,\s]+/)
            .map((v) => cleanLabText(v))
            .filter((v) => v.length > 0),
        )
        .filter((baris) => baris.length > 0),
    )
    .filter((lapisan) => lapisan.length > 0);
}

function isiLapisan(state: CubeLabState, k: number): string {
  const RC = state.shape[1] * state.shape[2];
  return state.cells
    .slice(k * RC, (k + 1) * RC)
    .map((c) => c.value)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyCubeOp(state: CubeLabState, op: CubeOp): CubeOpResult {
  const { shape } = state;
  const [D, R, C] = shape;
  const total = cubeKosong(state) ? 0 : cubeTotal(shape);

  switch (op.kind) {
    // ── Bentuk & isi ──────────────────────────────────────────────────────
    case "buat":
    case "acak": {
      const g =
        galatUkuran("lapisan", op.jumlahLapisan) ?? galatUkuran("baris", op.jumlahBaris) ?? galatUkuran("kolom", op.jumlahKolom);
      if (g) return gagal(g);
      const bentuk: Koord3 = [op.jumlahLapisan, op.jumlahBaris, op.jumlahKolom];
      const n = cubeTotal(bentuk);
      let nilai: (i: number) => string = (i) => String(i);
      let narasi = `Array 3D ${ukuran(bentuk)} dibuat: ${n} elemen, diisi 0 sampai ${n - 1} sesuai urutannya di memori.`;
      if (op.kind === "acak") {
        if (!Number.isInteger(op.maks) || op.maks < 1 || op.maks > CUBE_MAX_RANDOM_VALUE) {
          return gagal(`Nilai terbesar harus 1 sampai ${CUBE_MAX_RANDOM_VALUE}.`);
        }
        if (!Number.isInteger(op.benih)) return gagal("Benih acak harus bilangan bulat.");
        const acak = mulberry32(op.benih);
        const maks = op.maks;
        nilai = () => String(Math.floor(acak() * (maks + 1)));
        narasi = `Array 3D ${ukuran(bentuk)} diisi angka acak 0 sampai ${maks} dengan benih ${op.benih}.`;
      }
      let nextId = state.nextId;
      const cells = Array.from({ length: n }, (_, i) => ({ id: nextId++, value: nilai(i) }));
      // Penunjuk dibawa (lalu dijepit), sorotan dibuang: sorotan menunjuk sel
      // yang isinya sudah diganti, sedangkan penunjuk masih bermakna.
      return berhasil([langkah({ shape: bentuk, cells, pointers: state.pointers, boxes: [], nextId }, narasi)]);
    }

    case "isiDariTeks": {
      const kubus = uraiTeksKubus(op.teks);
      if (kubus.length === 0) return gagal("Tulis minimal satu lapisan nilai, mis. 1 2; 3 4 | 5 6; 7 8.");
      if (kubus.length > CUBE_MAX_SIDE) return gagal(`Paling banyak ${CUBE_MAX_SIDE} lapisan.`);
      const tinggi = kubus[0].length;
      const lebar = kubus[0][0].length;
      if (tinggi > CUBE_MAX_SIDE) return gagal(`Paling banyak ${CUBE_MAX_SIDE} baris per lapisan.`);
      if (lebar > CUBE_MAX_SIDE) return gagal(`Paling banyak ${CUBE_MAX_SIDE} kolom per baris.`);
      for (let k = 0; k < kubus.length; k++) {
        if (kubus[k].length !== tinggi) {
          return gagal(`Lapisan ${k} berisi ${kubus[k].length} baris, padahal lapisan 0 berisi ${tinggi}. Setiap lapisan harus berukuran sama.`);
        }
        for (let i = 0; i < tinggi; i++) {
          if (kubus[k][i].length !== lebar) {
            return gagal(`Lapisan ${k} baris ${i} berisi ${kubus[k][i].length} nilai, padahal seharusnya ${lebar}.`);
          }
          for (const v of kubus[k][i]) if (!LAB_VALUE_RE.test(v)) return gagal(`"${v}": ${GALAT_NILAI}`);
        }
      }
      let nextId = state.nextId;
      const cells = kubus.flat(2).map((value) => ({ id: nextId++, value }));
      const bentuk: Koord3 = [kubus.length, tinggi, lebar];
      return berhasil([
        langkah(
          { shape: bentuk, cells, pointers: state.pointers, boxes: [], nextId },
          `Array 3D diisi ulang menjadi ${kubus.length} lapisan × ${tinggi} baris × ${lebar} kolom.`,
        ),
      ]);
    }

    case "kosongkan":
      if (total === 0) return berhasil([langkah(state, "Array 3D sudah kosong, tidak ada yang perlu dihapus.")]);
      return berhasil([langkah({ ...emptyCubeState(), nextId: state.nextId }, `Seluruh ${total} elemen dihapus; array 3D kini kosong.`)]);

    case "tambahLapisan": {
      const nilai = nilaiBersih(op.nilai);
      if (nilai === null) return gagal(GALAT_NILAI);
      if (D >= CUBE_MAX_SIDE) return gagal(`Array 3D sudah ${CUBE_MAX_SIDE} lapisan, tidak bisa ditambah lagi.`);
      if (!Number.isInteger(op.lapisan) || op.lapisan < 0 || op.lapisan > D) {
        return gagal(`Lapisan baru bisa disisipkan di posisi 0 sampai ${D}.`);
      }
      const k = op.lapisan;
      // Kubus kosong mendapat lapisan 1×1 — satu-satunya ukuran yang tidak
      // perlu ditebak.
      const tinggi = Math.max(R, 1);
      const lebar = Math.max(C, 1);
      let nextId = state.nextId;
      const baru = Array.from({ length: tinggi * lebar }, () => ({ id: nextId++, value: nilai }));
      const RC = tinggi * lebar;
      const bentuk: Koord3 = [D + 1, tinggi, lebar];
      const akhir: CubeLabState = {
        shape: bentuk,
        cells: [...state.cells.slice(0, k * RC), ...baru, ...state.cells.slice(k * RC)],
        pointers: state.pointers.map((p) => (p.at[0] >= k ? { ...p, at: [p.at[0] + 1, p.at[1], p.at[2]] } : p)),
        boxes: state.boxes
          .filter((b) => b.to[0] < k || b.from[0] >= k)
          .map((b) =>
            b.from[0] >= k
              ? { ...b, from: [b.from[0] + 1, b.from[1], b.from[2]], to: [b.to[0] + 1, b.to[1], b.to[2]] }
              : b,
          ),
        nextId,
      };
      const fokus = baru.map((_, x) => k * RC + x);
      return berhasil([
        langkah(bingkai(akhir, [kotakLapisan(bentuk, k, "hasil")]), `Lapisan baru berisi ${nilai} disisipkan di indeks ${k}.`, fokus),
        langkah(akhir, `Ukuran array 3D kini ${ukuran(bentuk)}.`),
      ]);
    }

    case "hapusLapisan": {
      const g = galatSumbu(state, 0, op.lapisan);
      if (g) return gagal(g);
      const k = op.lapisan;
      const RC = R * C;
      const akhir: CubeLabState = {
        shape: [D - 1, R, C],
        cells: [...state.cells.slice(0, k * RC), ...state.cells.slice((k + 1) * RC)],
        pointers: state.pointers.map((p) => (p.at[0] > k ? { ...p, at: [p.at[0] - 1, p.at[1], p.at[2]] } : p)),
        boxes: state.boxes
          .filter((b) => b.to[0] < k || b.from[0] > k)
          .map((b) =>
            b.from[0] > k ? { ...b, from: [b.from[0] - 1, b.from[1], b.from[2]], to: [b.to[0] - 1, b.to[1], b.to[2]] } : b,
          ),
        nextId: state.nextId,
      };
      const fokus = Array.from({ length: RC }, (_, x) => k * RC + x);
      return berhasil([
        langkah(bingkai(state, [kotakLapisan(shape, k, "buang")]), `Lapisan ${k} (${isiLapisan(state, k)}) akan dihapus.`, fokus),
        langkah(akhir, D === 1 ? "Lapisan terakhir dihapus; array 3D kini kosong." : `Lapisan ${k} dihapus; ukuran kini ${ukuran(akhir.shape)}.`),
      ]);
    }

    // ── Akses & penunjuk ──────────────────────────────────────────────────
    case "bacaSel":
    case "setSel": {
      const at: Koord3 = [op.lapisan, op.baris, op.kolom];
      const g = galatSel(state, at);
      if (g) return gagal(g);
      const nilai = op.kind === "setSel" ? nilaiBersih(op.nilai) : null;
      if (op.kind === "setSel" && nilai === null) return gagal(GALAT_NILAI);

      // arr[k][i][j] diurai tiga langkah, dari luar ke dalam: lapisan, lalu
      // baris di lapisan itu, lalu kolomnya. Setiap indeks mempersempit
      // pilihan — itulah arti "array di dalam array di dalam array".
      const [k, i, j] = at;
      const o = cubeOffset(at, shape);
      const lama = state.cells[o].value;
      const lapisan = kotakLapisan(shape, k, "sorot");
      const baris: CubeBox = { from: [k, i, 0], to: [k, i, C - 1], tone: "banding" };
      const steps: CubeStep[] = [
        langkah(
          bingkai(state, [lapisan]),
          `Indeks pertama [${k}] memilih LAPISAN ke-${k + 1} dari depan: arr[${k}] adalah sebuah array 2D ${R}×${C}.`,
          offsetLapisan(shape, k),
        ),
        langkah(
          bingkai(state, [baris, lapisan]),
          `Indeks kedua [${i}] memilih BARIS ke-${i + 1} di lapisan itu: arr[${k}][${i}] berisi ${C} elemen.`,
          Array.from({ length: C }, (_, x) => cubeOffset([k, i, x], shape)),
        ),
      ];
      if (op.kind === "bacaSel") {
        steps.push(
          langkah(
            state,
            `Indeks ketiga [${j}] memilih KOLOM ke-${j + 1}: arr${cubeLabel(at)} bernilai ${lama}. Di memori ia ada di offset ${rumusOffset(at, shape)}.`,
            [o],
          ),
        );
      } else {
        const cells = state.cells.map((c, x) => (x === o ? { ...c, value: nilai as string } : c));
        steps.push(
          langkah(
            { ...state, cells },
            `Indeks ketiga [${j}] memilih KOLOM ke-${j + 1}: arr${cubeLabel(at)} diubah dari ${lama} menjadi ${nilai}.`,
            [o],
          ),
        );
      }
      return berhasil(steps);
    }

    case "setPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      if (!LAB_POINTER_NAME_RE.test(nama)) {
        return gagal("Nama penunjuk diawali huruf, berisi huruf kecil atau angka, paling banyak 6 karakter.");
      }
      const at: Koord3 = [op.lapisan, op.baris, op.kolom];
      const g = galatSel(state, at);
      if (g) return gagal(g);
      const lain = state.pointers.filter((p) => p.name !== nama);
      if (lain.length >= CUBE_MAX_POINTERS) return gagal(`Penunjuk sudah ${CUBE_MAX_POINTERS}. Hapus salah satu dulu.`);
      const o = cubeOffset(at, shape);
      return berhasil([
        langkah(
          { ...state, pointers: [...lain, { name: nama, at, tone: op.tone }] },
          `Penunjuk ${nama} dipasang di arr${cubeLabel(at)}, yang bernilai ${state.cells[o].value}.`,
          [o],
        ),
      ]);
    }

    case "geserPenunjuk": {
      const nama = cleanLabText(op.nama).toLowerCase();
      const p = state.pointers.find((x) => x.name === nama);
      if (!p) return gagal(`Penunjuk ${nama || "itu"} belum dipasang di papan.`);
      const d = [op.dLapisan, op.dBaris, op.dKolom];
      if (!d.every(Number.isInteger)) return gagal("Jarak geser harus bilangan bulat.");
      const at: Koord3 = [p.at[0] + d[0], p.at[1] + d[1], p.at[2] + d[2]];
      if (!cubeDiDalam(at, shape)) {
        return gagal(`Penunjuk ${nama} akan keluar kubus di ${cubeLabel(at)}; kubusnya ${ukuran(shape)}.`);
      }
      return berhasil([
        langkah(
          { ...state, pointers: state.pointers.map((x) => (x.name === nama ? { ...x, at } : x)) },
          `Penunjuk ${nama} bergeser dari arr${cubeLabel(p.at)} ke arr${cubeLabel(at)}.`,
          [cubeOffset(at, shape)],
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

    // ── Sorotan ───────────────────────────────────────────────────────────
    case "sorotLapisan":
    case "sorotBaris":
    case "sorotKolom":
    case "sorotPilar": {
      let box: CubeBox;
      let narasi: string;
      if (op.kind === "sorotLapisan") {
        const g = galatSumbu(state, 0, op.lapisan);
        if (g) return gagal(g);
        box = kotakLapisan(shape, op.lapisan, op.tone);
        narasi = `Lapisan ${op.lapisan} disorot: arr[${op.lapisan}] adalah sebuah array 2D ${R}×${C}.`;
      } else if (op.kind === "sorotBaris") {
        const g = galatSumbu(state, 1, op.baris);
        if (g) return gagal(g);
        box = { from: [0, op.baris, 0], to: [D - 1, op.baris, C - 1], tone: op.tone };
        narasi = `Baris ${op.baris} di SETIAP lapisan disorot - irisan arr[*][${op.baris}][*] berukuran ${D}×${C}.`;
      } else if (op.kind === "sorotKolom") {
        const g = galatSumbu(state, 2, op.kolom);
        if (g) return gagal(g);
        box = { from: [0, 0, op.kolom], to: [D - 1, R - 1, op.kolom], tone: op.tone };
        narasi = `Kolom ${op.kolom} di SETIAP lapisan disorot - irisan arr[*][*][${op.kolom}] berukuran ${D}×${R}.`;
      } else {
        const g = galatSumbu(state, 1, op.baris) ?? galatSumbu(state, 2, op.kolom);
        if (g) return gagal(g);
        box = kotakPilar(shape, op.baris, op.kolom, op.tone);
        narasi = `Pilar arr[*][${op.baris}][${op.kolom}] disorot: ${D} elemen yang menembus semua lapisan.`;
      }
      const hasil = tambahKotak(state, box);
      if (typeof hasil === "string") return gagal(hasil);
      return berhasil([langkah(hasil, narasi)]);
    }

    case "hapusSorotan":
      if (state.boxes.length === 0) return berhasil([langkah(state, "Tidak ada sorotan yang perlu dihapus.")]);
      return berhasil([langkah({ ...state, boxes: [] }, `${state.boxes.length} sorotan dihapus dari papan.`)]);

    // ── Penelusuran ───────────────────────────────────────────────────────
    case "telusurLapisan":
    case "telusurPilar": {
      if (total === 0) return gagal("Array 3D masih kosong, tidak ada elemen yang bisa ditelusuri.");
      const perLapisan = op.kind === "telusurLapisan";
      const steps: CubeStep[] = [
        langkah(
          state,
          perLapisan
            ? "Penelusuran lapisan demi lapisan: untuk setiap lapisan k, setiap baris i, kunjungi kolom j - persis urutan memori."
            : "Penelusuran pilar demi pilar: untuk setiap baris i dan kolom j, turuni semua lapisan k dulu. Urutan ini melompat-lompat di memori.",
        ),
      ];
      let ke = 0;
      const urut: Koord3[] = [];
      if (perLapisan) {
        for (let o = 0; o < total; o++) urut.push(cubeKoord(o, shape));
      } else {
        for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) for (let k = 0; k < D; k++) urut.push([k, i, j]);
      }
      const jalur: number[] = [];
      let offsetSebelum: number | null = null;
      for (const at of urut) {
        ke++;
        const o = cubeOffset(at, shape);
        jalur.push(state.cells[o].id);
        const bantu = perLapisan ? kotakLapisan(shape, at[0], "sorot") : kotakPilar(shape, at[1], at[2], "sorot");
        // Lompatan offset dinarasikan: itulah beda kedua urutan ini di memori.
        const lompat = offsetSebelum === null ? "" : ` Lompatan di memori: ${o - offsetSebelum >= 0 ? "+" : ""}${o - offsetSebelum}.`;
        offsetSebelum = o;
        steps.push(
          langkah(
            bingkai(state, [bantu]),
            `Kunjungan ke-${ke}: arr${cubeLabel(at)} = ${state.cells[o].value} (offset ${o}).${lompat}`,
            [o],
            LAB_VISIT_HOLD_MS,
            { jalur: [...jalur] },
          ),
        );
      }
      steps.push(
        langkah(
          state,
          `Penelusuran ${perLapisan ? "lapisan demi lapisan" : "pilar demi pilar"} selesai: ${total} elemen dikunjungi. Perhatikan pola panahnya.`,
          [],
          LAB_STEP_HOLD_MS,
          { jalur },
        ),
      );
      return berhasil(steps);
    }

    case "telusurDiagonal": {
      if (total === 0) return gagal("Array 3D masih kosong, tidak ada elemen yang bisa ditelusuri.");
      const panjang = Math.min(D, R, C);
      const steps: CubeStep[] = [
        langkah(state, `Penelusuran diagonal ruang: elemen arr[k][k][k] untuk k dari 0 sampai ${panjang - 1} - dari pojok depan ke pojok belakang.`),
      ];
      const nilai: string[] = [];
      const jalur: number[] = [];
      for (let k = 0; k < panjang; k++) {
        const o = cubeOffset([k, k, k], shape);
        nilai.push(state.cells[o].value);
        jalur.push(state.cells[o].id);
        steps.push(
          langkah(
            state,
            `Kunjungan ke-${k + 1}: arr[${k}][${k}][${k}] = ${state.cells[o].value} - satu lapisan lebih dalam, satu baris lebih bawah, satu kolom lebih kanan.`,
            [o],
            LAB_VISIT_HOLD_MS,
            { jalur: [...jalur] },
          ),
        );
      }
      steps.push(langkah(state, `Diagonal ruang selesai ditelusuri: ${nilai.join(", ")}.`, [], LAB_STEP_HOLD_MS, { jalur }));
      return berhasil(steps);
    }

    // ── Transformasi ──────────────────────────────────────────────────────
    case "transposeTiapLapisan":
    case "putarTiapLapisan": {
      if (total === 0) return berhasil([langkah(state, "Array 3D masih kosong, tidak ada yang berubah.")]);
      const transpose = op.kind === "transposeTiapLapisan";
      const bentuk: Koord3 = [D, C, R];
      const hasil = petakan(state, bentuk, transpose ? ([k, i, j]) => [k, j, i] : ([k, i, j]) => [k, j, R - 1 - i]);
      const kelompok = kelompokSumbu(state, 1);
      const steps: CubeStep[] = [
        langkah(
          state,
          transpose
            ? `Setiap lapisan akan di-transpose: arr[k][i][j] pindah ke arr[k][j][i], jadi baris menjadi kolom. Tiap baris diberi warna; ikuti warnanya.`
            : `Setiap lapisan akan diputar 90° searah jarum jam - seperti memutar kubus pada sumbu yang menembus semua lapisan. Tiap baris diberi warna; ikuti warnanya.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(
          hasil,
          `Semua sel meluncur bersamaan; setiap lapisan ${R}×${C} menjadi ${C}×${R}, dan urutan lapisan tidak berubah.`,
          [],
          LAB_MOVE_HOLD_MS,
          { kelompok },
        ),
      ];
      for (let k = 0; k < D; k++) {
        steps.push(
          langkah(
            hasil,
            `Lapisan ${k}: baris yang tadinya mendatar kini ${transpose ? "berdiri sebagai kolom dengan nomor yang sama" : "berdiri sebagai kolom, mulai dari kolom paling kanan"} - ${isiLapisan(hasil, k)}.`,
            offsetLapisan(bentuk, k),
            LAB_STEP_HOLD_MS,
            { kelompok },
          ),
        );
      }
      steps.push(langkah(hasil, `${transpose ? "Transpose" : "Putaran"} selesai; ukuran kini ${ukuran(bentuk)}.`));
      return berhasil(steps);
    }

    case "balikUrutanLapisan": {
      if (D < 2) return berhasil([langkah(state, `Array 3D berisi ${D} lapisan, jadi membalik urutannya tidak mengubah apa pun.`)]);
      const kelompok = kelompokSumbu(state, 0);
      const steps: CubeStep[] = [
        langkah(
          state,
          "Urutan lapisan akan dibalik dengan menukar pasangan lapisan dari kedua ujung. Tiap lapisan diberi warna; ikuti warnanya.",
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
      ];
      let berjalan = state;
      for (let a = 0, b = D - 1; a < b; a++, b--) {
        const x = a;
        const y = b;
        // Menukar dua lapisan juga sebuah pemetaan koordinat, jadi penunjuk dan
        // sorotan di lapisan itu ikut berpindah di frame tengah.
        berjalan = petakan(berjalan, shape, ([k, i, j]) => [k === x ? y : k === y ? x : k, i, j]);
        steps.push(
          langkah(
            berjalan,
            `Lapisan ${x} bertukar tempat dengan lapisan ${y} - selnya terbang menembus kubus.`,
            [...offsetLapisan(shape, x), ...offsetLapisan(shape, y)],
            LAB_MOVE_HOLD_MS,
            { kelompok },
          ),
        );
      }
      steps.push(langkah(berjalan, "Urutan lapisan selesai dibalik - yang tadinya paling depan kini paling belakang."));
      return berhasil(steps);
    }

    case "tukarSumbu": {
      if (total === 0) return gagal(GALAT_KOSONG);
      const { sumbuA: a, sumbuB: b } = op;
      for (const s of [a, b]) {
        if (!Number.isInteger(s) || s < 0 || s > 2) return gagal("Sumbu harus 0 (lapisan), 1 (baris), atau 2 (kolom).");
      }
      if (a === b) return berhasil([langkah(state, `Sumbu ${a} ditukar dengan dirinya sendiri, jadi tidak ada yang berubah.`)]);
      const tukar = (at: Koord3): Koord3 => {
        const h: [number, number, number] = [at[0], at[1], at[2]];
        [h[a], h[b]] = [h[b], h[a]];
        return h;
      };
      const bentuk = tukar(shape);
      const hasil = petakan(state, bentuk, tukar);
      const kelompok = kelompokSumbu(state, a as 0 | 1 | 2);
      const namaA = CUBE_NAMA_SUMBU[a];
      const namaB = CUBE_NAMA_SUMBU[b];
      return berhasil([
        langkah(
          state,
          `Menukar sumbu ${namaA} dan ${namaB}: indeks ${namaA}-nya menjadi indeks ${namaB}, dan sebaliknya. Tiap ${namaA} diberi warna; ikuti warnanya.`,
          [],
          LAB_STEP_HOLD_MS,
          { kelompok },
        ),
        langkah(
          hasil,
          `Semua sel meluncur bersamaan: sel yang tadinya satu ${namaA} (satu warna) kini berkumpul sebagai satu ${namaB}. Bentuk ${ukuran(shape)} menjadi ${ukuran(bentuk)}.`,
          [],
          LAB_MOVE_HOLD_MS,
          { kelompok },
        ),
        langkah(hasil, `Tukar sumbu selesai - kubus yang sama, dilihat dari sisi lain; elemennya tersusun ulang di memori.`),
      ]);
    }

    case "bubbleSort":
    case "selectionSort":
    case "insertionSort":
    case "mergeSort":
    case "quickSort":
      return urutkanKubus(state, op);

    default: {
      const _lengkap: never = op;
      throw new Error(`applyCubeOp: operasi tidak dikenal (${JSON.stringify(_lengkap)}).`);
    }
  }
}

function urutkanKubus(state: CubeLabState, op: { kind: KindUrut; arah: ArahUrut; cakupan: CakupanKubus }): CubeOpResult {
  if (cubeKosong(state)) return gagal("Array 3D masih kosong, tidak ada yang bisa diurutkan.");
  if (!isArahUrut(op.arah)) return gagal("Arah pengurutan harus naik atau turun.");
  if (!CAKUPAN_KUBUS.includes(op.cakupan)) return gagal("Pilih yang diurutkan: tiap baris, tiap kolom, tiap pilar, atau seluruh kubus.");
  const { shape } = state;
  const [D, R, C] = shape;
  const rentang = (n: number) => Array.from({ length: n }, (_, i) => i);
  const o = (k: number, i: number, j: number) => cubeOffset([k, i, j], shape);

  let deret: DeretUrut[];
  let pembuka: string;
  if (op.cakupan === "semua") {
    deret = [{ posisi: rentang(D * R * C), awalan: "" }];
    pembuka = `seluruh ${D * R * C} elemen diurutkan sebagai SATU deret mengikuti urutan memori (lapisan 0 dulu, baris demi baris), jadi sel bisa pindah lapisan.`;
  } else if (op.cakupan === "baris") {
    deret = rentang(D).flatMap((k) => rentang(R).map((i) => ({ posisi: rentang(C).map((j) => o(k, i, j)), awalan: `arr[${k}][${i}]: ` })));
    pembuka = `setiap baris mendatar di setiap lapisan diurutkan sendiri-sendiri (${D * R} baris).`;
  } else if (op.cakupan === "kolom") {
    deret = rentang(D).flatMap((k) => rentang(C).map((j) => ({ posisi: rentang(R).map((i) => o(k, i, j)), awalan: `arr[${k}][*][${j}]: ` })));
    pembuka = `setiap kolom tegak di setiap lapisan diurutkan sendiri-sendiri (${D * C} kolom).`;
  } else {
    deret = rentang(R).flatMap((i) => rentang(C).map((j) => ({ posisi: rentang(D).map((k) => o(k, i, j)), awalan: `Pilar arr[*][${i}][${j}]: ` })));
    pembuka = `setiap pilar - satu sel dari tiap lapisan, menembus kubus - diurutkan sendiri-sendiri (${R * C} pilar).`;
  }
  const susun = (pen: ReadonlyMap<number, number>) => state.cells.map((_, x) => state.cells[pen.get(x) ?? x]);
  const { steps } = langkahUrut<CubeLabState>({
    kind: op.kind,
    arah: op.arah,
    deret,
    nilaiDi: (x) => state.cells[x].value,
    idDi: (x) => state.cells[x].id,
    nama: (x) => `arr${cubeLabel(cubeKoord(x, shape))}`,
    bingkai: (pen) => settleCube({ ...state, cells: susun(pen), boxes: [] }),
    akhir: (pen) => settleCube({ ...state, cells: susun(pen) }),
    pembuka,
  });
  if (steps.length > LAB_MAX_STEPS_URUT) return gagal(galatTerlaluPanjang(op.kind, steps.length, LAB_MAX_STEPS_URUT));
  return { ok: true, steps };
}
