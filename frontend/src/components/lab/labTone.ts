import type { LabPeran, LabPointerTone, LabTone } from "@/lib/lab/labTypes";

/**
 * Satu-satunya tempat nada sorotan bertemu warna.
 *
 * Kelasnya ditulis sebagai string UTUH, bukan disusun dengan `cn()` dari
 * potongan: `cn()` di proyek ini hanya penggabung biasa (bukan tailwind-merge),
 * jadi `cn("bg-paper-card border-rule", nada)` menghasilkan dua kelas latar
 * yang saling bertabrakan dan yang menang ditentukan urutan di berkas CSS —
 * bukan oleh kita.
 *
 * `amber-500` sengaja hanya dipakai sebagai GARIS. Kontrasnya 2,3:1, gagal
 * untuk teks; teksnya memakai `amber-700`.
 */
export const LAB_TONE_CLASS: Record<LabTone, string> = {
  sorot: "border-amber-500 bg-amber-100 text-amber-700",
  banding: "border-blue-300 bg-blue-50 text-blue-700",
  hasil: "border-blue-500 bg-blue-100 text-blue-700",
  buang: "border-rust-700/30 bg-rust-100 text-rust-700",
};

/** Label untuk pembaca layar dan daftar sorotan — warna tidak pernah jadi satu-satunya penanda. */
export const LAB_TONE_LABEL: Record<LabTone, string> = {
  sorot: "disorot",
  banding: "sedang dibandingkan",
  hasil: "bagian hasil",
  buang: "akan dibuang",
};

/** Sel biasa, saat tidak sedang disorot nada apa pun. */
export const LAB_CELL_NETRAL = "border-rule bg-paper-card text-ink";

/** Sel yang sedang menjadi fokus langkah animasi — cincin, bukan ganti warna latar. */
export const LAB_CELL_FOKUS = "ring-2 ring-blue-500 ring-offset-2 ring-offset-paper-card";

export const LAB_POINTER_CLASS: Record<LabPointerTone, string> = {
  utama: "bg-blue-600 text-white",
  kedua: "bg-ink text-paper",
};

export const LAB_POINTER_LABEL: Record<LabPointerTone, string> = {
  utama: "penunjuk utama",
  kedua: "penunjuk kedua",
};

/**
 * Warna asal sel selama transformasi (`LabStep.kelompok`), satu per nomor.
 *
 * Sistem desain hanya punya tiga warna (biru, kuning tua, karat) ditambah
 * tinta, jadi delapan kelompok dibedakan oleh warna DAN gaya garis: empat
 * pertama bergaris penuh dengan latar berwarna, empat berikutnya bergaris
 * putus-putus. Teksnya selalu varian 700 — `amber-500` gagal kontras untuk teks.
 */
export const LAB_KELOMPOK_CLASS: readonly string[] = [
  "border-blue-500 bg-blue-100 text-blue-700",
  "border-amber-500 bg-amber-100 text-amber-700",
  "border-rust-700/50 bg-rust-100 text-rust-700",
  "border-ink/50 bg-paper-alt text-ink",
  "border-dashed border-blue-500 bg-blue-50 text-blue-700",
  "border-dashed border-amber-500 bg-paper-card text-amber-700",
  "border-dashed border-rust-700/50 bg-paper-card text-rust-700",
  "border-dashed border-ink/50 bg-paper-card text-ink",
];

/** Kelas sel untuk sebuah id menurut kelompoknya, atau null kalau tidak berkelompok. */
export function kelasKelompok(kelompok: { warna: Record<number, number> } | undefined, id: number): string | null {
  const n = kelompok?.warna[id];
  return n === undefined ? null : LAB_KELOMPOK_CLASS[n % LAB_KELOMPOK_CLASS.length];
}

/**
 * Kelas fokus: SATU sel berdenyut (sel yang sedang dibahas), sekelompok sel
 * cukup bercincin diam. Banyak sel yang berdenyut bersamaan membuat mata tidak
 * tahu harus melihat ke mana.
 */
export function kelasFokus(jumlahFokus: number): string {
  return jumlahFokus === 1 ? "lab-glow border-blue-500" : "ring-2 ring-blue-600 ring-offset-2 ring-offset-paper-card";
}

/**
 * Warna peran sel selama pengurutan (`LabStep.peran`). Mengalahkan semua warna
 * lain: selama algoritma berjalan, yang harus terbaca adalah PERAN tiap sel.
 * "Terurut" sengaja paling gelap — sel yang sudah di tempat akhirnya terkunci.
 */
export const LAB_PERAN_CLASS: Record<LabPeran, string> = {
  banding: "border-blue-600 bg-blue-100 text-blue-700",
  kunci: "border-amber-500 bg-amber-100 text-amber-700",
  pivot: "border-rust-700 bg-rust-100 text-rust-700",
  sementara: "border-dashed border-ink/50 bg-paper-alt text-ink",
  terurut: "border-ink bg-ink text-paper",
  luar: "border-rule bg-paper-card text-ink-faint opacity-40",
  hapus: "border-dashed border-rust-700 bg-rust-100 text-rust-700",
  hasil: "border-blue-600 bg-blue-600 text-white",
};

export const LAB_PERAN_LABEL: Record<LabPeran, string> = {
  banding: "sedang dibandingkan",
  kunci: "kunci / min / maks",
  pivot: "pivot",
  sementara: "sudah urut sementara",
  terurut: "sudah di tempat akhir",
  luar: "sedang tidak dikerjakan",
  hapus: "akan dihapus",
  hasil: "ditemukan",
};

/** Urutan tampil di legenda. */
export const LAB_PERAN_URUT: readonly LabPeran[] = ["banding", "hasil", "kunci", "pivot", "hapus", "sementara", "terurut", "luar"];

export function kelasPeran(peran: Record<number, LabPeran> | undefined, id: number): string | null {
  const r = peran?.[id];
  return r === undefined ? null : LAB_PERAN_CLASS[r];
}
