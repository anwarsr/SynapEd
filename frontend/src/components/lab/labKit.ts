import type { ComponentType } from "react";
import type { LabId, LabKelompok, LabOpResult } from "@/lib/lab/labTypes";
import type { OpSpecOf } from "@/lib/lab/labForm";

/**
 * Kontrak satu lab untuk ruang kerja generik.
 *
 * Ruang kerja (bilah alat, langkah, riwayat, pemutar, presentasi, bagikan,
 * tombol pintas) ditulis SEKALI. Setiap lab — 1D, 2D, N-dimensi — cukup
 * menyediakan reducer, katalog operasi, kanvas, dan cara menavigasi sel. Lab
 * baru tidak menyentuh ruang kerja sama sekali.
 *
 * `S` keadaan papan, `Op` operasi, `P` bentuk "sel terpilih" (indeks 1D,
 * pasangan baris-kolom 2D, atau koordinat N-D).
 */
export interface LabBoardProps<S, P, Op> {
  state: S;
  /** Indeks datar yang sedang berpendar karena langkah animasi. */
  fokus: readonly number[];
  /** Warna asal sel selama transformasi (langkah sekarang), kalau ada. */
  kelompok?: LabKelompok;
  /** Id sel yang sudah dikunjungi penelusuran, berurutan, kalau ada. */
  jalur?: readonly number[];
  terpilih: P | null;
  onPilih: (p: P) => void;
  /** Menjalankan operasi dari tombol mulai cepat di papan kosong. */
  onMulai: (op: Op) => void;
  presentasi: boolean;
}

export interface LabGroup {
  id: string;
  label: string;
  /** Path ikon Heroicons outline 24px. */
  ikon: string;
}

export interface LabKit<S, Op extends { kind: string }, P> {
  id: LabId;
  /** Label pengalih, mis. "1D". */
  nama: string;
  /** Kalimat pendek di bawah judul halaman. */
  ringkas: string;
  kosong: () => S;
  terapkan: (s: S, op: Op) => LabOpResult<S>;
  katalog: readonly OpSpecOf<Op["kind"], string, Op>[];
  grup: readonly LabGroup[];
  bangun: (kind: Op["kind"], nilai: Record<string, string>) => Op | null;
  namaOperasi: (op: Op) => string;
  Papan: ComponentType<LabBoardProps<S, P, Op>>;
  /** Kode tautan bagikan, atau null kalau papan tidak bisa dibagikan. */
  encode: (s: S) => string | null;
  /** Pilihan yang masih sah untuk keadaan ini, atau null. */
  sahkanPilihan: (s: S, p: P | null) => P | null;
  /** Pilihan baru untuk sebuah tombol panah/Home/End; undefined = tombol tidak dipakai. */
  navigasi: (s: S, p: P | null, tombol: string) => P | null | undefined;
  /** Nilai untuk tombol "pakai sel" pada isian bernama tertentu, atau null. */
  isianDariPilihan: (p: P, namaIsian: string) => string | null;
  /**
   * Nama isian yang BISA diisi dari sel terpilih. Ditentukan lepas dari ada
   * tidaknya pilihan saat ini: isian ini dibiarkan kosong di awal (bukan diisi
   * contohnya), supaya operasi tidak diam-diam berjalan di sel 0.
   */
  isianSel: readonly string[];
  /** Label singkat pilihan, mis. "sel 2" atau "[1][2]". */
  labelPilihan: (p: P) => string;
  /** Baris daftar tombol pintas untuk memilih sel: [tombol, arti]. */
  tombolPilih: readonly (readonly [string, string])[];
}
