/**
 * Aturan SynapEd Premium: masa aktif, harga, dan pembagian hasil.
 *
 * Modul NETRAL tanpa impor alias: dipakai server (pesanan, webhook, pembagian),
 * komponen klien (tampilan sisa hari), dan skrip `settle-premium`/verifikasi.
 *
 * Premium = akses ke semua kursus PUBLIK BERBAYAR selama periode 30 hari.
 * Membeli lagi saat masih aktif menumpuk 30 hari di belakang tanggal berakhir.
 *
 * Bagi hasil (keputusan pemilik): uang satu periode, setelah potongan platform,
 * dibagi ke kursus berbayar yang benar-benar dipelajari pengguna itu SELAMA
 * periodenya, sebanding dengan jumlah pelajaran yang ia selesaikan. Bagian tiap
 * kursus lalu dibagi ke pemilik & kontributornya dengan `splitSale` yang sama
 * dengan penjualan kursus biasa - satu rumus pembagian uang di seluruh proyek.
 */
import type { Contributor } from "./contributors";
import { referralAmountOf, splitSale } from "./royaltySplit";
import { normalizeReferralCode, validateReferralCode } from "./referralRules";
import { parseFeePercent, type ReferralTerms } from "./royaltyTerms";

export const PREMIUM_HARI = 30;
export const DEFAULT_PREMIUM_PRICE = 50_000;
export const PREMIUM_HARGA_MIN = 10_000;
export const PREMIUM_HARGA_MAKS = 5_000_000;
/** Pemberian admin paling lama sekali beri. */
export const PREMIUM_HARI_ADMIN_MAKS = 365;
/** Spanduk pengingat muncul bila sisa masa aktif ≤ sekian hari. */
export const PREMIUM_PENGINGAT_HARI = 5;
/** `courseSlug` pesanan premium (koleksi `orders` dipakai bersama pesanan kursus). */
export const PREMIUM_SLUG = "premium";
export const PREMIUM_JUDUL = "SynapEd Premium 30 hari";

const HARI_MS = 86_400_000;

/**
 * Angka penawaran untuk materi promosi: berapa kursus yang terbuka dan berapa
 * total harganya kalau dibeli satu per satu. Hanya kursus PUBLIK BERBAYAR -
 * cakupan yang sama dengan `enrollPremium`, jadi janji di layar = yang didapat.
 */
export function ringkasPenawaran(
  kursus: readonly { price: number; visibility?: string }[],
): { jumlah: number; totalSatuan: number } {
  const cakupan = kursus.filter((k) => k.price > 0 && k.visibility !== "private");
  return { jumlah: cakupan.length, totalSatuan: cakupan.reduce((n, k) => n + k.price, 0) };
}

export function validasiHargaPremium(raw: unknown): string | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return "Harga premium harus bilangan bulat rupiah.";
  if (raw < PREMIUM_HARGA_MIN) return `Harga premium minimal Rp${PREMIUM_HARGA_MIN.toLocaleString("id-ID")}.`;
  if (raw > PREMIUM_HARGA_MAKS) return `Harga premium maksimal Rp${PREMIUM_HARGA_MAKS.toLocaleString("id-ID")}.`;
  return null;
}

/** Harga tersimpan yang sah, atau null (pemanggil jatuh ke bawaan). */
export function parseHargaPremium(raw: unknown): number | null {
  return validasiHargaPremium(raw) === null ? (raw as number) : null;
}

// ── Masa aktif ───────────────────────────────────────────────────────────

/**
 * Periode baru: mulai SEKARANG bila premium sudah habis / belum pernah ada,
 * atau mulai tepat di tanggal berakhir bila masih aktif (ditumpuk, tidak ada
 * hari yang hilang karena membeli lebih awal).
 */
export function perpanjang(activeUntil: string | null, now: Date, hari = PREMIUM_HARI): { start: string; end: string } {
  const sekarang = now.getTime();
  const akhir = activeUntil ? Date.parse(activeUntil) : NaN;
  const mulai = Number.isFinite(akhir) && akhir > sekarang ? akhir : sekarang;
  return { start: new Date(mulai).toISOString(), end: new Date(mulai + hari * HARI_MS).toISOString() };
}

export function premiumAktif(activeUntil: string | null, now: Date): boolean {
  if (!activeUntil) return false;
  const t = Date.parse(activeUntil);
  return Number.isFinite(t) && t > now.getTime();
}

/** Sisa hari dibulatkan ke atas (sisa 2 jam = "1 hari lagi"); 0 bila tidak aktif. */
export function sisaHari(activeUntil: string | null, now: Date): number {
  if (!premiumAktif(activeUntil, now)) return 0;
  return Math.ceil((Date.parse(activeUntil!) - now.getTime()) / HARI_MS);
}

// ── Syarat yang dibekukan di pesanan premium ─────────────────────────────

/**
 * Pesanan premium tidak punya pemilik kursus: yang dibekukan hanya potongan
 * platform dan perujuk. Pembagian ke educator ditentukan PEMAKAIAN, bukan
 * pesanan - jadi baru dihitung saat periodenya berakhir.
 */
export interface PremiumTerms {
  feePercent: number;
  referral: ReferralTerms | null;
  capturedAt: string;
}

export function makePremiumTerms(feePercent: number, referral: ReferralTerms | null, capturedAt: string): PremiumTerms {
  return { feePercent, referral: referral ? { uid: referral.uid, code: referral.code, percent: referral.percent } : null, capturedAt };
}

/** Syarat tersimpan yang sah, atau null (bentuk rusak - dicatat belum teralokasi, bukan ditebak). */
export function parsePremiumTerms(raw: unknown): PremiumTerms | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const feePercent = parseFeePercent(r.feePercent);
  if (feePercent === null) return null;
  let referral: ReferralTerms | null = null;
  if (r.referral !== null && r.referral !== undefined) {
    if (typeof r.referral !== "object") return null;
    const x = r.referral as Record<string, unknown>;
    const uid = typeof x.uid === "string" && x.uid ? x.uid : null;
    const code = normalizeReferralCode(x.code);
    const percent = parseFeePercent(x.percent);
    if (!uid || validateReferralCode(code) !== null || percent === null || percent > feePercent) return null;
    referral = { uid, code, percent };
  }
  return { feePercent, referral, capturedAt: typeof r.capturedAt === "string" ? r.capturedAt : "" };
}

// ── Pembagian hasil ──────────────────────────────────────────────────────

/**
 * Membagi `total` rupiah sebanding `bobot`, tepat Σ = total.
 *
 * Metode sisa terbesar, sama dengan `splitSale`: tiap bagian dibulatkan ke
 * bawah dulu, lalu rupiah sisanya diberikan satu per satu ke pecahan terbesar;
 * seri dimenangkan urutan lebih awal.
 */
export function bagiProporsional(total: number, bobot: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error(`bagiProporsional: total tidak sah (${total}).`);
  if (bobot.some((b) => !Number.isSafeInteger(b) || b < 0)) throw new Error("bagiProporsional: bobot tidak sah.");
  const jumlah = bobot.reduce((n, b) => n + b, 0);
  if (jumlah <= 0) throw new Error("bagiProporsional: jumlah bobot nol.");

  const baris = bobot.map((b, i) => ({ i, base: Math.floor((total * b) / jumlah), sisa: (total * b) % jumlah }));
  let lebih = total - baris.reduce((n, b) => n + b.base, 0);
  const tambah = new Set<number>();
  for (const b of [...baris].sort((a, c) => c.sisa - a.sisa || a.i - c.i)) {
    if (lebih <= 0) break;
    tambah.add(b.i);
    lebih--;
  }
  return baris.map((b) => b.base + (tambah.has(b.i) ? 1 : 0));
}

/** Pemakaian satu kursus dalam satu periode premium (snapshot dibekukan di pemakaian pertama). */
export interface PemakaianKursus {
  courseSlug: string;
  courseTitle: string;
  lessons: number;
  ownerUid: string | null;
  contributors: Contributor[];
}

export interface BarisPendapatanPremium {
  uid: string;
  courseSlug: string;
  courseTitle: string;
  role: "owner" | "contributor";
  sharePercent: number;
  /** Bagian kursus ini dari pool periode (dasar pembagian pemilik/kontributor). */
  courseAmount: number;
  amount: number;
}

export interface RencanaPembagianPremium {
  gross: number;
  feePercent: number;
  /** Seluruh potongan platform, TERMASUK bagian referral. */
  feeAmount: number;
  referralAmount: number;
  referrerUid: string | null;
  /** Yang tersisa untuk platform: potongan − referral (+ pool bila tak ada pemakaian). */
  platformAmount: number;
  /** Bagian bersih yang dibagi ke kursus. */
  pool: number;
  /** Bagian kursus tanpa pemilik, atau seluruh periode bila syaratnya rusak - ditinjau admin. */
  unallocatedAmount: number;
  perKursus: { courseSlug: string; courseTitle: string; lessons: number; amount: number }[];
  lines: BarisPendapatanPremium[];
  termsValid: boolean;
}

/**
 * Murni: berapa yang diterima siapa dari satu periode premium.
 *
 * - Potongan platform dibulatkan ke bawah (sisa ke educator), referral DIAMBIL
 *   DARI potongan itu - persis seperti penjualan kursus.
 * - Pool = gross − potongan, dibagi ke kursus ∝ pelajaran yang diselesaikan.
 * - Tanpa pemakaian sama sekali → pool menjadi milik platform.
 * - Syarat rusak → seluruh gross belum teralokasi (dicatat untuk admin).
 *
 * Invarian: platform + referral + Σ pendapatan + belum teralokasi = gross.
 */
export function rencanakanPembagian(gross: number, termsRaw: unknown, pemakaian: readonly PemakaianKursus[]): RencanaPembagianPremium {
  if (!Number.isSafeInteger(gross) || gross < 0) throw new Error(`rencanakanPembagian: gross tidak sah (${gross}).`);
  const terms = parsePremiumTerms(termsRaw);

  if (!terms) {
    return {
      gross,
      feePercent: 0,
      feeAmount: 0,
      referralAmount: 0,
      referrerUid: null,
      platformAmount: 0,
      pool: 0,
      unallocatedAmount: gross,
      perKursus: [],
      lines: [],
      termsValid: false,
    };
  }

  const feeAmount = Math.floor((gross * terms.feePercent) / 100);
  const referralAmount = terms.referral ? referralAmountOf(gross, feeAmount, terms.referral.percent) : 0;
  const pool = gross - feeAmount;

  // Urutan tetap (slug) supaya hasil pembagian sama berapa kali pun dihitung.
  const dipakai = pemakaian.filter((p) => p.lessons > 0).sort((a, b) => a.courseSlug.localeCompare(b.courseSlug));

  let platformAmount = feeAmount - referralAmount;
  let unallocatedAmount = 0;
  const perKursus: RencanaPembagianPremium["perKursus"] = [];
  const lines: BarisPendapatanPremium[] = [];

  if (dipakai.length === 0 || pool === 0) {
    platformAmount += pool;
  } else {
    const bagian = bagiProporsional(pool, dipakai.map((p) => p.lessons));
    dipakai.forEach((p, i) => {
      const amount = bagian[i];
      perKursus.push({ courseSlug: p.courseSlug, courseTitle: p.courseTitle, lessons: p.lessons, amount });
      const split = splitSale(amount, 0, p.ownerUid ? p.contributors : null);
      unallocatedAmount += split.unallocatedAmount;
      for (const l of split.lines) {
        if (l.amount <= 0) continue;
        lines.push({ uid: l.uid, courseSlug: p.courseSlug, courseTitle: p.courseTitle, role: l.role, sharePercent: l.share, courseAmount: amount, amount: l.amount });
      }
    });
  }

  const jumlah = platformAmount + referralAmount + unallocatedAmount + lines.reduce((n, l) => n + l.amount, 0);
  if (jumlah !== gross) throw new Error(`rencanakanPembagian: invarian gagal, ${jumlah} != ${gross}.`);

  return {
    gross,
    feePercent: terms.feePercent,
    feeAmount,
    referralAmount,
    referrerUid: terms.referral?.uid ?? null,
    platformAmount,
    pool,
    unallocatedAmount,
    perKursus,
    lines,
    termsValid: true,
  };
}
