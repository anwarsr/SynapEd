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
 */
import { parseStoredContributors, type Contributor } from "./contributors";

export const DEFAULT_PLATFORM_FEE_PERCENT = 20;

export interface RoyaltyTerms {
  /** Potongan platform, bilangan bulat 0..100. */
  feePercent: number;
  /** null = kursus tanpa pemilik; seluruh bagian bersih belum teralokasi. */
  ownerUid: string | null;
  contributors: Contributor[];
  capturedAt: string;
}

/** Bilangan bulat 0..100, atau null. */
export function parseFeePercent(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 100 ? raw : null;
}

export function makeTerms(
  feePercent: number,
  ownerUid: string | null,
  contributors: readonly Contributor[],
  capturedAt: string,
): RoyaltyTerms {
  return {
    feePercent,
    ownerUid,
    contributors: contributors.map((c) => ({ uid: c.uid, share: c.share })),
    capturedAt,
  };
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

  const capturedAt = typeof r.capturedAt === "string" ? r.capturedAt : "";
  return { feePercent, ownerUid, contributors, capturedAt };
}
