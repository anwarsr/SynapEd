/**
 * Bentuk bersama isi dokumen untuk penilaian AI (PDF lewat pdfIsi.ts, Office
 * lewat officeText.ts). Modul netral: dipakai server dan skrip verifikasi.
 */

/** Gambar yang ditemukan di dokumen. `data` null = ditemukan tetapi tidak diambil (`sebab`). */
export interface GambarDokumen {
  /** Nama urut yang juga tertulis di teks, mis. "Gambar 2". */
  label: string;
  /** Lokasi untuk pesan, mis. "halaman 3" atau "slide 2". */
  lokasi: string;
  mime: string;
  data: Buffer | null;
  sebab?: string;
}

/**
 * Teks berisi `penandaGambar(i)` di posisi gambar ke-i, supaya pemanggil bisa
 * menuliskannya sebagai "[Gambar 1]" atau "[Gambar 1 - tidak terbaca: …]"
 * sesuai gambar mana yang akhirnya dikirim ke AI.
 */
export interface IsiDokumen {
  teks: string;
  gambar: GambarDokumen[];
  /** Bagian yang diketahui TIDAK terbaca, dalam kalimat untuk pengajar. */
  catatan: string[];
}

/** Karakter NUL tidak mungkin muncul di teks XML maupun teks PDF, jadi aman sebagai penanda. */
export const penandaGambar = (i: number) => `\u0000G${i}\u0000`;
export const POLA_PENANDA = /\u0000G(\d+)\u0000/g;
