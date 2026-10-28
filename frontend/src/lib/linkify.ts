/**
 * Mengubah teks polos menjadi potongan teks & tautan.
 *
 * Modul NETRAL (tanpa `server-only`, tanpa `use client`, tanpa impor `@/`):
 * dipakai komponen server `TeksBertaut` dan diuji skrip verifikasi.
 *
 * Isi pengumuman TETAP teks polos (tidak ada markup yang ditafsirkan - lihat
 * komentar PostFeed). Yang dikenali hanya alamat web: `http(s)://…` dan `www.…`.
 * Skema lain (`javascript:`, `data:`, `mailto:`, `file:`, …) TIDAK pernah jadi tautan,
 * dan setiap kandidat dilewatkan `URL` supaya hanya host berbentuk domain yang lolos.
 */

export type Potongan = { jenis: "teks"; isi: string } | { jenis: "tautan"; isi: string; href: string };

/** Awal alamat sampai spasi/kurung sudut/kutip. Tanda baca di ujung dipangkas terpisah. */
const RE_ALAMAT = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** Tanda baca yang lazim menempel di ujung alamat dalam kalimat, bukan bagian dari alamatnya. */
const UJUNG = /[.,;:!?'"”’…]+$/;

/** Memangkas penutup yang tak berpasangan: "(lihat https://x.id)" → alamat tanpa ")" tetapi "…/a_(b)" tetap utuh. */
function pangkasUjung(raw: string): string {
  let s = raw;
  for (;;) {
    const sebelum = s;
    s = s.replace(UJUNG, "");
    for (const [buka, tutup] of [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ] as const) {
      while (s.endsWith(tutup) && s.split(tutup).length > s.split(buka).length) s = s.slice(0, -1);
    }
    if (s === sebelum) return s;
  }
}

/** Alamat yang aman dibuka: http/https saja, host harus punya titik (bukan "localhost" / angka telanjang). */
function hrefSah(alamat: string): string | null {
  const href = /^www\./i.test(alamat) ? `https://${alamat}` : alamat;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null; // "https://nama:sandi@host" sering dipakai untuk menyamar
    if (!u.hostname.includes(".") || u.hostname.startsWith(".") || u.hostname.endsWith(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function pecahTeksTautan(teks: string): Potongan[] {
  const out: Potongan[] = [];
  let akhir = 0;

  for (const m of teks.matchAll(RE_ALAMAT)) {
    const awal = m.index ?? 0;
    const alamat = pangkasUjung(m[0]);
    const href = hrefSah(alamat);
    if (!href) continue;

    if (awal > akhir) out.push({ jenis: "teks", isi: teks.slice(akhir, awal) });
    out.push({ jenis: "tautan", isi: alamat, href });
    akhir = awal + alamat.length;
  }

  if (akhir < teks.length) out.push({ jenis: "teks", isi: teks.slice(akhir) });
  return out;
}
