/**
 * Bentuk data Lab 06 Sorting (bubble sort & merge sort).
 *
 * Setiap algoritma direkam SEKALI menjadi deretan langkah, lalu diputar ulang
 * oleh `useLabPlayer`. Setiap langkah adalah POTRET UTUH (bukan selisih), jadi
 * maju, mundur, dan melompat ke langkah mana pun gratis — dengan paling banyak
 * 12 elemen, potret utuh tetap murah.
 *
 * Modul netral: dipakai komponen klien, halaman server, dan `verify-sorting`.
 */

export type AlgoSort = "bubble" | "merge";
export type ArahSort = "naik" | "turun";

export const ALGO_SORT: readonly AlgoSort[] = ["bubble", "merge"];

/** Satu elemen data. `id` = posisi SEMULA, penanda kestabilan untuk nilai kembar. */
export interface Batang {
  id: number;
  nilai: number;
}

export type JenisLangkah = "info" | "banding" | "tukar" | "bagi" | "daun" | "salin" | "selesai";

/**
 * Lama tiap jenis langkah ditahan pada kecepatan 1×. SENGAJA pelan: penontonnya
 * siswa awam yang harus sempat membaca kalimat penjelasan sebelum gambar
 * berubah. `verify-sorting` menolak angka yang lebih cepat dari ini.
 */
export const TAHAN_MS: Record<JenisLangkah, number> = {
  info: 2800,
  banding: 1900,
  tukar: 2600,
  bagi: 2200,
  daun: 1500,
  salin: 2600,
  selesai: 2800,
};

export const SORT_MIN_DATA = 2;
export const SORT_MAX_DATA = 12;
export const SORT_NILAI_MAKS = 999;

export interface LangkahSort {
  /** Judul pendek fase: "Putaran 2", "Bagi", "Gabung". */
  fase: string;
  /** Kalimat penjelasan langkah ini. */
  narasi: string;
  /** Baris pseudocode 9618 yang disorot (1-based), sampai `sampai` (inklusif). */
  baris: number;
  sampai: number;
  /** Penghitung kumulatif sampai langkah ini. `pindah` = pertukaran (bubble) / penyalinan (merge). */
  banding: number;
  pindah: number;
  jenis: JenisLangkah;
  tahanMs: number;
}

export type PeranBatang = "banding" | "tukar" | "terurut";

export interface LangkahBubble extends LangkahSort {
  /** Batang menurut posisinya sekarang (indeks 0 = A[1]). */
  urutan: Batang[];
  /** Peran per `id` batang. */
  peran: Record<number, PeranBatang>;
  /** Label kecil di atas batang ("j", "j+1"), per `id`. */
  label: Record<number, string>;
  /** Indeks (0-based) pertama bagian kanan yang sudah di tempat akhirnya; n = belum ada. */
  batasTerurut: number;
}

/**
 * Status simpul pohon merge sort:
 * - `tersembunyi`: belum dicapai pembagian;
 * - `menunggu`: sudah terlihat, belum diproses;
 * - `dibagi`: sudah dibelah, menunggu anak-anaknya urut;
 * - `menggabung`: sedang diisi dari kedua anaknya;
 * - `urut`: isinya sudah urut;
 * - `terpakai`: anak yang isinya sudah digabung ke induknya.
 */
export type StatusSimpul = "tersembunyi" | "menunggu" | "dibagi" | "menggabung" | "urut" | "terpakai";

export interface SimpulMerge {
  id: number;
  induk: number | null;
  kiri: number | null;
  kanan: number | null;
  /** Kedalaman: akar = 0. */
  tingkat: number;
  /** Rentang posisi di array semula, 0-based inklusif. */
  lo: number;
  hi: number;
  /** null = slot hasil yang belum terisi selama penggabungan. */
  isi: (Batang | null)[];
  status: StatusSimpul;
}

export interface LangkahMerge extends LangkahSort {
  simpul: SimpulMerge[];
  /** Simpul yang sedang dibagi/digabung. */
  aktif: number | null;
  /** Posisi relatif: i di anak kiri, j di anak kanan, k di simpul yang digabung. */
  penunjuk: { i: number | null; j: number | null; k: number | null };
  /** Sisi yang baru saja diambil (untuk sorotan). */
  ambil: "kiri" | "kanan" | null;
}

export interface Rekaman<L extends LangkahSort> {
  langkah: L[];
  banding: number;
  pindah: number;
}

/** Elemen `a` seharusnya berada SESUDAH `b` menurut arah urut. Seri = false (stabil). */
export function terbalik(a: number, b: number, arah: ArahSort): boolean {
  return arah === "naik" ? a > b : a < b;
}
