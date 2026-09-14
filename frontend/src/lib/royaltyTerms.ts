/**
 * Syarat bagi hasil yang DIBEKUKAN ke sebuah pesanan saat pesanan dibuat.
 *
 * Modul NETRAL tanpa impor alias: dipakai server (membuat pesanan, mencatat
 * penjualan) dan skrip backfill.
 *
 * Kenapa dibekukan saat pesanan dibuat, bukan dibaca dari kursus saat uangnya
 * masuk: pesanan QRIS bisa menunggu ditinjau sampai sehari, dan kursus bisa
 * diubah pembagiannya — atau dihapus — di tengah penantian itu. Pembeli
 * membayar harga yang dibekukan; pembagiannya ikut dibekukan pada detik yang
 * sama, supaya perubahan yang disetujui kemudian hanya berlaku ke depan.
 * Kode referral yang dipakai pembeli ikut dibekukan dengan alasan yang sama.
 */
import { parseStoredContributors, type Contributor } from "./contributors";
import { normalizeReferralCode, validateReferralCode } from "./referralRules";

export const DEFAULT_PLATFORM_FEE_PERCENT = 30;
export const DEFAULT_REFERRAL_PERCENT = 10;

export interface ReferralTerms {
  /** Pemilik kode — penerima bagian referral. */
  uid: string;
  code: string;
  /** Persentase dari harga kotor, diambil dari potongan platform. */
  percent: number;
}

export interface RoyaltyTerms {
  /** Potongan platform, bilangan bulat 0..100. Bagian referral diambil dari sini. */
  feePercent: number;
  /** null = kursus tanpa pemilik; seluruh bagian bersih belum teralokasi. */
  ownerUid: string | null;
  contributors: Contributor[];
  /** null = pembelian tanpa kode referral. */
  referral: ReferralTerms | null;
  capturedAt: string;
}

/** Bilangan bulat 0..100, atau null. */
export function parseFeePercent(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 100 ? raw : null;
}

/**
 * Pasangan potongan & referral yang sah: keduanya 0..100 dan referral TIDAK
 * PERNAH melebihi potongan — bagian perujuk dibayar dari potongan platform,
 * jadi referral yang lebih besar berarti platform membayar dari kantong
 * kontributor.
 */
export function validateRevenueSplit(feePercent: unknown, referralPercent: unknown): string | null {
  const fee = parseFeePercent(feePercent);
  const ref = parseFeePercent(referralPercent);
  if (fee === null) return "Potongan platform harus bilangan bulat antara 0 dan 100.";
  if (ref === null) return "Bagian referral harus bilangan bulat antara 0 dan 100.";
  if (ref > fee) return "Bagian referral tidak boleh lebih besar dari potongan platform.";
  return null;
}

export function makeTerms(
  feePercent: number,
  ownerUid: string | null,
  contributors: readonly Contributor[],
  referral: ReferralTerms | null,
  capturedAt: string,
): RoyaltyTerms {
  return {
    feePercent,
    ownerUid,
    contributors: contributors.map((c) => ({ uid: c.uid, share: c.share })),
    referral: referral ? { uid: referral.uid, code: referral.code, percent: referral.percent } : null,
    capturedAt,
  };
}

function parseReferral(raw: unknown, feePercent: number): ReferralTerms | null | "invalid" {
  // Pesanan yang dibuat sebelum referral ada tidak punya field ini sama sekali.
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") return "invalid";

  const r = raw as Record<string, unknown>;
  const uid = typeof r.uid === "string" && r.uid ? r.uid : null;
  const code = normalizeReferralCode(r.code);
  const percent = parseFeePercent(r.percent);

  if (!uid || validateReferralCode(code) !== null || percent === null || percent > feePercent) return "invalid";
  return { uid, code, percent };
}

/**
 * Membaca syarat yang tersimpan di pesanan. null = bentuknya tidak sah.
 *
 * Pemanggil membedakan "tidak ada" (pesanan dari sebelum fitur ini) dari
 * "ada tapi rusak" — keduanya diperlakukan berbeda di buku royalti.
 */
export function parseRoyaltyTerms(raw: unknown): RoyaltyTerms | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const feePercent = parseFeePercent(r.feePercent);
  if (feePercent === null) return null;

  const ownerUid = typeof r.ownerUid === "string" && r.ownerUid ? r.ownerUid : null;
  if (r.ownerUid !== null && ownerUid === null) return null;

  let contributors: Contributor[];
  if (ownerUid === null) {
    if (!Array.isArray(r.contributors) || r.contributors.length !== 0) return null;
    contributors = [];
  } else {
    const parsed = parseStoredContributors(r.contributors, ownerUid);
    if (!parsed) return null;
    contributors = parsed;
  }

  const referral = parseReferral(r.referral, feePercent);
  if (referral === "invalid") return null;

  const capturedAt = typeof r.capturedAt === "string" ? r.capturedAt : "";
  return { feePercent, ownerUid, contributors, referral, capturedAt };
}
