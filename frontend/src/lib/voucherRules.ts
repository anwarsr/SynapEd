/**
 * Aturan voucher potongan harga: bentuk data, validasi masukan admin, hitungan
 * potongan, cakupan, dan pemeriksaan "boleh dipakai atau tidak".
 *
 * Modul NETRAL (tanpa `server-only`/`"use client"`/`@/`): dipakai Server
 * Action, formulir admin di browser (pratinjau), dan `verify-voucher-rules`.
 *
 * Keputusan pemilik:
 * - Potongan DIBAGI RATA: bagi hasil (platform, educator, perujuk) dihitung
 *   dari uang yang benar-benar dibayar - jadi tidak ada rumus pembagian baru,
 *   `order.amount` cukup diisi harga SETELAH potongan.
 * - Voucher 100% boleh: harga akhir Rp0 langsung membuka akses tanpa Midtrans/
 *   QRIS (Midtrans tidak bisa memproses Rp0).
 * - Voucher boleh digabung kode referral (komisi dari uang yang dibayar).
 */

export const VOUCHERS = "vouchers";
export const VOUCHER_REDEMPTIONS = "voucherRedemptions";

/** Huruf besar, angka, "-" dan "_", 4-24 karakter, tidak diawali/diakhiri tanda baca. */
export const VOUCHER_KODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,22}[A-Z0-9]$/;
export const VOUCHER_KODE_MAKS = 24;
/**
 * Harga akhir yang bukan nol paling sedikit sekian. Midtrans menolak/ menyembunyikan
 * banyak metode untuk nominal sangat kecil, jadi potongan yang menyisakan Rp50
 * dikurangi sampai sisa Rp1.000 - kecuali voucher memang menggratiskan penuh.
 */
export const MIN_BAYAR = 1_000;
export const MAKS_NOMINAL = 10_000_000;
export const MAKS_KUOTA = 1_000_000;
export const MAKS_PER_AKUN = 100;
export const MAKS_KURSUS = 200;
export const MAKS_AKUN_KHUSUS = 200;
export const MAKS_CATATAN = 300;
/** Pembayaran voucher Rp0 - pesanan yang langsung lunas tanpa gerbang bayar. */
export const METODE_VOUCHER = "voucher";

export type JenisPotongan = "persen" | "nominal";

/** Dokumen `vouchers/{KODE}` yang sudah dinormalkan. */
export interface Voucher {
  code: string;
  /** Catatan internal admin (tidak tampil ke pembeli). */
  note: string;
  active: boolean;
  jenis: JenisPotongan;
  /** Persen 1..100, atau rupiah untuk `nominal`. */
  nilai: number;
  /** Batas rupiah potongan persen; null = tanpa batas. Diabaikan untuk `nominal`. */
  maksPotongan: number | null;
  /** Berlaku untuk pembelian SynapEd Premium. */
  premium: boolean;
  /** Berlaku untuk SEMUA kursus berbayar. */
  semuaKursus: boolean;
  /** Slug kursus tertentu. */
  kursus: string[];
  /** Slug kategori: semua kursus di kategori itu. */
  kategori: string[];
  /** ISO; null = sejak dibuat. */
  mulai: string | null;
  /** ISO; null = tanpa tanggal berakhir. */
  berakhir: string | null;
  /** Jumlah pemakaian seluruh akun; null = tanpa batas. */
  kuota: number | null;
  batasPerAkun: number;
  /** Harga NORMAL minimal (rupiah); 0 = tanpa syarat. */
  minHarga: number;
  /** Kosong = semua akun. Email disimpan untuk ditampilkan lagi di formulir. */
  khususEmail: string[];
  khususUid: string[];
  /** Hanya untuk akun yang belum pernah punya pesanan lunas. */
  pembelianPertama: boolean;
  /** Pemakaian yang sudah LUNAS (dinaikkan tepat sekali per pesanan). */
  dipakai: number;
  /** Jumlah rupiah potongan yang sudah diberikan, untuk statistik admin. */
  totalPotongan: number;
  createdAt: string;
  createdByUid: string | null;
  updatedAt: string;
}

/** Yang dibeli, dengan harga NORMAL-nya - dibaca server, tidak pernah dari browser. */
export type SasaranVoucher =
  | { kind: "premium"; price: number }
  | { kind: "course"; slug: string; category: string; price: number };

/** Potongan yang dibekukan ke pesanan pada detik yang sama dengan `amount`. */
export interface VoucherPesanan {
  code: string;
  /** Harga normal saat pesanan dibuat. */
  original: number;
  /** Rupiah potongan; `amount` pesanan = original - discount. */
  discount: number;
}

/** Yang ditampilkan kolom voucher setelah "Terapkan" (hanya pratinjau). */
export interface PratinjauVoucher {
  code: string;
  harga: number;
  potongan: number;
  akhir: number;
}

/**
 * Pratinjau dari voucher yang dibekukan di pesanan QRIS yang masih hidup
 * (amount = original - discount), supaya halaman yang dimuat ulang tetap
 * menampilkan voucher pesanan itu. Di modul netral karena dipanggil Server
 * Component - fungsi dari berkas "use client" tidak bisa dipanggil di server.
 */
export function pratinjauDariPesanan(o: { amount: number; voucher: VoucherPesanan | null } | null): PratinjauVoucher | null {
  return o?.voucher ? { code: o.voucher.code, harga: o.voucher.original, potongan: o.voucher.discount, akhir: o.amount } : null;
}

// ── Kode ──────────────────────────────────────────────────────────────────

export function normalisasiKode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().replace(/\s+/g, "") : "";
}

export function kodeSah(kode: string): boolean {
  return VOUCHER_KODE_RE.test(kode);
}

/** Kode acak 10 karakter tanpa huruf yang mudah tertukar (O/0, I/1). */
export function buatKodeAcak(awalan = ""): string {
  const ABJAD = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pilih = new Uint32Array(10);
  globalThis.crypto.getRandomValues(pilih);
  const acak = Array.from(pilih, (n) => ABJAD[n % ABJAD.length]).join("");
  return (normalisasiKode(awalan).replace(/[^A-Z0-9]/g, "").slice(0, 8) + acak).slice(0, VOUCHER_KODE_MAKS);
}

// ── Hitungan potongan ─────────────────────────────────────────────────────

/**
 * Potongan untuk harga normal `harga`. Bilangan bulat rupiah, dibulatkan KE
 * BAWAH (pembeli tidak pernah mendapat potongan lebih dari yang dijanjikan).
 * `akhir` = 0 hanya bila voucher menutup seluruh harga; selain itu `akhir`
 * paling sedikit `MIN_BAYAR` (atau harga itu sendiri bila lebih kecil).
 */
export function hitungHarga(v: Pick<Voucher, "jenis" | "nilai" | "maksPotongan">, harga: number): { potongan: number; akhir: number } {
  if (!Number.isSafeInteger(harga) || harga <= 0) return { potongan: 0, akhir: Math.max(0, harga | 0) };
  let potongan = v.jenis === "persen" ? Math.floor((harga * v.nilai) / 100) : v.nilai;
  if (v.jenis === "persen" && v.maksPotongan !== null) potongan = Math.min(potongan, v.maksPotongan);
  potongan = Math.max(0, Math.min(potongan, harga));
  let akhir = harga - potongan;
  if (akhir > 0 && akhir < MIN_BAYAR) {
    akhir = Math.min(harga, MIN_BAYAR);
    potongan = harga - akhir;
  }
  return { potongan, akhir };
}

export function cocokSasaran(v: Pick<Voucher, "premium" | "semuaKursus" | "kursus" | "kategori">, s: SasaranVoucher): boolean {
  if (s.kind === "premium") return v.premium;
  return v.semuaKursus || v.kursus.includes(s.slug) || (s.category !== "" && v.kategori.includes(s.category));
}

export type StatusVoucher = "aktif" | "nonaktif" | "terjadwal" | "berakhir" | "habis";

export const LABEL_STATUS: Record<StatusVoucher, string> = {
  aktif: "Aktif",
  nonaktif: "Nonaktif",
  terjadwal: "Terjadwal",
  berakhir: "Berakhir",
  habis: "Kuota habis",
};

/** Kotak kecil penanda status di panel admin (kelas token, bukan hex). */
export const WARNA_STATUS: Record<StatusVoucher, string> = {
  aktif: "bg-blue-500",
  terjadwal: "bg-amber-500",
  habis: "bg-white/25",
  berakhir: "bg-white/25",
  nonaktif: "bg-rust-700",
};

export function statusVoucher(v: Pick<Voucher, "active" | "mulai" | "berakhir" | "kuota" | "dipakai">, now: Date): StatusVoucher {
  const t = now.getTime();
  if (!v.active) return "nonaktif";
  if (v.mulai && Date.parse(v.mulai) > t) return "terjadwal";
  if (v.berakhir && Date.parse(v.berakhir) <= t) return "berakhir";
  if (v.kuota !== null && v.dipakai >= v.kuota) return "habis";
  return "aktif";
}

export interface KonteksPemakaian {
  now: Date;
  uid: string;
  sasaran: SasaranVoucher;
  /** Pemakaian lunas + pesanan hidup akun ini (kecuali pesanan untuk sasaran yang sama). */
  pakaiAkun: number;
  /** `dipakai` + pesanan hidup semua akun yang memakai kode ini (kecuali sasaran yang sama milik akun ini). */
  pakaiTotal: number;
  /** Akun ini sudah pernah punya pesanan lunas. */
  pernahBeli: boolean;
}

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function tanggal(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" }) + " WIB";
}

/**
 * Alasan voucher TIDAK bisa dipakai, atau null bila boleh. Urutannya dari yang
 * paling umum ke yang paling khusus, supaya pembeli mendapat alasan yang tepat
 * (voucher kedaluwarsa tidak perlu dikatakan "kuota habis").
 */
export function alasanDitolak(v: Voucher, c: KonteksPemakaian): string | null {
  const status = statusVoucher({ ...v, dipakai: 0 }, c.now);
  if (status === "nonaktif") return "Voucher ini sedang tidak aktif.";
  if (status === "terjadwal") return `Voucher ini baru berlaku mulai ${tanggal(v.mulai!)}.`;
  if (status === "berakhir") return "Masa berlaku voucher ini sudah berakhir.";
  if (v.khususUid.length > 0 && !v.khususUid.includes(c.uid)) return "Voucher ini tidak berlaku untuk akun Anda.";
  if (!cocokSasaran(v, c.sasaran)) {
    return c.sasaran.kind === "premium" ? "Voucher ini tidak berlaku untuk Premium." : "Voucher ini tidak berlaku untuk kursus ini.";
  }
  if (c.sasaran.price < v.minHarga) return `Voucher ini hanya berlaku untuk pembelian minimal ${rupiah(v.minHarga)}.`;
  if (v.pembelianPertama && c.pernahBeli) return "Voucher ini khusus pembelian pertama.";
  if (v.kuota !== null && c.pakaiTotal >= v.kuota) return "Kuota voucher ini sudah habis.";
  if (c.pakaiAkun >= v.batasPerAkun) {
    return v.batasPerAkun === 1 ? "Anda sudah memakai voucher ini." : `Anda sudah memakai voucher ini ${v.batasPerAkun} kali (batas per akun).`;
  }
  if (hitungHarga(v, c.sasaran.price).potongan <= 0) return "Voucher ini tidak memberi potongan untuk harga ini.";
  return null;
}

// ── Ringkasan untuk tampilan ──────────────────────────────────────────────

export function ringkasPotongan(v: Pick<Voucher, "jenis" | "nilai" | "maksPotongan">): string {
  if (v.jenis === "nominal") return `Potongan ${rupiah(v.nilai)}`;
  return `Potongan ${v.nilai}%${v.maksPotongan !== null ? ` (maks ${rupiah(v.maksPotongan)})` : ""}`;
}

export function ringkasCakupan(
  v: Pick<Voucher, "premium" | "semuaKursus" | "kursus" | "kategori">,
  judulKursus: Readonly<Record<string, string>> = {},
  labelKategori: Readonly<Record<string, string>> = {},
): string {
  const bagian: string[] = [];
  if (v.semuaKursus) bagian.push("semua kursus");
  else {
    if (v.kursus.length === 1) bagian.push(judulKursus[v.kursus[0]] ?? v.kursus[0]);
    else if (v.kursus.length > 1) bagian.push(`${v.kursus.length} kursus`);
    if (v.kategori.length > 0) bagian.push(`kategori ${v.kategori.map((k) => labelKategori[k] ?? k).join(", ")}`);
  }
  if (v.premium) bagian.push("Premium");
  return bagian.join(" + ") || "-";
}

// ── Masukan admin ─────────────────────────────────────────────────────────

/** Bentuk yang dikirim formulir admin. Semua dibaca ulang & divalidasi di server. */
export interface MasukanVoucher {
  code: unknown;
  note: unknown;
  active: unknown;
  jenis: unknown;
  nilai: unknown;
  maksPotongan: unknown;
  premium: unknown;
  semuaKursus: unknown;
  kursus: unknown;
  kategori: unknown;
  mulai: unknown;
  berakhir: unknown;
  kuota: unknown;
  batasPerAkun: unknown;
  minHarga: unknown;
  khususEmail: unknown;
  pembelianPertama: unknown;
}

export type VoucherBersih = Omit<Voucher, "khususUid" | "dipakai" | "totalPotongan" | "createdAt" | "createdByUid" | "updatedAt">;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bulat(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) ? raw : null;
}

/** Bilangan bulat opsional: null/""/undefined = kosong, selain itu harus bulat. */
function opsional(raw: unknown): number | null | "salah" {
  if (raw === null || raw === undefined || raw === "") return null;
  return bulat(raw) ?? "salah";
}

function daftarTeks(raw: unknown, maks: number, rapikan: (s: string) => string): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const hasil = [...new Set(raw.filter((x): x is string => typeof x === "string").map(rapikan).filter(Boolean))];
  return hasil.length > maks ? null : hasil;
}

function iso(raw: unknown): string | null | "salah" {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return "salah";
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : "salah";
}

/**
 * Masukan admin -> voucher bersih, atau pesan galat pertama. `baru` = sedang
 * membuat (tanggal berakhir yang sudah lewat ditolak; saat menyunting justru
 * boleh, itu cara menutup voucher lebih awal).
 */
export function validasiVoucher(m: MasukanVoucher, now: Date, baru: boolean): { ok: true; data: VoucherBersih } | { ok: false; error: string } {
  const gagal = (error: string) => ({ ok: false as const, error });

  const code = normalisasiKode(m.code);
  if (!kodeSah(code)) return gagal("Kode voucher 4-24 karakter: huruf, angka, - atau _, diawali dan diakhiri huruf/angka.");

  const jenis: JenisPotongan | null = m.jenis === "persen" || m.jenis === "nominal" ? m.jenis : null;
  if (!jenis) return gagal("Pilih jenis potongan.");
  const nilai = bulat(m.nilai);
  if (jenis === "persen" && (nilai === null || nilai < 1 || nilai > 100)) return gagal("Potongan persen harus bilangan bulat 1 sampai 100.");
  if (jenis === "nominal" && (nilai === null || nilai < 1 || nilai > MAKS_NOMINAL)) {
    return gagal(`Potongan rupiah harus bilangan bulat 1 sampai ${rupiah(MAKS_NOMINAL)}.`);
  }

  const maks = jenis === "persen" ? opsional(m.maksPotongan) : null;
  if (maks === "salah" || (maks !== null && (maks < 1 || maks > MAKS_NOMINAL))) return gagal("Batas potongan harus kosong atau bilangan bulat rupiah positif.");

  const premium = m.premium === true;
  const semuaKursus = m.semuaKursus === true;
  const kursus = semuaKursus ? [] : daftarTeks(m.kursus, MAKS_KURSUS, (s) => s.trim());
  const kategori = semuaKursus ? [] : daftarTeks(m.kategori, 100, (s) => s.trim());
  if (kursus === null) return gagal(`Paling banyak ${MAKS_KURSUS} kursus per voucher.`);
  if (kategori === null) return gagal("Daftar kategori tidak sah.");
  if (!premium && !semuaKursus && kursus.length === 0 && kategori.length === 0) {
    return gagal("Pilih minimal satu cakupan: Premium, semua kursus, kursus tertentu, atau kategori.");
  }

  const mulai = iso(m.mulai);
  const berakhir = iso(m.berakhir);
  if (mulai === "salah" || berakhir === "salah") return gagal("Tanggal berlaku tidak sah.");
  if (mulai && berakhir && Date.parse(berakhir) <= Date.parse(mulai)) return gagal("Tanggal berakhir harus sesudah tanggal mulai.");
  if (baru && berakhir && Date.parse(berakhir) <= now.getTime()) return gagal("Tanggal berakhir sudah lewat.");

  const kuota = opsional(m.kuota);
  if (kuota === "salah" || (kuota !== null && (kuota < 1 || kuota > MAKS_KUOTA))) return gagal("Kuota harus kosong (tanpa batas) atau bilangan bulat positif.");
  const batasPerAkun = bulat(m.batasPerAkun);
  if (batasPerAkun === null || batasPerAkun < 1 || batasPerAkun > MAKS_PER_AKUN) return gagal(`Batas per akun harus 1 sampai ${MAKS_PER_AKUN}.`);
  const minHarga = opsional(m.minHarga);
  if (minHarga === "salah" || (minHarga !== null && (minHarga < 0 || minHarga > MAKS_NOMINAL))) return gagal("Minimal pembelian harus bilangan bulat rupiah.");

  const khususEmail = daftarTeks(m.khususEmail, MAKS_AKUN_KHUSUS, (s) => s.trim().toLowerCase());
  if (khususEmail === null) return gagal(`Paling banyak ${MAKS_AKUN_KHUSUS} akun khusus.`);
  const salahEmail = khususEmail.find((e) => !EMAIL_RE.test(e));
  if (salahEmail) return gagal(`Email tidak sah: ${salahEmail}`);

  return {
    ok: true,
    data: {
      code,
      note: typeof m.note === "string" ? m.note.trim().slice(0, MAKS_CATATAN) : "",
      active: m.active !== false,
      jenis,
      nilai: nilai!,
      maksPotongan: maks,
      premium,
      semuaKursus,
      kursus,
      kategori,
      mulai,
      berakhir,
      kuota,
      batasPerAkun,
      minHarga: minHarga ?? 0,
      khususEmail,
      pembelianPertama: m.pembelianPertama === true,
    },
  };
}

// ── Normaliser baca ───────────────────────────────────────────────────────

const teks = (x: unknown) => (typeof x === "string" ? x : "");
const isoAtauNull = (x: unknown) => (typeof x === "string" && Number.isFinite(Date.parse(x)) ? x : null);
const angka = (x: unknown, bawaan: number) => (typeof x === "number" && Number.isFinite(x) ? x : bawaan);
const daftar = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

/**
 * Dokumen mentah -> Voucher. Nilai rusak menjadi "tidak memberi apa-apa"
 * (nilai 0, nonaktif), bukan ditebak - voucher rusak tidak boleh diam-diam
 * menjadi potongan 100%.
 */
export function parseVoucher(raw: unknown, id: string): Voucher {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const jenis: JenisPotongan = d.jenis === "nominal" ? "nominal" : "persen";
  const nilaiMentah = bulat(d.nilai);
  const nilaiSah = nilaiMentah !== null && nilaiMentah >= 1 && (jenis === "nominal" ? nilaiMentah <= MAKS_NOMINAL : nilaiMentah <= 100);
  const maks = bulat(d.maksPotongan);
  const kuota = bulat(d.kuota);
  return {
    code: id,
    note: teks(d.note),
    active: d.active === true && nilaiSah,
    jenis,
    nilai: nilaiSah ? nilaiMentah! : 0,
    maksPotongan: maks !== null && maks > 0 ? maks : null,
    premium: d.premium === true,
    semuaKursus: d.semuaKursus === true,
    kursus: daftar(d.kursus),
    kategori: daftar(d.kategori),
    mulai: isoAtauNull(d.mulai),
    berakhir: isoAtauNull(d.berakhir),
    kuota: kuota !== null && kuota > 0 ? kuota : null,
    batasPerAkun: Math.max(1, bulat(d.batasPerAkun) ?? 1),
    minHarga: Math.max(0, bulat(d.minHarga) ?? 0),
    khususEmail: daftar(d.khususEmail),
    khususUid: daftar(d.khususUid),
    pembelianPertama: d.pembelianPertama === true,
    dipakai: Math.max(0, angka(d.dipakai, 0)),
    totalPotongan: Math.max(0, angka(d.totalPotongan, 0)),
    createdAt: teks(d.createdAt),
    createdByUid: typeof d.createdByUid === "string" ? d.createdByUid : null,
    updatedAt: teks(d.updatedAt),
  };
}

/** Potongan tersimpan di pesanan, atau null (pesanan tanpa voucher / bentuk rusak). */
export function parseVoucherPesanan(raw: unknown): VoucherPesanan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const code = normalisasiKode(r.code);
  const original = bulat(r.original);
  const discount = bulat(r.discount);
  if (!kodeSah(code) || original === null || discount === null || discount < 0 || discount > original) return null;
  return { code, original, discount };
}
