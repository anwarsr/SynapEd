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
  sorot: "bg-amber-500/25 text-warn-text",
  banding: "bg-blue-500/20 text-blue-200",
  hasil: "bg-blue-500/35 text-white",
  buang: "bg-[#E0795A]/25 text-error-text",
};

/** Label untuk pembaca layar dan daftar sorotan — warna tidak pernah jadi satu-satunya penanda. */
export const LAB_TONE_LABEL: Record<LabTone, string> = {
  sorot: "disorot",
  banding: "sedang dibandingkan",
  hasil: "bagian hasil",
  buang: "akan dibuang",
};

/** Sel biasa, saat tidak sedang disorot nada apa pun. */
export const LAB_CELL_NETRAL = "bg-white/[0.08] text-white";

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
  "bg-blue-500/35 text-white",
  "bg-amber-500/30 text-warn-text",
  "bg-[#E0795A]/30 text-error-text",
  "bg-white/20 text-white",
  "bg-blue-500/15 text-blue-200 shadow-[inset_0_-3px_0_0_var(--color-blue-400)]",
  "bg-white/[0.08] text-warn-text shadow-[inset_0_-3px_0_0_#F3CF86]",
  "bg-white/[0.08] text-error-text shadow-[inset_0_-3px_0_0_#F2A892]",
  "bg-white/[0.08] text-white shadow-[inset_0_-3px_0_0_rgba(255,255,255,0.6)]",
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
  return jumlahFokus === 1 ? "lab-glow bg-blue-500/30 text-white" : "bg-blue-500/25 text-white shadow-[inset_0_-3px_0_0_var(--color-blue-400)]";
}

/**
 * Warna peran sel selama pengurutan (`LabStep.peran`). Mengalahkan semua warna
 * lain: selama algoritma berjalan, yang harus terbaca adalah PERAN tiap sel.
 * "Terurut" sengaja paling gelap — sel yang sudah di tempat akhirnya terkunci.
 */
export const LAB_PERAN_CLASS: Record<LabPeran, string> = {
  banding: "bg-blue-500/35 text-white",
  kunci: "bg-amber-500/30 text-warn-text",
  pivot: "bg-[#E0795A]/30 text-error-text",
  sementara: "bg-white/15 text-white shadow-[inset_0_-3px_0_0_rgba(255,255,255,0.6)]",
  terurut: "bg-white text-paper",
  luar: "bg-white/[0.06] text-white/40 opacity-40",
};

export const LAB_PERAN_LABEL: Record<LabPeran, string> = {
  banding: "sedang dibandingkan",
  kunci: "kunci / min / maks",
  pivot: "pivot",
  sementara: "sudah urut sementara",
  terurut: "sudah di tempat akhir",
  luar: "sedang tidak dikerjakan",
};

/** Urutan tampil di legenda. */
export const LAB_PERAN_URUT: readonly LabPeran[] = ["banding", "kunci", "pivot", "sementara", "terurut", "luar"];

export function kelasPeran(peran: Record<number, LabPeran> | undefined, id: number): string | null {
  const r = peran?.[id];
  return r === undefined ? null : LAB_PERAN_CLASS[r];
}
