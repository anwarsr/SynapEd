/**
 * Mengurai deretan bilangan bulat ketikan pengguna — dipakai Lab Sorting dan
 * Lab Searching (batas jumlahnya berbeda, aturan & pesannya sama).
 *
 * Pemisah: koma, titik koma, atau spasi. Negatif sengaja ditolak: kedua lab
 * menggambar nilai (tinggi batang, kotak), dan nilai di bawah nol lebih
 * membingungkan daripada bermanfaat untuk materinya.
 *
 * Modul netral.
 */

export type HasilAngka = { ok: true; nilai: number[] } | { ok: false; galat: string };

export interface BatasAngka {
  min: number;
  maks: number;
  nilaiMaks: number;
  /** Penutup pesan "Minimal n angka supaya ada yang …": "diurutkan", "dicari". */
  untuk: string;
}

export function uraiAngka(teks: string, b: BatasAngka): HasilAngka {
  const potong = teks.split(/[\s,;]+/).filter((t) => t !== "");
  if (potong.length === 0) return { ok: false, galat: `Isi minimal ${b.min} angka, dipisah koma atau spasi.` };

  const nilai: number[] = [];
  for (const t of potong) {
    const h = uraiSatu(t, b.nilaiMaks);
    if (!h.ok) return h;
    nilai.push(h.nilai);
  }
  if (nilai.length < b.min) return { ok: false, galat: `Minimal ${b.min} angka supaya ada yang ${b.untuk}.` };
  if (nilai.length > b.maks) {
    return { ok: false, galat: `Maksimal ${b.maks} angka (sekarang ${nilai.length}) supaya setiap langkah tetap terbaca.` };
  }
  return { ok: true, nilai };
}

/** Satu bilangan bulat 0..nilaiMaks. */
export function uraiSatu(t: string, nilaiMaks: number): { ok: true; nilai: number } | { ok: false; galat: string } {
  const s = t.trim();
  if (s === "") return { ok: false, galat: "Isi sebuah angka." };
  if (/^-\d+$/.test(s)) return { ok: false, galat: `${s}: angka negatif belum didukung - pakai 0 sampai ${nilaiMaks}.` };
  if (!/^\d+$/.test(s)) return { ok: false, galat: `"${s.slice(0, 12)}" bukan bilangan bulat.` };
  const v = Number(s);
  if (v > nilaiMaks) return { ok: false, galat: `${s} terlalu besar - maksimal ${nilaiMaks}.` };
  return { ok: true, nilai: v };
}
