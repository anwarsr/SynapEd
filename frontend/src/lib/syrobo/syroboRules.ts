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
/**
 * Energi (kelelahan): turun 100 → 0 dalam ±`JAM_LELAH_HABIS` jam saat robot terjaga, dan pulih penuh dalam ±`JAM_TIDUR_PENUH` jam saat TIDUR
 * (tidur = lampu di Main Room dipadamkan). Di bawah `AMBANG_LELAH` robot "kelelahan"; di bawah `AMBANG_TIDUR` hatinya di dada sangat tipis dan
 * berkedip = perlu tidur. Seperti kenyang/bersih, energi tidak ditulis terus-menerus: potret + waktu (`energiAt`), dan `tidurSejak` menandai tidur.
 */
export const JAM_LELAH_HABIS = 10;
export const JAM_TIDUR_PENUH = 10 / 60;
export const AMBANG_LELAH = 35;
export const AMBANG_TIDUR = 15;
/**
 * EASTER EGG (permintaan pemilik): mengetik `KODE_CHEAT` di halaman SyRobo (sudah masuk) membuat robot berwarna EMAS selama
 * `CHEAT_MENIT` menit dan memberi `CHEAT_POIN` poin bintang. Hanya SEKALI per hari WIB (`DataSyrobo.cheatHari`). Server yang memutuskan
 * (kode dibandingkan ulang, jatah harian, waktu); klien hanya mengenali ketikannya.
 */
export const KODE_CHEAT = "KINGOLGA";
export const CHEAT_POIN = 50;
export const CHEAT_MENIT = 10;
/** Cheat kedua: sekali SEUMUR AKUN, memberi 1 buah tiap makanan dewa (stok `stokDewa`, bisa dimakan tanpa Premium). */
export const KODE_CHEAT_DEWA = "DEIDOSTUDIO";
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

/**
 * 10 MAKANAN DEWA - hanya untuk pemilik SynapEd Premium AKTIF (gratis selama premium aktif, tanpa stok & tanpa poin).
 * Memakannya mengenyangkan penuh dan MEMBEKUKAN bar kenyang selama `JAM_BEKU_DEWA` jam: tidak turun sama sekali,
 * lalu turun normal lagi sesudahnya. Selama beku, makanan dewa lain tak bisa dimakan (tak ada gunanya menumpuk).
 */
export const JAM_BEKU_DEWA = 24;
export type MakananDewaId =
  | "ambrosia"
  | "nektar"
  | "apelEmas"
  | "anggurDewa"
  | "madu"
  | "persikAbadi"
  | "nasiLangit"
  | "kueBulan"
  | "supNaga"
  | "rotiBintang";
export interface MakananDewa {
  id: MakananDewaId;
  nama: string;
  /** Kalimat pendek tentang makanannya (tampil di menu). */
  cerita: string;
}
export const MAKANAN_DEWA: readonly MakananDewa[] = [
  { id: "ambrosia", nama: "Ambrosia", cerita: "Santapan para dewa Olimpus." },
  { id: "nektar", nama: "Nektar Langit", cerita: "Manis, hangat, berpendar tipis." },
  { id: "apelEmas", nama: "Apel Emas", cerita: "Dipetik dari taman di ujung dunia." },
  { id: "anggurDewa", nama: "Anggur Dewa", cerita: "Satu tandan, seribu rasa." },
  { id: "madu", nama: "Madu Surgawi", cerita: "Dibuat lebah yang tak pernah tidur." },
  { id: "persikAbadi", nama: "Persik Abadi", cerita: "Berbuah sekali tiap tiga ribu tahun." },
  { id: "nasiLangit", nama: "Nasi Langit", cerita: "Butirnya jatuh bersama bintang." },
  { id: "kueBulan", nama: "Kue Bulan", cerita: "Dipanggang di tungku bulan purnama." },
  { id: "supNaga", nama: "Sup Naga", cerita: "Mengepul, pedas, dan agung." },
  { id: "rotiBintang", nama: "Roti Bintang", cerita: "Mengembang di antara rasi bintang." },
];
export function stokDewaKosong(): Record<MakananDewaId, number> {
  return Object.fromEntries(MAKANAN_DEWA.map((m) => [m.id, 0])) as Record<MakananDewaId, number>;
}
export function makananDewaSah(x: unknown): x is MakananDewaId {
  return typeof x === "string" && MAKANAN_DEWA.some((m) => m.id === x);
}
export function cariMakananDewa(id: MakananDewaId): MakananDewa {
  return MAKANAN_DEWA.find((m) => m.id === id) as MakananDewa;
}

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
  | "medali"
  | "topiKaisar"
  | "bajuKaisar"
  | "mahkotaRaja"
  | "jubahRaja";
export interface Pakaian {
  id: PakaianId;
  nama: string;
  slot: SlotPakaian;
  harga: number;
  /** Topi yang menutupi kepala: antena robot tersembunyi di baliknya. */
  tutupAntena: boolean;
  /** Pakaian PREMIUM: tidak dijual; terbuka & bisa dipakai gratis HANYA selama SynapEd Premium aktif. */
  premium?: boolean;
}
/** 18 pakaian biasa DIBELI di toko dengan poin, ditambah 4 pakaian PREMIUM (gratis selama premium aktif). */
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
  { id: "topiKaisar", nama: "Topi militer", slot: "kepala", harga: 0, tutupAntena: true, premium: true },
  { id: "mahkotaRaja", nama: "Mahkota raja", slot: "kepala", harga: 0, tutupAntena: true, premium: true },
  { id: "bajuKaisar", nama: "Baju militer", slot: "badan", harga: 0, tutupAntena: false, premium: true },
  { id: "jubahRaja", nama: "Jubah raja", slot: "badan", harga: 0, tutupAntena: false, premium: true },
];
export const PAKAIAN_PREMIUM: readonly PakaianId[] = PAKAIAN.filter((p) => p.premium).map((p) => p.id);
/** Ukuran pakaian (persen dari ukuran bawaannya), diatur per slot. */
export const UKURAN_MIN = 70;
export const UKURAN_MAKS = 140;
export const UKURAN_BAWAAN = 100;

/** Menggosok dengan spons: tiap segini piksel gosokan = 1 poin kebersihan; satu panggilan maksimal segini poin. */
export const GOSOK_PX_PER_POIN = 90;
export const GOSOK_MAKS_PER_PANGGILAN = 50;

/**
 * Koin game "Tanjakan Robo" bisa ditukar poin bintang SyRobo: `KOIN_PER_POIN` koin = 1 poin. Game berjalan di browser, jadi angka koin
 * TIDAK bisa dipercaya sepenuhnya; server membatasinya: tiap setoran maksimal `KOIN_SETOR_MAKS`, dan total setoran per hari (WIB)
 * maksimal `KOIN_HARIAN_MAKS` (= 15 poin/hari). Saldo koin disimpan di `koinGame`; menukar = kelipatan penuh `KOIN_PER_POIN`.
 */
export const KOIN_PER_POIN = 100;
export const KOIN_SETOR_MAKS = 300;
export const KOIN_HARIAN_MAKS = 1500;

/** Hadiah poin: `menit` = waktu aktif di situs hari ini (0 = cukup masuk hari ini). */
export const HADIAH: readonly { menit: number; poin: number }[] = [
  { menit: 0, poin: 5 },
  { menit: 5, poin: 1 },
  { menit: 10, poin: 3 },
  { menit: 20, poin: 5 },
  { menit: 30, poin: 7 },
  { menit: 60, poin: 10 },
  { menit: 120, poin: 15 },
];

/** Pemilik SynapEd Premium aktif mendapat tambahan 50% poin di setiap hadiah harian (dibulatkan ke atas). */
export const BONUS_PREMIUM_HADIAH = 0.5;
export function poinHadiah(poin: number, premium: boolean): number {
  return premium ? Math.ceil(poin * (1 + BONUS_PREMIUM_HADIAH)) : poin;
}

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
  /** Saldo koin game yang belum ditukar, dan koin yang sudah disetor hari ini (reset ganti hari WIB). */
  koinGame: number;
  koinSetorHari: number;
  /** Bar kenyang dibekukan (tak turun) sampai waktu ini - efek makanan dewa. null = tidak beku. */
  bekuLaparSampai: string | null;
  /** Makanan dewa yang terakhir dimakan: auranya menyala selama bar kenyang masih beku (24 jam). null = tak ada. */
  dewaId: MakananDewaId | null;
  /** Stok makanan dewa (dari cheat): dimakan tanpa Premium dan berkurang 1 tiap dimakan. Pemilik Premium aktif makan gratis tanpa stok. */
  stokDewa: Record<MakananDewaId, number>;
  /** Cheat makanan dewa sudah dipakai (sekali seumur akun). */
  cheatDewa: boolean;
  /** Tanggal WIB cheat terakhir dipakai (jatah sekali sehari) dan waktu emasnya berakhir. */
  cheatHari: string | null;
  emasSampai: string | null;
  /** Potret energi (0..100) pada `energiAt`; `tidurSejak` terisi selama robot tidur (lampu Main Room padam). */
  energi: number;
  energiAt: string;
  tidurSejak: string | null;
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
    koinGame: 0,
    koinSetorHari: 0,
    bekuLaparSampai: null,
    dewaId: null,
    stokDewa: stokDewaKosong(),
    cheatDewa: false,
    cheatHari: null,
    emasSampai: null,
    energi: 100,
    energiAt: now.toISOString(),
    tidurSejak: null,
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
  const punya = (Array.isArray(r.punya) ? r.punya : []).filter(pakaianSah).filter((x, i, a) => a.indexOf(x) === i && !cariPakaian(x).premium);
  const lama = typeof r.baju === "string" && pakaianSah(r.baju) ? r.baju : null;
  if (lama && !punya.includes(lama)) punya.push(lama);
  const pilih = (slot: SlotPakaian, mentah: unknown): PakaianId | null => {
    const id = pakaianSah(mentah) ? mentah : lama && cariPakaian(lama).slot === slot && r.kepala === undefined && r.badan === undefined ? lama : null;
    // Pakaian premium tak masuk `punya` (terbuka lewat keanggotaan); ia tetap tersimpan sebagai yang dipakai, dan baru
    // disembunyikan oleh `tampilkan` bila premium sedang tidak aktif.
    return id && cariPakaian(id).slot === slot && (punya.includes(id) || cariPakaian(id).premium === true) ? id : null;
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
    koinGame: Math.max(0, Math.floor(angka(r.koinGame, 0))),
    koinSetorHari: Math.max(0, Math.floor(angka(r.koinSetorHari, 0))),
    bekuLaparSampai: typeof r.bekuLaparSampai === "string" && !Number.isNaN(Date.parse(r.bekuLaparSampai)) ? r.bekuLaparSampai : null,
    dewaId: makananDewaSah(r.dewaId) ? r.dewaId : null,
    stokDewa: (() => {
      const mentah = (r.stokDewa && typeof r.stokDewa === "object" ? r.stokDewa : {}) as Record<string, unknown>;
      const st = stokDewaKosong();
      for (const m of MAKANAN_DEWA) st[m.id] = jepit(Math.floor(angka(mentah[m.id], 0)), 0, MAKANAN_MAKS_STOK);
      return st;
    })(),
    cheatDewa: r.cheatDewa === true,
    cheatHari: typeof r.cheatHari === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.cheatHari) ? r.cheatHari : null,
    emasSampai: typeof r.emasSampai === "string" && !Number.isNaN(Date.parse(r.emasSampai)) ? r.emasSampai : null,
    energi: jepit(angka(r.energi, d.energi)),
    energiAt: typeof r.energiAt === "string" && !Number.isNaN(Date.parse(r.energiAt)) ? r.energiAt : d.energiAt,
    tidurSejak: typeof r.tidurSejak === "string" && !Number.isNaN(Date.parse(r.tidurSejak)) ? r.tidurSejak : null,
  };
}

/** Ganti hari (WIB): hitungan harian mulai dari nol. */
export function gulirHari(d: DataSyrobo, now: Date): DataSyrobo {
  const hari = tanggalWib(now);
  if (d.hari === hari) return d;
  return { ...d, hari, aktifDetik: 0, detakAt: null, diklaim: [], koinSetorHari: 0 };
}

/** Kenyang & bersih SAAT INI, dihitung dari potret terakhir. */
export function kondisiSaatIni(d: DataSyrobo, now: Date): { kenyang: number; bersih: number } {
  const t0 = Date.parse(d.potretAt);
  const jam = Math.max(0, (now.getTime() - t0) / 3600_000);
  // Makanan dewa: kenyang baru mulai turun SESUDAH masa beku berakhir (bersih tetap turun seperti biasa).
  const beku = d.bekuLaparSampai ? Date.parse(d.bekuLaparSampai) : NaN;
  const mulaiLapar = Number.isFinite(beku) && beku > t0 ? beku : t0;
  const jamLapar = Math.max(0, (now.getTime() - mulaiLapar) / 3600_000);
  return {
    kenyang: jepit(d.kenyang - (jamLapar * 100) / JAM_LAPAR_HABIS),
    bersih: jepit(d.bersih - (jam * 100) / JAM_KOTOR_HABIS),
  };
}

/** Energi SAAT INI: pulih selagi tidur, turun selagi terjaga (dari potret `energiAt`). */
export function energiSaatIni(d: Pick<DataSyrobo, "energi" | "energiAt" | "tidurSejak">, now: Date): number {
  const jam = Math.max(0, (now.getTime() - Date.parse(d.energiAt)) / 3600_000);
  return d.tidurSejak ? jepit(d.energi + (jam * 100) / JAM_TIDUR_PENUH) : jepit(d.energi - (jam * 100) / JAM_LELAH_HABIS);
}

/** Potret energi baru pada `now` (dipanggil sebelum tidur/bangun mengubah laju). */
export function potretEnergi(d: DataSyrobo, now: Date): DataSyrobo {
  return { ...d, energi: energiSaatIni(d, now), energiAt: now.toISOString() };
}

/** Sisa waktu emas (ms) pada `now`; 0 bila tak sedang emas. */
export function sisaEmasMs(d: Pick<DataSyrobo, "emasSampai">, now: Date): number {
  const e = d.emasSampai ? Date.parse(d.emasSampai) : NaN;
  return Number.isFinite(e) ? Math.max(0, e - now.getTime()) : 0;
}

/** Sisa masa beku kenyang (ms) pada `now`; 0 bila tidak beku. */
export function sisaBekuMs(d: Pick<DataSyrobo, "bekuLaparSampai">, now: Date): number {
  const beku = d.bekuLaparSampai ? Date.parse(d.bekuLaparSampai) : NaN;
  return Number.isFinite(beku) ? Math.max(0, beku - now.getTime()) : 0;
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
