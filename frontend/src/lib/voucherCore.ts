/**
 * Pencatat pemakaian voucher - TEPAT SEKALI per pesanan.
 *
 * Tanpa `server-only` dan tanpa impor alias: `db` disuntikkan supaya skrip
 * verifikasi menjalankan kode yang SAMA PERSIS dengan webhook dan keputusan
 * admin (pola `royaltyLedgerCore.ts` / `premiumCore.ts`).
 *
 * TIDAK MEMERIKSA SIAPA PEMANGGILNYA - karena itu tidak tinggal di berkas
 * "use server". Pemanggilnya (webhook bertanda tangan, keputusan admin, klaim
 * voucher gratis yang memeriksa sesi) yang menjamin pemanggilan itu sah.
 *
 *   voucherRedemptions/{orderId}  satu pemakaian (ID = pesanan → idempoten)
 *   vouchers/{KODE}.dipakai       dinaikkan di transaksi yang sama
 */
import type { Firestore } from "firebase-admin/firestore";
import { VOUCHERS, VOUCHER_REDEMPTIONS, type VoucherPesanan } from "./voucherRules";

export interface PemakaianVoucherDoc {
  orderId: string;
  code: string;
  uid: string;
  userName: string | null;
  kind: "course" | "premium";
  courseSlug: string;
  courseTitle: string;
  original: number;
  discount: number;
  /** Yang benar-benar dibayar (0 untuk voucher gratis). */
  paid: number;
  method: string;
  at: string;
}

export interface CatatPemakaianInput {
  orderId: string;
  uid: string;
  userName: string | null;
  kind: "course" | "premium";
  courseSlug: string;
  courseTitle: string;
  voucher: VoucherPesanan;
  method: string;
  at: string;
}

/**
 * Mencatat satu pemakaian. true = baru dicatat, false = sudah pernah (retry
 * webhook, setujui ganda, klaim ganda). Hitungan `dipakai` dibaca-lalu-ditulis
 * DI DALAM transaksi, bukan `FieldValue.increment`: skrip memuat firebase-admin
 * dari node_modules yang berbeda dengan aplikasi, dan sentinel dari instans
 * lain ditolak Firestore.
 *
 * Voucher yang sudah dihapus tetap dicatat pemakaiannya (pembeli sudah
 * membayar harga potongan) - hanya hitungannya yang tak bisa dinaikkan.
 */
export async function catatPemakaianVoucher(db: Firestore, p: CatatPemakaianInput): Promise<boolean> {
  const ref = db.collection(VOUCHER_REDEMPTIONS).doc(p.orderId);
  const vRef = db.collection(VOUCHERS).doc(p.voucher.code);

  return db.runTransaction(async (tx) => {
    const [ada, v] = await Promise.all([tx.get(ref), tx.get(vRef)]);
    if (ada.exists) return false;

    const doc: PemakaianVoucherDoc = {
      orderId: p.orderId,
      code: p.voucher.code,
      uid: p.uid,
      userName: p.userName,
      kind: p.kind,
      courseSlug: p.courseSlug,
      courseTitle: p.courseTitle,
      original: p.voucher.original,
      discount: p.voucher.discount,
      paid: p.voucher.original - p.voucher.discount,
      method: p.method,
      at: p.at,
    };
    tx.create(ref, doc);

    if (v.exists) {
      const d = v.data()!;
      const dipakai = typeof d.dipakai === "number" ? d.dipakai : 0;
      const total = typeof d.totalPotongan === "number" ? d.totalPotongan : 0;
      tx.update(vRef, { dipakai: dipakai + 1, totalPotongan: total + p.voucher.discount });
    }
    return true;
  });
}
