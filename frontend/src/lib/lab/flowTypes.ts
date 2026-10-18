/**
 * Bentuk data flowchart SynapLab dan batas-batasnya.
 *
 * Modul NETRAL (tanpa impor `@/`): dipakai kanvas, pemeriksa aturan, mesin
 * jalan, codec tautan, dan `scripts/verify-flowchart.ts`.
 *
 * Simbol mengikuti ANSI/ISO 5807 seperti yang diajarkan di kelas pemrograman
 * dasar. Mulai dan Selesai SENGAJA dua jenis berbeda (bentuknya sama-sama
 * kapsul): mesin jalan dan pemeriksa aturan butuh tahu mana awal dan mana
 * akhir, dan menebaknya dari teks ("Mulai"/"Start"/"Begin") rapuh.
 */

export type JenisSimpul =
  | "mulai"
  | "selesai"
  | "proses"
  | "io"
  | "keputusan"
  | "persiapan"
  | "subproses"
  | "konektor"
  | "dokumen"
  | "data"
  | "catatan";

export const JENIS_SIMPUL: readonly JenisSimpul[] = [
  "mulai",
  "selesai",
  "proses",
  "io",
  "keputusan",
  "persiapan",
  "subproses",
  "konektor",
  "dokumen",
  "data",
  "catatan",
];

export interface InfoJenis {
  nama: string;
  /** Satu kalimat untuk palet & tooltip. */
  ket: string;
  /** Ukuran bawaan saat ditambahkan (px kanvas). */
  w: number;
  h: number;
  /** Teks bawaan saat ditambahkan. */
  teks: string;
}

export const INFO_JENIS: Record<JenisSimpul, InfoJenis> = {
  mulai: { nama: "Mulai", ket: "Titik awal alur. Tepat satu.", w: 140, h: 50, teks: "Mulai" },
  selesai: { nama: "Selesai", ket: "Titik akhir alur. Minimal satu.", w: 140, h: 50, teks: "Selesai" },
  proses: { nama: "Proses", ket: "Perhitungan atau penugasan: total = total + x", w: 160, h: 60, teks: "x = 0" },
  io: { nama: "Input / Output", ket: "Baca x  ·  Tampilkan x", w: 170, h: 60, teks: "Baca x" },
  keputusan: { nama: "Keputusan", ket: "Kondisi dengan dua cabang: Ya dan Tidak", w: 160, h: 90, teks: "x > 0?" },
  persiapan: { nama: "Persiapan", ket: "Inisialisasi atau awal perulangan: i = 1", w: 170, h: 60, teks: "i = 1" },
  subproses: { nama: "Subproses", ket: "Prosedur/fungsi yang dijelaskan terpisah", w: 170, h: 60, teks: "Hitung luas" },
  konektor: { nama: "Konektor", ket: "Penyambung alur berlabel sama (A ke A)", w: 44, h: 44, teks: "A" },
  dokumen: { nama: "Dokumen", ket: "Laporan atau dokumen tercetak", w: 160, h: 70, teks: "Laporan" },
  data: { nama: "Data tersimpan", ket: "Basis data atau penyimpanan", w: 140, h: 70, teks: "Data" },
  catatan: { nama: "Catatan", ket: "Keterangan; tidak ikut alur", w: 160, h: 50, teks: "Catatan" },
};

/** Sisi tempat garis menempel. */
export type Sisi = "atas" | "kanan" | "bawah" | "kiri";
export const SISI: readonly Sisi[] = ["atas", "kanan", "bawah", "kiri"];

export interface Simpul {
  id: number;
  jenis: JenisSimpul;
  x: number;
  y: number;
  w: number;
  h: number;
  teks: string;
}

export interface Garis {
  id: number;
  dari: number;
  ke: number;
  dariSisi: Sisi;
  keSisi: Sisi;
  /** Untuk cabang Keputusan: "Ya" / "Tidak". Boleh kosong untuk garis biasa. */
  label: string;
}

export interface Diagram {
  simpul: Simpul[];
  garis: Garis[];
  /** Pencacah id monoton untuk simpul & garis bersama — tidak pernah dipakai ulang. */
  nextId: number;
}

// ── Batas ───────────────────────────────────────────────────────────────
// Satu sumber untuk formulir, codec tautan, dan skrip uji.

export const FLOW_MAX_SIMPUL = 120;
export const FLOW_MAX_GARIS = 240;
export const FLOW_MAX_TEKS = 200;
export const FLOW_MAX_LABEL = 20;
export const FLOW_MIN_UKURAN = 30;
export const FLOW_MAX_UKURAN = 600;
/** Koordinat kanvas yang sah: -BATAS..BATAS. Menahan diagram "terbang" tak terhingga. */
export const FLOW_BATAS_KOORDINAT = 10_000;
export const FLOW_GRID = 10;

export function diagramKosong(): Diagram {
  return { simpul: [], garis: [], nextId: 1 };
}

/** Jenis yang ikut alur (dihitung pemeriksa & mesin jalan). Catatan tidak. */
export function ikutAlur(jenis: JenisSimpul): boolean {
  return jenis !== "catatan";
}

/** Label cabang "benar". Dibandingkan tanpa beda huruf besar-kecil. */
export const LABEL_YA: readonly string[] = ["ya", "y", "benar", "true", "yes"];
export const LABEL_TIDAK: readonly string[] = ["tidak", "t", "salah", "false", "no", "n"];

export function artiLabel(label: string): "ya" | "tidak" | null {
  const l = label.trim().toLowerCase();
  if (LABEL_YA.includes(l)) return "ya";
  if (LABEL_TIDAK.includes(l)) return "tidak";
  return null;
}
