import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import {
  DEFAULT_PLATFORM_FEE_PERCENT,
  DEFAULT_REFERRAL_PERCENT,
  parseFeePercent,
  validateRevenueSplit,
} from "@/lib/royaltyTerms";

export const SETTINGS = "settings";
export const PAYMENTS_DOC = "payments";

/**
 * Saklar metode pembayaran, dikelola admin dari panel.
 *
 * Koleksi setelan pertama di proyek ini. Disimpan di Firestore, bukan di
 * variabel lingkungan, karena pemiliknya harus bisa mematikan satu metode
 * saat itu juga — mis. QRIS bermasalah di jam ramai — tanpa menunggu deploy
 * berjalan.
 *
 * Kunci Midtrans TETAP di variabel lingkungan. Yang di sini hanya "boleh
 * dipakai atau tidak"; rahasianya tidak pernah masuk Firestore.
 */
export interface PaymentSettings {
  midtransEnabled: boolean;
  manualQrisEnabled: boolean;
  /** Path Storage gambar QRIS, mis. `payment-qris/qris.png`. */
  qrisImagePath: string | null;
  /** Keterangan tambahan yang dibaca pembeli, mis. nama merchant. */
  qrisNote: string;
  /**
   * Potongan platform dari setiap penjualan, bilangan bulat 0..100.
   * Dibekukan ke setiap pesanan saat dibuat, jadi mengubahnya hanya berlaku
   * untuk pesanan berikutnya.
   */
  platformFeePercent: number;
  /**
   * Bagian perujuk dari harga kotor, diambil DARI potongan platform.
   * Tidak pernah lebih besar dari `platformFeePercent`.
   */
  referralPercent: number;
  updatedAt: string | null;
  updatedByUid: string | null;
}

/**
 * Nilai bawaan saat dokumennya belum ada.
 *
 * Midtrans menyala, manual mati. Dipilih begitu supaya perilaku situs TIDAK
 * berubah pada deploy pertama setelah fitur ini masuk: yang sudah jalan tetap
 * jalan, dan yang baru hanya hidup setelah pemiliknya benar-benar menyiapkan
 * gambar QRIS dan menyalakannya sendiri.
 */
const DEFAULTS: PaymentSettings = {
  midtransEnabled: true,
  manualQrisEnabled: false,
  qrisImagePath: null,
  qrisNote: "",
  platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
  referralPercent: DEFAULT_REFERRAL_PERCENT,
  updatedAt: null,
  updatedByUid: null,
};

/**
 * Potongan & referral dibaca SEBAGAI PASANGAN.
 *
 * Kalau salah satunya rusak — atau referral lebih besar dari potongan, mis.
 * disunting lewat Console — keduanya jatuh ke bawaan. Membetulkan satu angka
 * saja bisa menghasilkan pasangan yang tetap tidak sah.
 */
function revenueSplitOf(fee: unknown, referral: unknown) {
  const f = parseFeePercent(fee) ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const r = parseFeePercent(referral) ?? DEFAULT_REFERRAL_PERCENT;
  return validateRevenueSplit(f, r) === null
    ? { platformFeePercent: f, referralPercent: r }
    : { platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT, referralPercent: DEFAULT_REFERRAL_PERCENT };
}

export function paymentSettingsRef() {
  return adminDb().collection(SETTINGS).doc(PAYMENTS_DOC);
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const snap = await paymentSettingsRef().get();
  const d = snap.data();
  if (!d) return { ...DEFAULTS };

  return {
    // `!== false` dan bukan `=== true`: field yang belum pernah ditulis harus
    // mengikuti bawaannya, bukan dianggap mati.
    midtransEnabled: d.midtransEnabled !== false,
    manualQrisEnabled: d.manualQrisEnabled === true,
    qrisImagePath: (d.qrisImagePath as string | null | undefined) ?? null,
    qrisNote: (d.qrisNote as string | undefined) ?? "",
    // Nilai rusak jatuh ke bawaan, bukan ke 0 — potongan nol yang tak sengaja
    // tidak akan terlihat sampai laporan bulanan.
    ...revenueSplitOf(d.platformFeePercent, d.referralPercent),
    updatedAt: (d.updatedAt as string | null | undefined) ?? null,
    updatedByUid: (d.updatedByUid as string | null | undefined) ?? null,
  };
}

/**
 * Jalur manual benar-benar siap dipakai pembeli?
 *
 * Menyala saja tidak cukup — tanpa gambar QRIS, pembeli disodori halaman yang
 * menyuruh membayar tanpa memberitahu ke mana. Dipakai baik oleh penjaga di
 * server maupun oleh halaman kursus, supaya keduanya tidak bisa berbeda
 * pendapat.
 */
export function manualQrisReady(s: PaymentSettings): boolean {
  return s.manualQrisEnabled && Boolean(s.qrisImagePath);
}
