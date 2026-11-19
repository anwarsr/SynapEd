/**
 * Bagian bersama lab Stack dan Queue: sel memori, nilai yang sah, pita
 * penerapan, dan pencari baris pseudocode.
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/`.
 *
 * Kedua lab memodelkan struktur data BERBASIS ARRAY seperti di silabus
 * Cambridge 9618: memorinya array berukuran tetap, dan yang berubah hanya
 * penunjuknya. Karena itu nilai yang sudah "keluar" (di-pop / di-dequeue)
 * SENGAJA tetap tertinggal di sel memorinya - begitulah array sungguhan
 * bekerja - dan papan menggambarnya pudar sebagai sisa di luar struktur.
 */

export const ADT_MIN_KAPASITAS = 2;
export const ADT_MAX_KAPASITAS = 10;
export const ADT_KAPASITAS_AWAL = 6;
/** Penerapan (cek kurung, simulasi loket, …) bisa puluhan langkah; tetap dibatasi. */
export const ADT_MAX_LANGKAH = 140;
/** Panjang masukan penerapan yang diproses karakter/kejadian demi karakter/kejadian. */
export const ADT_MAX_MASUKAN = 24;

/** Satu isi sel memori; `id` stabil untuk animasi (ikut bergerak di papan). */
export interface SelAdt {
  id: number;
  nilai: string;
}

/**
 * Nilai sel: nilai lab biasa (1-6 huruf/angka) ATAU satu kurung buka - yang
 * terakhir hanya supaya penerapan "cek kurung" bisa menaruh `(`, `[`, `{` di
 * stack. Pemisah URL (`,` `:` `~` `;`) dan karakter yang mengubah arti tautan
 * tetap dilarang.
 */
export const ADT_NILAI_RE = /^(?:[A-Za-z0-9.\-]{1,6}|[([{])$/;

/**
 * Pita penerapan: masukan yang diproses satu per satu, posisi yang sedang
 * dibaca, dan kesimpulannya. Tidak ikut tautan bagikan (hanya isi struktur).
 */
export interface PitaAdt {
  judul: string;
  /** Token yang dibaca berurutan (karakter, kata, atau kejadian). */
  token: string[];
  /** Indeks token yang sedang dibaca; -1 = belum mulai, token.length = selesai. */
  posisi: number;
  /** Baris hasil yang terkumpul, mis. kata terbalik atau daftar yang dilayani. */
  hasil: string;
  /** Kesimpulan akhir; null selama masih berjalan. */
  simpulan: { baik: boolean; teks: string } | null;
}

/** Pita yang dimajukan ke posisi lain (salinan; keadaan langkah tidak pernah dimutasi). */
export function pitaKe(p: PitaAdt, posisi: number, ubah: Partial<PitaAdt> = {}): PitaAdt {
  return { ...p, token: [...p.token], posisi, ...ubah };
}

/** Nomor baris pertama (1-based) yang diawali `awal`, mulai SESUDAH baris `setelah`. */
export function barisKode(kode: string, awal: string, setelah = 0): number {
  const baris = kode.split("\n");
  for (let i = setelah; i < baris.length; i++) if (baris[i].trim().startsWith(awal)) return i + 1;
  throw new Error(`Baris "${awal}" tidak ada di pseudocode.`);
}

export const PANAH = "←";

/** Nilai pengguna yang sudah dibersihkan, atau null bila tidak sah. */
export function nilaiSah(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return ADT_NILAI_RE.test(v) ? v : null;
}

/** Pemecah daftar nilai dari formulir: dipisah koma ATAU spasi. */
export function pecahNilai(teks: string): string[] {
  return teks
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
