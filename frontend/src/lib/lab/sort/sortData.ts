/**
 * Data masukan Lab Sorting: urai teks ketikan, contoh kasus, dan data acak.
 *
 * Nilai dibatasi 0..999 (bilangan bulat). Negatif sengaja tidak diterima: tinggi
 * batang mewakili nilai, dan batang "di bawah nol" membuat gambar lebih sulit
 * dibaca daripada manfaatnya untuk materi pengurutan.
 *
 * Modul netral.
 */
import { mulberry32 } from "../labRandom";
import { uraiAngka, type HasilAngka } from "../labAngka";
import { SORT_MAX_DATA, SORT_MIN_DATA, SORT_NILAI_MAKS } from "./sortTypes";

export type HasilData = HasilAngka;

/** Mengurai "38, 27 43;3" menjadi angka. Pemisah: koma, titik koma, atau spasi. */
export function uraiData(teks: string): HasilData {
  return uraiAngka(teks, { min: SORT_MIN_DATA, maks: SORT_MAX_DATA, nilaiMaks: SORT_NILAI_MAKS, untuk: "diurutkan" });
}

export interface ContohKasus {
  id: string;
  nama: string;
  ket: string;
  nilai: readonly number[];
}

/**
 * Contoh siap pakai. Masing-masing memperlihatkan sifat yang berbeda — terutama
 * kasus terbaik & terburuk bubble sort, dan kestabilan pada nilai kembar.
 */
export const CONTOH_KASUS: readonly ContohKasus[] = [
  { id: "acak", nama: "Acak", ket: "Kasus umum.", nilai: [38, 27, 43, 3, 9, 82, 10] },
  { id: "urut", nama: "Sudah urut", ket: "Kasus terbaik bubble sort: satu putaran tanpa pertukaran lalu berhenti.", nilai: [4, 9, 15, 22, 31, 40, 57] },
  { id: "terbalik", nama: "Terbalik", ket: "Kasus terburuk bubble sort: setiap perbandingan berujung pertukaran.", nilai: [57, 40, 31, 22, 15, 9, 4] },
  { id: "hampir", nama: "Hampir urut", ket: "Hanya dua nilai tertukar: bubble sort cepat selesai.", nilai: [4, 9, 22, 15, 31, 40, 57] },
  { id: "kembar", nama: "Ada nilai kembar", ket: "Nilai sama tetap dalam urutan semulanya (kedua algoritma stabil).", nilai: [27, 8, 27, 3, 15, 8, 27] },
];

export const DATA_BAWAAN: readonly number[] = CONTOH_KASUS[0].nilai;

/** n angka acak 1..99 dari benih (hasil sama untuk benih yang sama). */
export function dataAcak(benih: number, n = 8): number[] {
  const acak = mulberry32(benih);
  return Array.from({ length: n }, () => 1 + Math.floor(acak() * 99));
}
