/**
 * Generator acak berbenih untuk seluruh lab SynapLab.
 *
 * Modul NETRAL tanpa impor alias `@/` — dipakai mesin lab di browser dan
 * `scripts/verify-lab.ts` yang dijalankan tsx di luar Next.
 *
 * `Math.random` SENGAJA tidak dipakai di mana pun di lab, dan alasannya tiga:
 *
 * 1. Mengajar. Guru mengisi papan dengan benih 42, menjelaskan sortingnya, lalu
 *    minggu depan membuka tautan yang sama — dan harus mendapat deretan angka
 *    yang persis sama. Dengan `Math.random`, papan yang dijelaskan di kelas
 *    tidak pernah bisa ditunjukkan ulang, dan benih pun tidak perlu
 *    diserialisasi karena tidak berarti apa-apa.
 * 2. Menguji. Kegagalan yang muncul di kasus acak ke-13.481 hanya bisa dilacak
 *    kalau kasusnya bisa dibangkitkan ulang persis; pola yang sama sudah
 *    dipakai `scripts/verify-royalty-split.ts` dengan alasan itu.
 * 3. Hidrasi. Keadaan lab ikut dirender di server lewat parameter URL. Angka
 *    acak yang berbeda antara server dan klien adalah hydration mismatch —
 *    React membuang hasil render server tanpa pesan yang menyebut sebabnya.
 */

/**
 * PRNG mulberry32: satu kata keadaan 32-bit, periode 2^32, cukup acak untuk
 * mengisi papan dan membangkitkan kasus uji (BUKAN untuk kriptografi).
 *
 * Mengembalikan fungsi yang menghasilkan bilangan pecahan di [0, 1), sama
 * bentuknya dengan `Math.random` supaya bisa langsung menggantikannya.
 */
export function mulberry32(seed: number): () => number {
  // `>>> 0` memaksa benih menjadi bilangan tanpa tanda 32-bit: benih negatif
  // atau pecahan tetap menghasilkan deret yang sah, bukan NaN yang menular ke
  // seluruh keluaran.
  let a = Number.isFinite(seed) ? seed >>> 0 : 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // Pembagi 2^32, bukan 2^32-1, supaya 1 tidak pernah ikut terbawa — kode
    // seperti `Math.floor(acak() * n)` akan menghasilkan indeks ke-n yang tidak
    // ada kalau keluarannya bisa tepat 1.
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
