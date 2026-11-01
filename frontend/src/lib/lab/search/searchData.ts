/**
 * Data masukan Lab Searching: urai data & nilai yang dicari, contoh kasus,
 * dan data acak.
 *
 * Modul netral.
 */
import { mulberry32 } from "../labRandom";
import { uraiAngka, uraiSatu, type HasilAngka } from "../labAngka";
import { CARI_MAX_DATA, CARI_MIN_DATA, CARI_NILAI_MAKS } from "./searchTypes";

export function uraiData(teks: string): HasilAngka {
  return uraiAngka(teks, { min: CARI_MIN_DATA, maks: CARI_MAX_DATA, nilaiMaks: CARI_NILAI_MAKS, untuk: "dicari" });
}

export function uraiDicari(teks: string): { ok: true; nilai: number } | { ok: false; galat: string } {
  return uraiSatu(teks, CARI_NILAI_MAKS);
}

export interface ContohCari {
  id: string;
  nama: string;
  ket: string;
  nilai: readonly number[];
  dicari: number;
}

const DUA_BELAS = [38, 27, 43, 3, 9, 82, 10, 61, 55, 19, 70, 24];
const TIGA_PULUH_DUA = [
  74, 12, 89, 33, 5, 61, 47, 90, 28, 16, 53, 70, 9, 38, 84, 21, 66, 3, 57, 95, 42, 18, 79, 30, 8, 63, 49, 26, 87, 14, 35, 92,
];

/** Contoh siap pakai — masing-masing memperlihatkan sifat yang berbeda. */
export const CONTOH_CARI: readonly ContohCari[] = [
  { id: "acak", nama: "Acak", ket: "Kasus umum: nilai ada di tengah data.", nilai: DUA_BELAS, dicari: 61 },
  { id: "awal", nama: "Di awal", ket: "Kasus terbaik linear search: nilai ada di posisi pertama.", nilai: [12, 45, 7, 33, 21, 58, 9, 40], dicari: 12 },
  { id: "tidak", nama: "Tidak ada", ket: "Kasus terburuk linear search: semua data diperiksa.", nilai: DUA_BELAS, dicari: 50 },
  {
    id: "kembar",
    nama: "Ada nilai kembar",
    ket: "Linear search menemukan yang pertama; binary search menemukan salah satunya - yang kebetulan kena tebakan.",
    nilai: [15, 8, 27, 15, 3, 27, 15, 40],
    dicari: 15,
  },
  { id: "panjang", nama: "32 data", ket: "Selisih terbesar: linear sampai 32 perbandingan, binary paling banyak 6.", nilai: TIGA_PULUH_DUA, dicari: 35 },
];

export const CONTOH_BAWAAN = CONTOH_CARI[0];

/**
 * n angka acak 1..99 dari benih, beserta nilai yang dicari: biasanya diambil
 * dari data (supaya ketemu), kadang sengaja nilai yang tidak ada.
 */
export function dataAcak(benih: number, n = 16): { nilai: number[]; dicari: number } {
  const acak = mulberry32(benih);
  const nilai = Array.from({ length: n }, () => 1 + Math.floor(acak() * 99));
  if (acak() < 0.8) return { nilai, dicari: nilai[Math.floor(acak() * n)] };
  let dicari = 1 + Math.floor(acak() * 99);
  while (nilai.includes(dicari)) dicari = (dicari % 99) + 1;
  return { nilai, dicari };
}
