import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCourse } from "@/lib/courses";
import { newEnrollment, writeEnrollment } from "@/lib/enrollments";
import { applyNotification, getOrder, type NotificationUpdate } from "@/lib/orders";
import { realiseOrderSale } from "@/lib/royalty";
import {
  amountOf,
  normalizeStatus,
  orderIdOf,
  paymentTypeOf,
  verifySignature,
  type Notification,
} from "@/lib/payments/midtrans";

/**
 * Satu-satunya tempat akses kursus berbayar diberikan.
 *
 * Callback di browser (onSuccess milik Snap) TIDAK dipakai untuk itu. Callback
 * itu berjalan di komputer pembeli, jadi siapa pun bisa memanggilnya sendiri
 * tanpa pernah membayar. Yang menentukan hanya notifikasi server-ke-server
 * dari Midtrans, dan hanya setelah tanda tangannya terbukti sah.
 *
 * Endpoint ini PUBLIK — tidak ada cookie sesi yang menyertainya. Karena itu
 * setiap lapis pemeriksaan di bawah adalah pertahanan, bukan formalitas.
 */
export async function POST(request: Request) {
  let payload: Notification;

  try {
    payload = (await request.json()) as Notification;
  } catch {
    return NextResponse.json({ message: "Body tidak valid." }, { status: 400 });
  }

  // ── 1. Keaslian ──────────────────────────────────────────────────────
  // Tanpa ini, siapa pun yang menebak URL ini bisa mengirim "lunas" untuk
  // pesanan mana pun dan membuka seluruh kursus berbayar.
  if (!verifySignature(payload)) {
    console.warn("[payment] tanda tangan tidak sah untuk", orderIdOf(payload));
    return NextResponse.json({ message: "Tanda tangan tidak sah." }, { status: 403 });
  }

  const orderId = orderIdOf(payload);

  // ── 1b. Uji coba dari dashboard Midtrans ─────────────────────────────
  //
  // Tombol "Test notification URL" mengirim notifikasi bertanda tangan SAH
  // untuk pesanan tiruan yang memang tidak ada di sini. Pemeriksaan pesanan
  // di bawah menjawabnya 404, dan dashboard melaporkannya sebagai gagal —
  // padahal notifikasi sungguhan berjalan baik.
  //
  // Akibatnya bukan sekadar tampilan: itu satu-satunya alat yang dipunya
  // pemilik toko untuk memastikan URL-nya benar. Kalau ia selalu merah, tidak
  // ada lagi cara membedakan "URL salah ketik" dari "endpoint sedang mati".
  //
  // Dijawab 200 tanpa mengubah apa pun. Aman karena awalan ini ditentukan
  // Midtrans, bukan penyerang: menebaknya tidak memberi apa-apa, sebab tidak
  // ada pesanan yang disentuh dan tidak ada akses yang diberikan.
  if (orderId.startsWith("payment_notif_test")) {
    console.info("[payment] uji notifikasi dari dashboard Midtrans:", orderId);
    return NextResponse.json({ ok: true, message: "Uji notifikasi diterima." });
  }

  const order = await getOrder(orderId);

  if (!order) {
    // 404, bukan 200: pesanan tak dikenal berarti ada yang salah — entah
    // notifikasi nyasar dari akun Midtrans lain, entah percobaan iseng.
    return NextResponse.json({ message: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  // ── 2. Nominal ───────────────────────────────────────────────────────
  // Tanda tangan sudah mencakup gross_amount, jadi pemeriksaan ini secara
  // teori berlebihan. Ia tetap ada karena harganya nol: kalau suatu saat
  // rumus tanda tangannya diganti atau dilonggarkan, inilah yang menahan
  // pembayaran Rp1.000 membuka kursus Rp500.000.
  if (amountOf(payload) !== order.amount) {
    console.warn(`[payment] nominal ${amountOf(payload)} != ${order.amount} pada ${orderId}`);
    return NextResponse.json({ message: "Nominal tidak cocok." }, { status: 400 });
  }

  const status = normalizeStatus(payload);

  // Status `paid` tidak pernah diturunkan — lihat applyNotification.
  const update: NotificationUpdate = {
    status,
    transactionStatus: typeof payload.transaction_status === "string" ? payload.transaction_status : "",
    paymentType: paymentTypeOf(payload),
    payload: payload as Record<string, unknown>,
    now: new Date().toISOString(),
  };

  if (status !== "paid") {
    const final = await applyNotification(orderId, update);
    return NextResponse.json({ ok: true, status: final });
  }

  // ── 3. Memberi akses & mencatat penjualan ────────────────────────────
  const course = await getCourse(order.courseSlug);

  // Penjualan dicatat SEBELUM status pesanan diperbarui. Kalau pencatatan
  // gagal, webhook menjawab 500 dan Midtrans mengulang — pencatatan aman
  // diulang. Urutan terbalik akan menandai pesanan lunas lalu kehilangan
  // catatan penjualannya tanpa ada yang mengulang.
  //
  // Tetap dicatat walau kursusnya sudah dihapus: syarat pembagiannya
  // dibekukan di pesanan, bukan dibaca dari kursus.
  try {
    await realiseOrderSale(order, {
      paidAt: order.paidAt ?? update.now,
      source: "midtrans",
      courseOwnerUid: course?.ownerUid ?? null,
    });
  } catch (err) {
    console.error(`[royalty] gagal mencatat penjualan ${orderId}:`, err);
    return NextResponse.json({ message: "Pencatatan penjualan gagal." }, { status: 500 });
  }

  if (!course) {
    // Kursusnya dihapus setelah dipesan. Pesanannya tetap ditandai lunas —
    // uangnya memang masuk — dan pengembaliannya diurus manual.
    console.error(`[payment] kursus ${order.courseSlug} hilang untuk pesanan ${orderId}`);
    await applyNotification(orderId, update);
    return NextResponse.json({ ok: true, status, warning: "kursus tidak ditemukan" });
  }

  // Aman diproses berapa kali pun: Midtrans mengirim ulang notifikasi saat
  // retry dan bisa datang tidak berurutan. writeEnrollment memakai ID
  // dokumen yang deterministik dan mengembalikan false kalau pendaftarannya
  // sudah ada, sehingga pengiriman kedua tidak menambah peserta maupun
  // menimpa progres belajar yang sudah berjalan.
  const created = await writeEnrollment(
    newEnrollment(order.uid, course, "paid", order.amount, orderId),
  );

  await applyNotification(orderId, update);

  if (created) {
    revalidatePath(`/courses/${order.courseSlug}`);
    revalidatePath("/profil");
  }

  return NextResponse.json({ ok: true, status, created });
}
