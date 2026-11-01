/**
 * Bentuk data Lab 07 Searching (linear, binary, dan jump search).
 *
 * Polanya sama dengan Lab 06 Sorting: algoritma direkam sekali menjadi potret
 * utuh per langkah, lalu `useLabPlayer` memutarnya.
 *
 * Modul netral.
 */

export type AlgoCari = "linear" | "binary" | "jump";

export const ALGO_CARI: readonly AlgoCari[] = ["linear", "binary", "jump"];

export const CARI_MIN_DATA = 2;
export const CARI_MAX_DATA = 32;
export const CARI_NILAI_MAKS = 999;

export type JenisLangkahCari = "info" | "urutkan" | "tengah" | "banding" | "buang" | "selesai";

/** Lama tahan per jenis langkah pada 1× — sengaja pelan, dijaga `verify-searching`. */
export const TAHAN_MS: Record<JenisLangkahCari, number> = {
  info: 2800,
  urutkan: 3000,
  tengah: 2200,
  banding: 1900,
  buang: 2600,
  selesai: 2800,
};

/** Satu kotak data. `id` = posisi di data semula (supaya pengurutan binary bisa meluncur). */
export interface SelCari {
  id: number;
  nilai: number;
}

export type NamaPenunjuk = "i" | "Kiri" | "Tengah" | "Kanan" | "Awal" | "Akhir";

export interface LangkahCari {
  fase: string;
  narasi: string;
  /** Rentang baris pseudocode yang disorot (1-based, inklusif). */
  baris: number;
  sampai: number;
  /** Perbandingan kumulatif (A[…] = Dicari). */
  banding: number;
  jenis: JenisLangkahCari;
  tahanMs: number;
  /** Data menurut posisinya sekarang (binary: sesudah diurutkan). */
  sel: SelCari[];
  /** Penunjuk → indeks 0-based. */
  penunjuk: Partial<Record<NamaPenunjuk, number>>;
  /** Sel yang sedang dibandingkan. */
  aktif: number | null;
  /** Rentang indeks (0-based, inklusif) yang sudah diperiksa/dibuang. */
  tersingkir: [number, number][];
  /** Terisi di langkah terakhir. */
  hasil: { ketemu: boolean; indeks: number | null } | null;
}

export interface RekamanCari {
  langkah: LangkahCari[];
  banding: number;
  hasil: { ketemu: boolean; indeks: number | null };
}

/** Batas jumlah perbandingan binary search untuk n data: ⌊log₂ n⌋ + 1. */
export const maksBinary = (n: number) => (n < 1 ? 0 : Math.floor(Math.log2(n)) + 1);

/** Ukuran lompatan jump search: ⌊√n⌋ (minimal 1) — sama dengan perulangan `Lompat` di pseudocode. */
export function lompatan(n: number): number {
  let m = 1;
  while ((m + 1) * (m + 1) <= n) m++;
  return m;
}

/**
 * Batas perbandingan jump search untuk n data: paling banyak ⌈n/m⌉ − 1 ujung blok
 * diperiksa (ujung blok terakhir tidak pernah dibandingkan), lalu ≤ m data di dalam blok.
 */
export const maksJump = (n: number) => (n < 1 ? 0 : Math.ceil(n / lompatan(n)) - 1 + lompatan(n));

/** Salinan data yang diurutkan naik secara STABIL (nilai kembar tetap dalam urutan semulanya). */
export function urutkanSel(nilai: readonly number[]): { semula: SelCari[]; urut: SelCari[]; sudahUrut: boolean } {
  const semula = nilai.map((v, id) => ({ id, nilai: v }));
  const urut = [...semula].sort((a, b) => a.nilai - b.nilai || a.id - b.id);
  return { semula, urut, sudahUrut: urut.every((s, i) => s.id === i) };
}
