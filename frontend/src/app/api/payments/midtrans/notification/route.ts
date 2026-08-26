import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCourse } from "@/lib/courses";
import { newEnrollment, writeEnrollment } from "@/lib/enrollments";
import { getOrder, orderRef } from "@/lib/orders";
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
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status,
    paymentType: paymentTypeOf(payload),
    updatedAt: now,
    lastNotification: payload as Record<string, unknown>,
  };

  if (status !== "paid") {
    await orderRef(orderId).update(patch);
    return NextResponse.json({ ok: true, status });
  }

  // ── 3. Memberi akses ─────────────────────────────────────────────────
  const course = await getCourse(order.courseSlug);
  if (!course) {
    // Kursusnya dihapus setelah dipesan. Pesanannya tetap ditandai lunas —
    // uangnya memang masuk — dan pengembaliannya diurus manual.
    console.error(`[payment] kursus ${order.courseSlug} hilang untuk pesanan ${orderId}`);
    await orderRef(orderId).update({ ...patch, paidAt: order.paidAt ?? now });
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

  await orderRef(orderId).update({ ...patch, paidAt: order.paidAt ?? now });

  if (created) {
    revalidatePath(`/courses/${order.courseSlug}`);
    revalidatePath("/profil");
  }

  return NextResponse.json({ ok: true, status, created });
}
