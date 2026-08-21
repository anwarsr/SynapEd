/**
 * Durasi sebagai angka + satuan, bukan teks bebas.
 *
 * Dulu kolomnya teks bebas, dan hasilnya persis seperti yang bisa diduga:
 * "1 Tahun", "10 Hari", "30 Menit", "12" tanpa satuan, dan "Tugas" tanpa angka
 * sama sekali. Nilai seperti itu tidak bisa diurutkan, dibandingkan, maupun
 * dijumlahkan — dan "12" tampil di kartu katalog sebagai angka telanjang yang
 * tidak berarti apa-apa.
 *
 * Modul ini NETRAL — tanpa "use client" maupun "server-only" — karena dipakai
 * form di browser sekaligus validator di server.
 *
 * Bentuk yang disimpan tetap string `"{angka} {Satuan}"`. Sengaja tidak diubah
 * menjadi objek: seluruh tampilan (kartu, halaman detail, sidebar belajar)
 * sudah merender `duration` apa adanya, dan mengubah bentuk simpanannya berarti
 * menyentuh semuanya sekaligus tanpa manfaat tambahan.
 */

export const COURSE_UNITS = ["Jam", "Hari", "Minggu", "Bulan"] as const;
export const LESSON_UNITS = ["Detik", "Menit", "Jam"] as const;

export type CourseUnit = (typeof COURSE_UNITS)[number];
export type LessonUnit = (typeof LESSON_UNITS)[number];
export type DurationScope = "course" | "lesson";

export const DEFAULT_UNIT: Record<DurationScope, string> = {
  course: "Jam",
  lesson: "Menit",
};

export function unitsFor(scope: DurationScope): readonly string[] {
  return scope === "course" ? COURSE_UNITS : LESSON_UNITS;
}

export interface ParsedDuration {
  /** Kosong berarti educator belum mengisi angkanya. */
  value: string;
  unit: string;
}

/**
 * Setiap satuan yang pernah ditulis, dinyatakan dalam detik.
 *
 * Detik dipakai sebagai perantara supaya satuan yang tidak ditawarkan bisa
 * DIHITUNG ulang, bukan sekadar ditukar labelnya. Versi pertama modul ini
 * menukar label saja, dan itu membuat "90 Menit" pada durasi kursus — yang
 * pilihannya berhenti di Jam — menjadi "90 Jam": meleset enam puluh kali lipat,
 * tanpa satu pun tanda bahwa ada yang salah.
 *
 * Bulan diambil 30 hari dan Tahun 12 bulan. Keduanya hampiran, dan memang
 * pantas: ini perkiraan lama belajar, bukan penanggalan.
 */
const DETIK: Record<string, number> = {
  Detik: 1,
  Menit: 60,
  Jam: 3600,
  Hari: 86400,
  Minggu: 604800,
  Bulan: 2592000,
  Tahun: 31104000,
};

/** Tulisan apa adanya dari educator -> nama satuan baku. */
const ALIAS: Record<string, string> = {
  detik: "Detik", dtk: "Detik",
  menit: "Menit", mnt: "Menit",
  jam: "Jam",
  hari: "Hari", hr: "Hari",
  minggu: "Minggu", pekan: "Minggu",
  bulan: "Bulan", bln: "Bulan",
  tahun: "Tahun", thn: "Tahun",
};

/**
 * Menyetarakan nilai ke satuan yang tersedia di lingkup ini.
 *
 * Satuan yang memang ditawarkan dibiarkan apa adanya — tanpa perkalian, tanpa
 * pembulatan — supaya "10 Hari" tetap persis "10 Hari". Yang di luar daftar
 * dihitung lewat detik, lalu diambil satuan TERBESAR yang masih menghasilkan
 * angka minimal 1, agar hasilnya terbaca wajar ("1 Tahun" -> "12 Bulan",
 * bukan "8640 Jam").
 */
function setarakan(nilai: number, unit: string, scope: DurationScope): ParsedDuration {
  const tersedia = unitsFor(scope);
  if (tersedia.includes(unit)) return { value: String(nilai), unit };

  const detik = nilai * DETIK[unit];

  // Dari yang terbesar ke terkecil; DETIK menentukan urutannya, bukan urutan
  // penulisan COURSE_UNITS/LESSON_UNITS.
  const urut = [...tersedia].sort((a, b) => DETIK[b] - DETIK[a]);

  for (const kandidat of urut) {
    const angka = detik / DETIK[kandidat];
    if (angka >= 1) return { value: String(Math.round(angka)), unit: kandidat };
  }

  // Lebih kecil dari satuan terkecil yang ditawarkan — mis. "30 Menit" pada
  // durasi kursus. Dibulatkan ke 1, tidak pernah ke 0: nol berarti "kosong",
  // dan itu menghapus keterangan yang sebenarnya ada.
  const terkecil = urut[urut.length - 1];
  return { value: "1", unit: terkecil };
}

/**
 * Membaca nilai lama menjadi angka + satuan.
 *
 * Dibuat sangat pemaaf karena data yang ada memang beragam:
 *   "10 Hari"  -> { 10, Hari }    satuan tersedia, dibiarkan
 *   "1 Tahun"  -> { 12, Bulan }   dihitung ulang lewat detik
 *   "12"       -> { 12, satuan bawaan }
 *   "Tugas"    -> { "", satuan bawaan }   angka dikosongkan, bukan dikarang
 *   "—" / ""   -> { "", satuan bawaan }
 */
export function parseDuration(raw: string | null | undefined, scope: DurationScope): ParsedDuration {
  const fallback = DEFAULT_UNIT[scope];
  const text = (raw ?? "").trim();

  if (!text || text === "—" || text === "-") return { value: "", unit: fallback };

  const match = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ]*)\s*$/);
  if (!match) return { value: "", unit: fallback };

  const nilai = Number(match[1].replace(",", "."));
  const satuanMentah = match[2].toLowerCase();

  // Tanpa satuan — mis. "12". Angkanya dipercaya, satuannya diisi bawaan
  // lingkup ini; menebak satuan lain sama saja mengarang.
  if (!satuanMentah) return { value: String(nilai), unit: fallback };

  const unit = ALIAS[satuanMentah];
  if (!unit) return { value: String(nilai), unit: fallback };

  return setarakan(nilai, unit, scope);
}

/**
 * Menyusun kembali menjadi bentuk simpanan.
 *
 * Angka kosong menghasilkan string kosong, BUKAN "0 Menit" — pemanggilnya yang
 * memutuskan apa arti kosong (biasanya menjadi "—").
 */
export function formatDuration(value: string, unit: string): string {
  const angka = value.trim();
  if (!angka) return "";

  const n = Number(angka);
  if (!Number.isFinite(n) || n <= 0) return "";

  return `${n} ${unit}`;
}

/** Nilai lama -> bentuk baku. Dipakai skrip konversi dan validator server. */
export function canonicalDuration(raw: string | null | undefined, scope: DurationScope): string {
  const { value, unit } = parseDuration(raw, scope);
  return formatDuration(value, unit);
}
