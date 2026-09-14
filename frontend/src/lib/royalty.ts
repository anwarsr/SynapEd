import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { realiseSale, type SaleSource } from "@/lib/royaltyLedgerCore";
import { makeTerms, type RoyaltyTerms } from "@/lib/royaltyTerms";
import type { CourseDetail } from "@/lib/courses";
import type { Order } from "@/lib/orders";

/** Syarat yang dibekukan ke pesanan baru — dari kursus dan setelan saat ini. */
export function termsForNewOrder(course: CourseDetail, feePercent: number, now: string): RoyaltyTerms {
  return makeTerms(feePercent, course.ownerUid, course.contributors, now);
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
