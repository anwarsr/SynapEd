/**
 * Aturan SyRobo (hewan peliharaan robot) - NETRAL: tanpa `server-only`, tanpa impor `@/`, dipakai server, klien,
 * dan skrip uji. Semua angka permainan ada di sini supaya satu sumber.
 *
 * Prinsip: kondisi (kenyang/bersih) TIDAK disimpan terus-menerus melainkan dihitung dari potret terakhir + waktu,
 * jadi robot "lapar sendiri" tanpa ada yang menulis ke database. Poin hanya bertambah lewat klaim yang diperiksa
 * server (waktu aktif diukur server lewat detak), tidak pernah dari angka kiriman browser.
 */

export const NAMA_BAWAAN = "SyRobo";
export const NAMA_MAKS = 20;

/** Kenyang turun 100 → 0 dalam ±14 jam; bersih dalam ±20 jam. */
export const JAM_LAPAR_HABIS = 14;
export const JAM_KOTOR_HABIS = 20;
/** Di bawah ambang ini robot dianggap lapar / kotor (ekspresi & indikator berubah). */
export const AMBANG_LAPAR = 35;
export const AMBANG_KOTOR = 35;
/** Makan membuat robot sedikit kotor. */
export const KOTOR_SAAT_MAKAN = 8;

export type MakananId = "roti" | "nasi" | "burger" | "pizza";
export interface Makanan {
  id: MakananId;
  nama: string;
  harga: number;
  /** Tambahan kenyang (0..100). */
  isi: number;
}
export const MAKANAN: readonly Makanan[] = [
  { id: "roti", nama: "Roti", harga: 10, isi: 25 },
  { id: "nasi", nama: "Nasi goreng", harga: 20, isi: 45 },
  { id: "burger", nama: "Burger", harga: 35, isi: 70 },
  { id: "pizza", nama: "Pizza", harga: 50, isi: 100 },
];
export const MAKANAN_MAKS_STOK = 20;

/** Pakaian menempati SLOT: satu di kepala, satu di badan (bisa dipakai bersamaan). */
export type SlotPakaian = "kepala" | "badan";
export type PakaianId =
  | "topi"
  | "mahkota"
  | "kacamata"
  | "penyihir"
  | "koki"
  | "headphone"
  | "dasi"
  | "jubah"
  | "rompi"
  | "syal"
  | "celemek"
  | "kupluk"
  | "jerami"
  | "pesta"
  | "jaket"
  | "kemeja"
  | "ransel"
  | "medali";
export interface Pakaian {
  id: PakaianId;
  nama: string;
  slot: SlotPakaian;
  harga: number;
  /** Topi yang menutupi kepala: antena robot tersembunyi di baliknya. */
  tutupAntena: boolean;
}
/** Semua pakaian DIBELI di toko dengan poin (18 buah: 9 untuk kepala, 9 untuk badan). */
export const PAKAIAN: readonly Pakaian[] = [
  { id: "topi", nama: "Topi baseball", slot: "kepala", harga: 40, tutupAntena: true },
  { id: "mahkota", nama: "Mahkota", slot: "kepala", harga: 120, tutupAntena: true },
  { id: "kacamata", nama: "Kacamata", slot: "kepala", harga: 30, tutupAntena: false },
  { id: "penyihir", nama: "Topi penyihir", slot: "kepala", harga: 90, tutupAntena: true },
  { id: "koki", nama: "Topi koki", slot: "kepala", harga: 60, tutupAntena: true },
  { id: "headphone", nama: "Headphone", slot: "kepala", harga: 70, tutupAntena: false },
  { id: "dasi", nama: "Dasi kupu-kupu", slot: "badan", harga: 35, tutupAntena: false },
  { id: "jubah", nama: "Jubah", slot: "badan", harga: 100, tutupAntena: false },
  { id: "rompi", nama: "Rompi", slot: "badan", harga: 60, tutupAntena: false },
  { id: "syal", nama: "Syal", slot: "badan", harga: 45, tutupAntena: false },
  { id: "celemek", nama: "Celemek", slot: "badan", harga: 50, tutupAntena: false },
  { id: "kupluk", nama: "Kupluk", slot: "kepala", harga: 45, tutupAntena: true },
  { id: "jerami", nama: "Topi jerami", slot: "kepala", harga: 55, tutupAntena: true },
  { id: "pesta", nama: "Topi pesta", slot: "kepala", harga: 40, tutupAntena: true },
  { id: "jaket", nama: "Jaket", slot: "badan", harga: 85, tutupAntena: false },
  { id: "kemeja", nama: "Kemeja", slot: "badan", harga: 70, tutupAntena: false },
  { id: "ransel", nama: "Ransel", slot: "badan", harga: 75, tutupAntena: false },
  { id: "medali", nama: "Medali", slot: "badan", harga: 90, tutupAntena: false },
];
/** Ukuran pakaian (persen dari ukuran bawaannya), diatur per slot. */
export const UKURAN_MIN = 70;
export const UKURAN_MAKS = 140;
export const UKURAN_BAWAAN = 100;

/** Menggosok dengan spons: tiap segini piksel gosokan = 1 poin kebersihan; satu panggilan maksimal segini poin. */
export const GOSOK_PX_PER_POIN = 90;
export const GOSOK_MAKS_PER_PANGGILAN = 50;

/** Hadiah poin: `menit` = waktu aktif di situs hari ini (0 = cukup masuk hari ini). */
export const HADIAH: readonly { menit: number; poin: number }[] = [
  { menit: 0, poin: 20 },
  { menit: 1, poin: 5 },
  { menit: 10, poin: 10 },
  { menit: 20, poin: 15 },
  { menit: 30, poin: 25 },
  { menit: 60, poin: 40 },
  { menit: 120, poin: 70 },
];

/** Detak: server menambah waktu aktif paling banyak segini per detak, dan mengabaikan detak yang terlalu rapat. */
export const DETAK_MAKS_DETIK = 45;
export const DETAK_MIN_DETIK = 10;
/** Klien mengirim detak tiap segini (ms) selama tab terlihat. */
export const DETAK_KLIEN_MS = 20_000;

export interface DataSyrobo {
  nama: string;
  /** Pakaian yang sedang dipakai per slot (null = kosong). */
  kepala: PakaianId | null;
  badan: PakaianId | null;
  /** Pakaian yang sudah dibeli. */
  punya: PakaianId[];
  ukuran: Record<SlotPakaian, number>;
  /** Potret kenyang & bersih pada `potretAt`. */
  kenyang: number;
  bersih: number;
  potretAt: string;
  poin: number;
  stok: Record<MakananId, number>;
  /** Tanggal WIB (YYYY-MM-DD) hitungan harian di bawah berlaku. */
  hari: string;
  aktifDetik: number;
  detakAt: string | null;
  diklaim: number[];
}

export function tanggalWib(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

const jepit = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const angka = (n: unknown, bawaan: number) => (typeof n === "number" && Number.isFinite(n) ? n : bawaan);

export function pakaianSah(x: unknown): x is PakaianId {
  return typeof x === "string" && PAKAIAN.some((b) => b.id === x);
}
export function slotSah(x: unknown): x is SlotPakaian {
  return x === "kepala" || x === "badan";
}
export function cariPakaian(id: PakaianId): Pakaian {
  return PAKAIAN.find((b) => b.id === id) as Pakaian;
}
export function ukuranSah(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= UKURAN_MIN && x <= UKURAN_MAKS;
}
export function makananSah(x: unknown): x is MakananId {
  return typeof x === "string" && MAKANAN.some((m) => m.id === x);
}
export function cariMakanan(id: MakananId): Makanan {
  return MAKANAN.find((m) => m.id === id) as Makanan;
}

/** Nama robot: spasi dirapikan, karakter kontrol dibuang, 1..NAMA_MAKS. null = tidak sah. */
export function namaSah(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  if (t.length < 1 || [...t].length > NAMA_MAKS) return null;
  return t;
}

export function dataBaru(now: Date): DataSyrobo {
  return {
    nama: NAMA_BAWAAN,
    kepala: null,
    badan: null,
    punya: [],
    ukuran: { kepala: UKURAN_BAWAAN, badan: UKURAN_BAWAAN },
    kenyang: 80,
    bersih: 90,
    potretAt: now.toISOString(),
    poin: 0,
    stok: { roti: 1, nasi: 0, burger: 0, pizza: 0 },
    hari: tanggalWib(now),
    aktifDetik: 0,
    detakAt: null,
    diklaim: [],
  };
}

/** Normaliser pembacaan: data lama/rusak jatuh ke nilai bawaan, bukan `as DataSyrobo`. */
export function normalisasi(raw: unknown, now: Date): DataSyrobo {
  const d = dataBaru(now);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const stokRaw = (r.stok && typeof r.stok === "object" ? r.stok : {}) as Record<string, unknown>;
  const stok = { ...d.stok };
  for (const m of MAKANAN) stok[m.id] = jepit(Math.floor(angka(stokRaw[m.id], d.stok[m.id])), 0, MAKANAN_MAKS_STOK);
  // Pakaian: yang dipakai harus sudah dimiliki dan cocok dengan slotnya. Data lama menyimpan SATU `baju`; itu dipindah ke slot yang
  // sesuai dan dianggap sudah dimiliki (pemilik lama sudah memakainya gratis).
  const punya = (Array.isArray(r.punya) ? r.punya : []).filter(pakaianSah).filter((x, i, a) => a.indexOf(x) === i);
  const lama = typeof r.baju === "string" && pakaianSah(r.baju) ? r.baju : null;
  if (lama && !punya.includes(lama)) punya.push(lama);
  const pilih = (slot: SlotPakaian, mentah: unknown): PakaianId | null => {
    const id = pakaianSah(mentah) ? mentah : lama && cariPakaian(lama).slot === slot && r.kepala === undefined && r.badan === undefined ? lama : null;
    return id && cariPakaian(id).slot === slot && punya.includes(id) ? id : null;
  };
  const kepala = pilih("kepala", r.kepala);
  const badan = pilih("badan", r.badan);
  const ukRaw = (r.ukuran && typeof r.ukuran === "object" ? r.ukuran : {}) as Record<string, unknown>;
  const ukuranDari = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(UKURAN_MAKS, Math.max(UKURAN_MIN, Math.round(v))) : UKURAN_BAWAAN);

  return {
    nama: namaSah(r.nama) ?? d.nama,
    kepala,
    badan,
    punya,
    ukuran: { kepala: ukuranDari(ukRaw.kepala), badan: ukuranDari(ukRaw.badan) },
    kenyang: jepit(angka(r.kenyang, d.kenyang)),
    bersih: jepit(angka(r.bersih, d.bersih)),
    potretAt: typeof r.potretAt === "string" && !Number.isNaN(Date.parse(r.potretAt)) ? r.potretAt : d.potretAt,
    poin: Math.max(0, Math.floor(angka(r.poin, 0))),
    stok,
    hari: typeof r.hari === "string" ? r.hari : d.hari,
    aktifDetik: Math.max(0, Math.floor(angka(r.aktifDetik, 0))),
    detakAt: typeof r.detakAt === "string" ? r.detakAt : null,
    diklaim: Array.isArray(r.diklaim)
      ? r.diklaim.filter((x): x is number => typeof x === "number" && HADIAH.some((h) => h.menit === x))
      : [],
  };
}

/** Ganti hari (WIB): hitungan harian mulai dari nol. */
export function gulirHari(d: DataSyrobo, now: Date): DataSyrobo {
  const hari = tanggalWib(now);
  if (d.hari === hari) return d;
  return { ...d, hari, aktifDetik: 0, detakAt: null, diklaim: [] };
}

/** Kenyang & bersih SAAT INI, dihitung dari potret terakhir. */
export function kondisiSaatIni(d: DataSyrobo, now: Date): { kenyang: number; bersih: number } {
  const jam = Math.max(0, (now.getTime() - Date.parse(d.potretAt)) / 3600_000);
  return {
    kenyang: jepit(d.kenyang - (jam * 100) / JAM_LAPAR_HABIS),
    bersih: jepit(d.bersih - (jam * 100) / JAM_KOTOR_HABIS),
  };
}

/** Potret baru dari kondisi saat ini (dipanggil sebelum mengubah salah satunya). */
export function potret(d: DataSyrobo, now: Date): DataSyrobo {
  const k = kondisiSaatIni(d, now);
  return { ...d, kenyang: k.kenyang, bersih: k.bersih, potretAt: now.toISOString() };
}

export type Suasana = "senang" | "lapar" | "kotor" | "lapar-kotor";

export function suasana(k: { kenyang: number; bersih: number }): Suasana {
  const lapar = k.kenyang < AMBANG_LAPAR;
  const kotor = k.bersih < AMBANG_KOTOR;
  if (lapar && kotor) return "lapar-kotor";
  if (lapar) return "lapar";
  if (kotor) return "kotor";
  return "senang";
}

/** Tambah waktu aktif dari satu detak. Detak yang terlalu rapat diabaikan; kenaikan dibatasi. */
export function terapkanDetak(d: DataSyrobo, now: Date): DataSyrobo {
  const ts = now.getTime();
  const sebelum = d.detakAt ? Date.parse(d.detakAt) : null;
  if (sebelum === null || Number.isNaN(sebelum) || sebelum > ts) return { ...d, detakAt: now.toISOString() };
  const selisih = (ts - sebelum) / 1000;
  if (selisih < DETAK_MIN_DETIK) return d;
  return {
    ...d,
    aktifDetik: d.aktifDetik + Math.min(DETAK_MAKS_DETIK, Math.floor(selisih)),
    detakAt: now.toISOString(),
  };
}

/** Hadiah yang sudah boleh diklaim (waktu cukup, belum diklaim). */
export function bisaDiklaim(d: DataSyrobo, menit: number): boolean {
  const h = HADIAH.find((x) => x.menit === menit);
  return Boolean(h) && !d.diklaim.includes(menit) && d.aktifDetik >= menit * 60;
}
