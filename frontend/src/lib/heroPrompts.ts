/**
 * Kalimat yang "diketik" di bilah pencarian hero, DIBANGUN dari katalog.
 *
 * Modul netral (tanpa server-only / "use client" / impor `@/`): murni fungsi
 * dari daftar kursus, jadi kursus baru otomatis menambah kalimat tanpa ada
 * yang perlu mengedit daftar. Tiap kalimat membawa `q` - kata yang dibawa
 * anak panah ke /courses?q=… - sehingga hasil yang dibuka SELALU memuat
 * kursus yang disebut kalimatnya (q diambil dari judul/kategori kursus itu
 * sendiri, bukan ditebak).
 *
 * Sengaja templat tetap, bukan hasil panggilan AI: kalimat ini tampil di
 * halaman utama pada setiap kunjungan, jadi harus instan, gratis, dan tidak
 * bergantung pada kuota model gratis yang kolamnya dipakai bersama.
 */

export type HeroPrompt = {
  /** Kalimat yang diketik di bilah. */
  text: string;
  /** Kata pencarian untuk /courses?q=… (kosong = tanpa penyaringan). */
  q: string;
};

type KursusMin = { slug: string; title: string; category: string; price: number };
type KategoriMin = { slug: string; label: string };

/** Cadangan bila katalog kosong: tanpa q, anak panah membuka seluruh katalog. */
const CADANGAN: HeroPrompt[] = [
  { text: "Saya ingin belajar analisis data dari nol", q: "" },
  { text: "Carikan kursus neuroscience untuk pemula", q: "" },
  { text: "Bagaimana cara memulai pemrograman?", q: "" },
  { text: "Rekomendasi kursus gratis untuk mahasiswa", q: "" },
];

/** Batas agar bilah tidak dipenuhi puluhan kalimat mirip. */
const MAKS = 36;
/** Judul terlalu panjang tak muat di bilah; lewati. */
const JUDUL_MAKS = 46;

const TEMPLAT: ((t: string) => string)[] = [
  (t) => `Saya ingin belajar ${t}`,
  (t) => `Carikan kursus ${t}`,
  (t) => `Bagaimana cara memulai ${t}?`,
  (t) => `Rekomendasi kursus tentang ${t}`,
];

/** Hash kecil & stabil supaya kursus yang sama selalu dapat templat yang sama. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function buildHeroPrompts(kursus: KursusMin[], kategori: KategoriMin[]): HeroPrompt[] {
  const out: HeroPrompt[] = [];

  for (const k of kursus) {
    const judul = k.title.trim();
    if (!judul || judul.length > JUDUL_MAKS) continue;
    const gratis = k.price <= 0 && hash(k.slug) % 3 === 0;
    out.push({
      text: gratis ? `Ada kursus gratis ${judul}?` : TEMPLAT[hash(k.slug) % TEMPLAT.length](judul),
      q: judul,
    });
  }

  // Satu kalimat per kategori yang benar-benar punya kursus.
  const dipakai = new Set(kursus.map((k) => k.category));
  for (const c of kategori) {
    if (!dipakai.has(c.slug) || !c.label.trim()) continue;
    out.push({ text: `Carikan kursus ${c.label.trim()} untuk pemula`, q: c.label.trim() });
  }

  if (out.length === 0) return CADANGAN;
  return out.slice(0, MAKS);
}

/** Alamat tujuan anak panah. */
export function heroHref(p: HeroPrompt): string {
  return p.q ? `/courses?q=${encodeURIComponent(p.q)}` : "/courses";
}
