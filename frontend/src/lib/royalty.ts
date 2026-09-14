import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { realiseSale, type SaleSource } from "@/lib/royaltyLedgerCore";
import { makeTerms, parseRoyaltyTerms, type RoyaltyTerms } from "@/lib/royaltyTerms";
import type { CourseDetail } from "@/lib/courses";
import type { Order } from "@/lib/orders";

/** Syarat yang dibekukan ke pesanan baru — dari kursus, setelan, dan kode yang dipakai pembeli. */
export function termsForNewOrder(
  course: CourseDetail,
  settings: { platformFeePercent: number; referralPercent: number },
  referral: { uid: string; code: string } | null,
  now: string,
): RoyaltyTerms {
  return makeTerms(
    settings.platformFeePercent,
    course.ownerUid,
    course.contributors,
    referral ? { ...referral, percent: settings.referralPercent } : null,
    now,
  );
}

/**
 * Kode referral yang terbekukan di pesanan, atau null.
 *
 * Dipakai untuk memutuskan apakah pesanan tertunda boleh dipakai ulang: kalau
 * pembeli kini memasukkan kode lain (atau menghapusnya), pesanan lama membawa
 * perujuk yang salah dan harus diganti.
 */
export function referralCodeOf(order: Pick<Order, "royalty">): string | null {
  return parseRoyaltyTerms(order.royalty)?.referral?.code ?? null;
}

/**
 * Mencatat penjualan sebuah pesanan yang sudah dipastikan lunas oleh
 * pemanggilnya (webhook bertanda tangan, atau keputusan admin).
 *
 * `courseOwnerUid` hanya dipakai untuk pesanan dari sebelum syarat dibekukan.
 */
export function realiseOrderSale(
  order: Pick<Order, "orderId" | "courseSlug" | "courseTitle" | "amount" | "royalty">,
  opts: { paidAt: string; source: SaleSource; courseOwnerUid: string | null },
): Promise<boolean> {
  return realiseSale(adminDb(), {
    orderId: order.orderId,
    courseSlug: order.courseSlug,
    courseTitle: order.courseTitle,
    gross: order.amount,
    royalty: order.royalty,
    courseOwnerUid: opts.courseOwnerUid,
    paidAt: opts.paidAt,
    source: opts.source,
  });
}
