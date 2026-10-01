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
/**
 * `awaiting_review` hanya dipakai jalur QRIS manual: pembeli sudah mengunggah
 * bukti, tetapi belum ada yang memastikan uangnya benar-benar masuk. Ia
 * SENGAJA berbeda dari `paid` — akses baru terbuka setelah admin memutuskan.
 */
export type OrderStatus = "pending" | "awaiting_review" | "paid" | "failed" | "expired";

/**
 * Lewat mana pesanan ini dibayar.
 *
 * - `midtrans` — otomatis, akses diberikan webhook bertanda tangan.
 * - `manual`   — QRIS Pedagang Bima, akses diberikan admin setelah mencocokkan
 *                dengan mutasi di aplikasi bank.
 */
export type OrderMethod = "midtrans" | "manual";

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
  method: OrderMethod;
  /** "qris", "bank_transfer", "gopay", … diisi webhook saat pembayaran masuk. */
  paymentType: string | null;

  /**
   * Token Snap disimpan supaya pesanan yang belum kedaluwarsa bisa dipakai
   * ulang. Tanpa itu, setiap klik "Beli" membuat transaksi baru di Midtrans
   * dan meninggalkan tumpukan pesanan menggantung.
   */
  snapToken: string | null;

  // ── Khusus jalur manual ───────────────────────────────────────────────
  /** Path Storage bukti bayar. Tidak pernah URL publik — lihat storage.rules. */
  proofPath: string | null;
  /** Catatan opsional dari pembeli, mis. jam transfer. */
  payerNote: string | null;
  reviewedAt: string | null;
  reviewedByUid: string | null;
  reviewedByName: string | null;
  /** Alasan penolakan, atau catatan admin saat menyetujui. */
  reviewNote: string | null;

  /** ISO — string, supaya aman melintasi batas server->klien. */
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  updatedAt: string;

  /** Muatan notifikasi terakhir, apa adanya, untuk menelusuri masalah. */
  lastNotification: Record<string, unknown> | null;

  /**
   * Notifikasi gagal/kedaluwarsa yang datang SETELAH pesanan lunas — refund,
   * chargeback, atau sekadar datang tidak berurutan. Statusnya tetap `paid`;
   * ini hanya penanda supaya admin menindaklanjutinya secara manual.
   */
  postPaidStatus: OrderStatus | null;
  /** `transaction_status` mentah dari Midtrans, mis. "deny" atau "refund". */
  postPaidTransactionStatus: string | null;
  postPaidAt: string | null;

  /**
   * Syarat bagi hasil yang dibekukan saat pesanan dibuat — MENTAH, dibaca
   * lewat `parseRoyaltyTerms`. `null` pada pesanan dari sebelum fitur royalti.
   *
   * Sengaja `unknown`, bukan `RoyaltyTerms | null`: menormalkan syarat rusak
   * menjadi null di sini akan membuatnya tak bisa dibedakan dari pesanan lama,
   * dan pesanan lama dibagi 100% ke pemilik tanpa potongan.
   */
  royalty: unknown;
}

/**
 * Dokumen mentah -> Order dengan seluruh field terisi.
 *
 * Pesanan yang dibuat SEBELUM jalur manual ada tidak punya `method` maupun
 * field tinjauan. Membacanya dengan `as Order` begitu saja membuat field-field
 * itu `undefined` padahal tipenya bilang tidak boleh — dan yang pertama
 * tersandung biasanya perbandingan `order.method === "manual"` yang diam-diam
 * selalu salah.
 */
function toOrder(d: FirebaseFirestore.DocumentData): Order {
  return {
    orderId: (d.orderId as string | undefined) ?? "",
    uid: (d.uid as string | undefined) ?? "",
    userEmail: (d.userEmail as string | null | undefined) ?? null,
    userName: (d.userName as string | null | undefined) ?? null,
    courseSlug: (d.courseSlug as string | undefined) ?? "",
    courseTitle: (d.courseTitle as string | undefined) ?? "",
    amount: typeof d.amount === "number" ? d.amount : 0,
    currency: "IDR",
    status: (d.status as OrderStatus | undefined) ?? "pending",
    // Tanpa `method` berarti pesanan lama, dan waktu itu hanya ada Midtrans.
    method: d.method === "manual" ? "manual" : "midtrans",
    paymentType: (d.paymentType as string | null | undefined) ?? null,
    snapToken: (d.snapToken as string | null | undefined) ?? null,
    proofPath: (d.proofPath as string | null | undefined) ?? null,
    payerNote: (d.payerNote as string | null | undefined) ?? null,
    reviewedAt: (d.reviewedAt as string | null | undefined) ?? null,
    reviewedByUid: (d.reviewedByUid as string | null | undefined) ?? null,
    reviewedByName: (d.reviewedByName as string | null | undefined) ?? null,
    reviewNote: (d.reviewNote as string | null | undefined) ?? null,
    createdAt: (d.createdAt as string | undefined) ?? "",
    expiresAt: (d.expiresAt as string | undefined) ?? "",
    paidAt: (d.paidAt as string | null | undefined) ?? null,
    updatedAt: (d.updatedAt as string | undefined) ?? "",
    lastNotification: (d.lastNotification as Record<string, unknown> | null | undefined) ?? null,
    postPaidStatus: (d.postPaidStatus as OrderStatus | null | undefined) ?? null,
    postPaidTransactionStatus: (d.postPaidTransactionStatus as string | null | undefined) ?? null,
    postPaidAt: (d.postPaidAt as string | null | undefined) ?? null,
    royalty: d.royalty ?? null,
  };
}

export function orderRef(orderId: string) {
  return adminDb().collection(ORDERS).doc(orderId);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const doc = await orderRef(orderId).get();
  const data = doc.data();
  return data ? toOrder(data) : null;
}

export interface NotificationUpdate {
  status: OrderStatus;
  transactionStatus: string;
  paymentType: string | null;
  payload: Record<string, unknown>;
  now: string;
}

/**
 * Menerapkan satu notifikasi Midtrans ke pesanan, dalam transaksi.
 *
 * Aturan satu-satunya: begitu `paid`, status TIDAK PERNAH turun. Notifikasi
 * bisa datang tidak berurutan (expire yang tertahan di antrean retry tiba
 * sesudah settlement), dan refund/chargeback juga datang lewat jalur ini.
 * Menimpa `paid` berarti pesanan yang uangnya sudah masuk tampak gagal —
 * dan apa pun yang dihitung dari status itu ikut hilang diam-diam.
 *
 * Kabar buruk sesudah lunas dicatat di `postPaidStatus` untuk ditinjau admin.
 * `pending` yang terlambat bukan kabar apa-apa, jadi tidak mencatat apa pun.
 *
 * Transaksi, bukan baca-lalu-tulis biasa: dua notifikasi yang tiba bersamaan
 * (settlement dan expire) bisa sama-sama membaca "pending", lalu yang
 * menulis terakhir menang — dan itu bisa saja expire.
 */
export async function applyNotification(
  orderId: string,
  u: NotificationUpdate,
): Promise<OrderStatus | null> {
  const ref = orderRef(orderId);

  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return null;

    const current = toOrder(data);
    const patch: Record<string, unknown> = {
      updatedAt: u.now,
      lastNotification: u.payload,
    };
    if (u.paymentType) patch.paymentType = u.paymentType;

    if (current.status === "paid") {
      if (u.status === "failed" || u.status === "expired") {
        patch.postPaidStatus = u.status;
        patch.postPaidTransactionStatus = u.transactionStatus;
        patch.postPaidAt = u.now;
      }
      tx.update(ref, patch);
      return "paid";
    }

    patch.status = u.status;
    if (u.status === "paid") patch.paidAt = current.paidAt ?? u.now;

    tx.update(ref, patch);
    return u.status;
  });
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
export async function findPendingOrder(
  uid: string,
  courseSlug: string,
  method: OrderMethod = "midtrans",
): Promise<Order | null> {
  const snap = await adminDb()
    .collection(ORDERS)
    .where("uid", "==", uid)
    .where("courseSlug", "==", courseSlug)
    .where("status", "==", "pending")
    .get();

  const now = new Date();
  for (const doc of snap.docs) {
    const order = toOrder(doc.data());
    if (order.method !== method) continue;
    if (!isPayable(order, now)) continue;

    // Pesanan Midtrans tanpa snapToken tidak bisa dibuka lagi — popup Snap
    // butuh token itu. Jalur manual tidak punya token apa pun, jadi syarat ini
    // hanya berlaku untuk Midtrans.
    if (method === "midtrans" && !order.snapToken) continue;

    return order;
  }
  return null;
}

/**
 * Pesanan manual yang menunggu ditinjau admin, terbaru di atas.
 *
 * Disaring per-metode DI MEMORI, bukan dengan `where("method", "==", "manual")`.
 * Kueri kesamaan Firestore mengabaikan dokumen yang tidak punya field-nya, dan
 * pesanan lama memang tidak punya `method` — jebakan yang sudah dua kali
 * menggigit di proyek ini (`orderBy("order")` dan `visibility`). Di sini
 * dampaknya kebetulan tidak terasa karena yang dicari justru yang baru, tapi
 * aturannya tetap: jangan menyaring field yang bisa hilang lewat kueri.
 */
export async function listOrdersAwaitingReview(): Promise<Order[]> {
  const snap = await adminDb()
    .collection(ORDERS)
    .where("status", "==", "awaiting_review")
    .get();

  return snap.docs
    .map((d) => toOrder(d.data()))
    .filter((o) => o.method === "manual")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Jumlah pesanan manual yang menunggu tinjauan — untuk lencana panel admin. */
export async function countOrdersAwaitingReview(): Promise<number> {
  return (await listOrdersAwaitingReview()).length;
}

/**
 * Pesanan manual seseorang yang masih hidup untuk satu kursus.
 *
 * "Hidup" berarti `pending` (belum kirim bukti) atau `awaiting_review` (sudah
 * kirim, menunggu admin) — dua keadaan yang membuat halaman kursus menampilkan
 * panel lanjutan alih-alih tombol beli.
 *
 * Sengaja pembacaan biasa, bukan Server Action: dipanggil dari Server
 * Component halaman kursus, dan setiap ekspor di berkas "use server" menjadi
 * endpoint yang bisa dipanggil siapa pun.
 */
export async function findLiveManualOrder(uid: string, courseSlug: string): Promise<Order | null> {
  const snap = await adminDb()
    .collection(ORDERS)
    .where("uid", "==", uid)
    .where("courseSlug", "==", courseSlug)
    .get();

  const hidup = snap.docs
    .map((d) => toOrder(d.data()))
    .filter((o) => o.method === "manual")
    .filter((o) => o.status === "pending" || o.status === "awaiting_review")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const terbaru = hidup[0];
  if (!terbaru) return null;

  // Yang sudah lewat waktunya tidak ditawarkan lagi — pembeli harus memulai
  // pesanan baru, dan panel tidak menyuruhnya membayar nominal basi.
  if (terbaru.status === "pending" && !isPayable(terbaru)) return null;

  return terbaru;
}
