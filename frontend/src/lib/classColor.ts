/**
 * Warna kelas diturunkan dari NAMANYA, bukan dari field di Firestore.
 *
 * Alasannya sama dengan lessonsCount yang tidak disimpan: nilai turunan yang
 * ikut ditulis akan melenceng begitu namanya diganti. Dihitung ulang setiap
 * render, jadi tidak mungkin tidak sinkron — dan tidak ada migrasi data untuk
 * kelas yang sudah terlanjur ada.
 *
 * Modul ini NETRAL — tanpa `server-only`, tanpa `"use client"` — karena
 * dipakai Server Component (daftar kelas) maupun Client Component. Pola yang
 * sama dengan classTypes.ts.
 */

export interface NadaKelas {
  /** Latar plate & chip. */
  tint: string;
  /** Teks/inisial di atas tint. */
  deep: string;
  /** Garis pemisah spine. */
  garis: string;
  /** Nada Tag yang sepadan. Tag tidak punya nada hijau — jangan tambahkan. */
  tag: "blue" | "amber" | "rust" | "neutral";
}

/**
 * Kelas Tailwind ditulis PENUH, bukan dirangkai (`bg-${warna}-50`).
 *
 * Tailwind memindai kode sebagai teks; kelas yang dirangkai saat runtime tidak
 * pernah ikut terbangun, dan kegagalannya diam — warnanya sekadar tidak muncul.
 */
const NADA: readonly NadaKelas[] = [
  { tint: "bg-blue-50", deep: "text-blue-700", garis: "border-blue-100", tag: "blue" },
  { tint: "bg-amber-100", deep: "text-amber-700", garis: "border-amber-100", tag: "amber" },
  { tint: "bg-rust-100", deep: "text-rust-700", garis: "border-rust-100", tag: "rust" },
  { tint: "bg-navy", deep: "text-paper", garis: "border-navy", tag: "neutral" },
];

export function nadaKelas(nama: string): NadaKelas {
  let h = 0;
  for (let i = 0; i < nama.length; i++) h = (h * 31 + nama.charCodeAt(i)) >>> 0;
  return NADA[h % NADA.length];
}

/** Dua huruf pertama dari dua kata pertama. Kosong kalau namanya kosong. */
export function inisialKelas(nama: string): string {
  return nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}
