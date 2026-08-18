import "server-only";
import { adminDb } from "@/lib/firebase/admin";

export const ORDERS = "orders";

/**
 * Catatan satu percobaan pembayaran.
 *
 * Koleksi ini tertutup rapat dari klien (`allow read, write: if false`),
 * sama seperti `enrollments` dan `certificates` — seluruh alurnya lewat
 * Server Action dan webhook yang memakai Admin SDK.
 *
 * Kenapa pesanan dicatat terpisah, bukan langsung menulis enrollment saat
 * uangnya masuk:
 *
 * 1. QRIS itu pembayaran TARIK. Ada jeda menit-menit antara QR ditampilkan
 *    dan uang benar-benar masuk; selama jeda itu harus ada catatan bahwa
 *    transaksinya sedang berjalan.
 * 2. Webhook hanya membawa `order_id`. Tanpa dokumen ini, server tidak punya
 *    cara apa pun mengetahui siapa membeli kursus apa.
 * 3. Nominal yang datang di notifikasi TIDAK boleh dipercaya begitu saja —
 *    ia harus dibandingkan dengan yang tercatat di sini.
 */
export type OrderStatus = "pending" | "paid" | "failed" | "expired";

export interface Order {
  /** Sama dengan document ID. */
  orderId: string;

  uid: string;
  userEmail: string | null;
  userName: string | null;

  courseSlug: string;
  courseTitle: string;

  /** Rupiah penuh, dibaca dari dokumen kursus — tidak pernah dari browser. */
  amount: number;
  currency: "IDR";

  status: OrderStatus;
  /** "qris", "bank_transfer", "gopay", … diisi webhook saat pembayaran masuk. */
  paymentType: string | null;

  /**
   * Token Snap disimpan supaya pesanan yang belum kedaluwarsa bisa dipakai
   * ulang. Tanpa itu, setiap klik "Beli" membuat transaksi baru di Midtrans
   * dan meninggalkan tumpukan pesanan menggantung.
   */
  snapToken: string | null;

  /** ISO — string, supaya aman melintasi batas server->klien. */
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  updatedAt: string;

  /** Muatan notifikasi terakhir, apa adanya, untuk menelusuri masalah. */
  lastNotification: Record<string, unknown> | null;
}

export function orderRef(orderId: string) {
  return adminDb().collection(ORDERS).doc(orderId);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const doc = await orderRef(orderId).get();
  return doc.exists ? (doc.data() as Order) : null;
}

/**
 * Batas panjang `order_id` di Midtrans: 50 karakter.
 *
 * Ini bukan detail sepele. Slug kursus boleh sampai 60 karakter — misalnya
 * "pemanfaatan-ai-advance-dengan-vibe-coding-menggunakan-antigr" sudah 59 —
 * jadi menyusun id dari slug utuh PASTI melewati batas dan ditolak Midtrans
 * saat transaksi dibuat, bukan saat kode ditulis.
 */
const MAX_ORDER_ID = 50;
const SLUG_IN_ID = 20;

/**
 * ID pesanan yang bisa dibaca manusia.
 *
 * Potongan slug ikut disertakan supaya baris di dashboard Midtrans bisa
 * dikenali tanpa membuka Firestore. Keunikannya datang dari cap waktu +
 * bagian acak, bukan dari slug-nya.
 */
export function makeOrderId(courseSlug: string, uid: string): string {
  const slug = courseSlug.slice(0, SLUG_IN_ID).replace(/-+$/, "");
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);

  const id = `SYN-${slug}-${uid.slice(0, 6)}-${stamp}${rand}`;

  // Penjaga, bukan hiasan: kalau suatu saat potongan di atas diubah, kegagalan
  // harus muncul di sini — bukan sebagai penolakan Midtrans yang membingungkan.
  if (id.length > MAX_ORDER_ID) {
    throw new Error(`orderId ${id.length} karakter, melebihi batas ${MAX_ORDER_ID}.`);
  }
  return id;
}

/** Pesanan yang masih menunggu bayar dan belum lewat waktunya. */
export function isPayable(order: Order, now = new Date()): boolean {
  return order.status === "pending" && new Date(order.expiresAt) > now;
}

/**
 * Pesanan tertunda milik seorang pengguna untuk satu kursus.
 *
 * Sengaja hanya memakai penyaring kesamaan (uid, courseSlug, status) dan
 * memeriksa kedaluwarsa di kode. Menambahkan `where("expiresAt", ">", …)`
 * membuat query ini butuh composite index — dan kegagalannya baru muncul saat
 * dijalankan, bukan saat dikompilasi.
 */
export async function findPendingOrder(uid: string, courseSlug: string): Promise<Order | null> {
  const snap = await adminDb()
    .collection(ORDERS)
    .where("uid", "==", uid)
    .where("courseSlug", "==", courseSlug)
    .where("status", "==", "pending")
    .get();

  const now = new Date();
  for (const doc of snap.docs) {
    const order = doc.data() as Order;
    if (isPayable(order, now) && order.snapToken) return order;
  }
  return null;
}
