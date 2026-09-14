/**
 * Buku royalti: satu penjualan -> satu catatan penjualan + satu catatan
 * pendapatan per penerima.
 *
 * Tanpa `server-only` dan tanpa impor alias: `db` disuntikkan, supaya skrip
 * backfill menjalankan kode yang SAMA PERSIS dengan webhook. Aplikasi
 * memakainya lewat `royalty.ts` yang ber-`server-only`.
 *
 * Fungsi di sini TIDAK MEMERIKSA SIAPA PEMANGGILNYA. Karena itu ia sengaja
 * tidak tinggal di berkas "use server" — setiap ekspor berkas semacam itu
 * adalah endpoint publik, dan satu POST mentah akan cukup untuk mencatat
 * pendapatan palsu. Preseden yang sama dengan `writeEnrollment`.
 *
 * Buku ini TIDAK PERNAH membaca status pesanan. Pemanggilnya yang memutuskan
 * sebuah pesanan lunas; di sini hanya dicatat apa yang dijual dan dibagi.
 */
import type { Firestore } from "firebase-admin/firestore";
import { splitSale, type SplitLine } from "./royaltySplit";
import { parseRoyaltyTerms } from "./royaltyTerms";
import type { Contributor } from "./contributors";

export const ROYALTY_SALES = "royaltySales";
export const ROYALTY_EARNINGS = "royaltyEarnings";

export type SaleSource = "midtrans" | "manual" | "backfill";

/**
 * - `order`   — syarat dibekukan di pesanan, dipakai apa adanya.
 * - `legacy`  — pesanan dari sebelum fitur ini: 100% pemilik, tanpa potongan.
 * - `invalid` — syaratnya ada tapi rusak: seluruhnya dicatat belum teralokasi
 *               untuk diperiksa admin, bukan ditebak.
 */
export type TermsOrigin = "order" | "legacy" | "invalid";

export interface SaleInput {
  orderId: string;
  courseSlug: string;
  courseTitle: string;
  /** Rupiah yang benar-benar dibayar — `order.amount`. */
  gross: number;
  /** `order.royalty` apa adanya, belum dibaca. */
  royalty: unknown;
  /** Pemilik kursus saat ini — hanya dipakai untuk pesanan warisan. */
  courseOwnerUid: string | null;
  paidAt: string;
  source: SaleSource;
}

export interface RoyaltySaleDoc {
  courseSlug: string;
  courseTitle: string;
  ownerUid: string | null;
  gross: number;
  feePercent: number;
  feeAmount: number;
  unallocatedAmount: number;
  lines: SplitLine[];
  termsOrigin: TermsOrigin;
  source: SaleSource;
  saleAt: string;
  recordedAt: string;
}

export interface RoyaltyEarningDoc {
  uid: string;
  courseSlug: string;
  courseTitle: string;
  role: SplitLine["role"];
  sharePercent: number;
  feePercent: number;
  gross: number;
  amount: number;
  saleAt: string;
  source: SaleSource;
}

/** Murni: menghitung apa yang akan ditulis. Melempar bila nominalnya tidak sah. */
export function planSale(input: SaleInput, recordedAt: string) {
  let origin: TermsOrigin;
  let feePercent: number;
  let ownerUid: string | null;
  let contributors: Contributor[] | null;

  if (input.royalty === undefined || input.royalty === null) {
    origin = "legacy";
    feePercent = 0;
    ownerUid = input.courseOwnerUid;
    contributors = ownerUid ? [{ uid: ownerUid, share: 100 }] : [];
  } else {
    const terms = parseRoyaltyTerms(input.royalty);
    if (terms) {
      origin = "order";
      feePercent = terms.feePercent;
      ownerUid = terms.ownerUid;
      contributors = terms.contributors;
    } else {
      origin = "invalid";
      feePercent = 0;
      ownerUid = null;
      contributors = null;
    }
  }

  const split = splitSale(input.gross, feePercent, contributors);

  const sale: RoyaltySaleDoc = {
    courseSlug: input.courseSlug,
    courseTitle: input.courseTitle,
    ownerUid,
    gross: input.gross,
    feePercent,
    feeAmount: split.feeAmount,
    unallocatedAmount: split.unallocatedAmount,
    lines: split.lines,
    termsOrigin: origin,
    source: input.source,
    saleAt: input.paidAt,
    recordedAt,
  };

  const earnings = split.lines.map((l) => ({
    id: `${input.orderId}_${l.uid}`,
    doc: {
      uid: l.uid,
      courseSlug: input.courseSlug,
      courseTitle: input.courseTitle,
      role: l.role,
      sharePercent: l.share,
      feePercent,
      gross: input.gross,
      amount: l.amount,
      saleAt: input.paidAt,
      source: input.source,
    } satisfies RoyaltyEarningDoc,
  }));

  return { sale, earnings };
}

/**
 * Mencatat satu penjualan — tepat sekali, berapa kali pun dipanggil.
 *
 * Retry Midtrans, notifikasi yang tiba bersamaan, dan klik "setujui" ganda
 * semuanya berakhir di satu catatan penjualan dan satu set pendapatan:
 * transaksi membaca `royaltySales/{orderId}` lebih dulu, dan kalau sudah ada,
 * tidak menulis apa pun. Penjualan dan seluruh pendapatannya dikomit
 * BERSAMA — tidak pernah ada penjualan tanpa pendapatan, atau sebaliknya.
 *
 * Pembagian dihitung di LUAR transaksi: kalau invariannya gagal, tidak ada
 * apa pun yang sempat ditulis.
 *
 * @returns true bila penjualan baru dicatat, false bila sudah ada.
 */
export async function realiseSale(db: Firestore, input: SaleInput): Promise<boolean> {
  const { sale, earnings } = planSale(input, new Date().toISOString());
  const saleRef = db.collection(ROYALTY_SALES).doc(input.orderId);

  try {
    return await db.runTransaction(async (tx) => {
      const ada = await tx.get(saleRef);
      if (ada.exists) return false;

      tx.create(saleRef, sale);
      for (const e of earnings) tx.create(db.collection(ROYALTY_EARNINGS).doc(e.id), e.doc);
      return true;
    });
  } catch (err) {
    // ALREADY_EXISTS: pemanggil lain mengomit penjualan yang sama tepat di
    // antara baca dan komit transaksi ini. Hasil akhirnya tetap satu.
    if ((err as { code?: unknown }).code === 6) return false;
    throw err;
  }
}
