/**
 * Aturan kode referral.
 *
 * Modul NETRAL — tanpa `server-only`, tanpa `use client`, tanpa impor alias —
 * karena dipakai form di browser, server, `proxy.ts`, dan skrip verifikasi.
 */

export const REFERRAL_CODE_MIN = 4;
export const REFERRAL_CODE_MAX = 20;

/** Nama cookie yang menyimpan kode dari tautan `?ref=`. */
export const REFERRAL_COOKIE = "synaped_ref";
/** Berapa lama kode dari tautan diingat sebelum pembeli memutuskan membeli. */
export const REFERRAL_COOKIE_DAYS = 30;
/** Nama parameter di tautan bagikan: `/courses/{slug}?ref=KODE`. */
export const REFERRAL_PARAM = "ref";

/**
 * Kode yang tidak boleh dipakai siapa pun: menyamar sebagai kode resmi
 * platform ("SYNAPED", "PROMO") membuat pembeli mengira sedang memakai
 * potongan resmi, padahal uangnya mengalir ke orang lain.
 */
export const RESERVED_REFERRAL_CODES: ReadonlySet<string> = new Set([
  "SYNAPED",
  "SYNAP",
  "ADMIN",
  "OFFICIAL",
  "RESMI",
  "PROMO",
  "DISKON",
  "GRATIS",
  "FREE",
  "TEST",
  "NULL",
  "UNDEFINED",
]);

/** Buang spasi, jadikan huruf besar. BUKAN validasi. */
export function normalizeReferralCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

/** Pesan galat berbahasa Indonesia, atau null bila sah. */
export function validateReferralCode(code: string): string | null {
  if (code.length < REFERRAL_CODE_MIN) return `Kode referral minimal ${REFERRAL_CODE_MIN} karakter.`;
  if (code.length > REFERRAL_CODE_MAX) return `Kode referral maksimal ${REFERRAL_CODE_MAX} karakter.`;
  if (!/^[A-Z0-9]+$/.test(code)) return "Kode referral hanya boleh berisi huruf dan angka.";
  if (!/[A-Z]/.test(code)) return "Kode referral harus memuat setidaknya satu huruf.";
  if (RESERVED_REFERRAL_CODES.has(code)) return "Kode ini tidak tersedia.";
  return null;
}

/** Usulan kode dari username, mis. `budi.santoso` -> `BUDISANTOSO`. */
export function suggestReferralCode(username: string | null | undefined): string {
  const dasar = (username ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, REFERRAL_CODE_MAX);
  return validateReferralCode(dasar) === null ? dasar : "";
}
