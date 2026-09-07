"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { getCourse } from "@/lib/courses";
import { getEnrollment, newEnrollment, writeEnrollment } from "@/lib/enrollments";
import {
  findPendingOrder,
  getOrder,
  isPayable,
  makeOrderId,
  orderRef,
  type Order,
} from "@/lib/orders";
import { getPaymentSettings, manualQrisReady } from "@/lib/paymentSettings";
import { PAYMENT_PROOFS } from "@/lib/storagePaths";

export type ManualResult =
  | { ok: true; message: string; order?: Order }
  | { ok: false; error: string };

/** Sejalan dengan jalur Midtrans: pesanan menggantung tidak berlaku selamanya. */
const TTL_MINUTES = 24 * 60;
const MAX_NOTE = 500;
const MIN_REVIEW_NOTE = 10;

/**
 * Pembayaran QRIS manual lewat merchant Pedagang Bima (Bank Jateng).
 *
 * Berbeda dari jalur Midtrans dalam satu hal yang menentukan: tidak ada
 * webhook. Bank tidak memberi tahu server ini bahwa uang sudah masuk, jadi
 * yang membuka akses adalah keputusan admin setelah mencocokkan dengan mutasi
 * di aplikasi Pedagang Bima.
 *
 * Yang TIDAK berubah: akses tetap tidak pernah diberikan oleh apa pun yang
 * datang dari browser. Bukti unggahan hanya memindahkan pesanan ke antrean
 * tinjauan — ia bukan bukti pembayaran, dan panel admin mengatakannya
 * terang-terangan karena tangkapan layar bisa dipalsukan.
 */

function clean(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

// ── Pembeli ───────────────────────────────────────────────────────────

/**
 * Membuat (atau memakai ulang) pesanan QRIS manual.
 *
 * Harga dibaca dari dokumen kursus, tidak pernah dari argumen — prinsip yang
 * sama dengan enrollFree dan createOrder. Server Action bisa dipanggil lewat
 * POST langsung, jadi apa pun yang dikirim browser bukan bukti.
 */
export async function createManualOrder(slug: string): Promise<ManualResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const settings = await getPaymentSettings();
  if (!manualQrisReady(settings)) {
    return { ok: false, error: "Pembayaran QRIS manual sedang tidak tersedia." };
  }

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  // Kursus gratis punya jalurnya sendiri. Membiarkannya lewat sini berarti
  // membuat pesanan Rp 0 yang menunggu ditinjau admin tanpa guna.
  if (course.price <= 0) {
    return { ok: false, error: "Kursus ini gratis — cukup tekan Daftar Kursus Ini." };
  }

  const existing = await getEnrollment(user.uid, slug);
  if (existing) return { ok: false, error: "Anda sudah terdaftar di kursus ini." };

  // Pesanan yang masih hidup dipakai ulang. Tanpa ini, setiap kali halaman
  // dibuka lahir satu pesanan baru dan antrean admin dipenuhi duplikat.
  //
  // Syarat nominalnya sama seperti di jalur Midtrans, dan di sini akibatnya
  // justru lebih sulit dibereskan: pembeli sudah terlanjur mentransfer
  // sejumlah uang lewat QRIS, dan uang yang sudah pindah tidak bisa ditarik
  // kembali semudah membatalkan transaksi.
  const reuse = await findPendingOrder(user.uid, slug, "manual");
  if (reuse) {
    if (reuse.amount === course.price) {
      return { ok: true, message: "Melanjutkan pesanan yang belum selesai.", order: reuse };
    }

    await orderRef(reuse.orderId).update({
      status: "expired",
      updatedAt: new Date().toISOString(),
    });

    console.info(
      `[payment] pesanan manual ${reuse.orderId} dihanguskan: harga ${slug} berubah ` +
        `${reuse.amount} -> ${course.price}`,
    );
  }

  const now = new Date();
  const orderId = makeOrderId(slug, user.uid);

  const order: Order = {
    orderId,
    uid: user.uid,
    userEmail: user.email,
    userName: user.name,
    courseSlug: slug,
    courseTitle: course.title,
    amount: course.price,
    currency: "IDR",
    status: "pending",
    method: "manual",
    paymentType: "qris_manual",
    snapToken: null,
    proofPath: null,
    payerNote: null,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByName: null,
    reviewNote: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MINUTES * 60_000).toISOString(),
    paidAt: null,
    updatedAt: now.toISOString(),
    lastNotification: null,
  };

  await orderRef(orderId).set(order);
  revalidatePath(`/courses/${slug}`);

  return { ok: true, message: "Pesanan dibuat.", order };
}

/**
 * Pembeli mengunggah bukti bayar, pesanan masuk antrean tinjauan.
 *
 * Berkasnya sudah diunggah lebih dulu dari browser ke `payment-proofs/{uid}/`;
 * yang dikirim ke sini hanya path-nya. Awalannya diperiksa ulang di server:
 * tanpa itu, satu panggilan mentah bisa menautkan berkas milik orang lain ke
 * pesanan sendiri, lalu route penyaji bukti akan menampilkannya kepada admin
 * seolah-olah itu milik si pengirim.
 */
export async function submitPaymentProof(
  orderId: string,
  proofPath: string,
  noteRaw: string,
): Promise<ManualResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (order.uid !== user.uid) return { ok: false, error: "Ini bukan pesanan Anda." };
  if (order.method !== "manual") {
    return { ok: false, error: "Pesanan ini tidak memakai pembayaran manual." };
  }
  if (!isPayable(order)) {
    return {
      ok: false,
      error:
        order.status === "pending"
          ? "Pesanan ini sudah kedaluwarsa. Buat pesanan baru."
          : "Pesanan ini sudah tidak menunggu pembayaran.",
    };
  }

  const path = clean(proofPath, 500);
  if (!path.startsWith(`${PAYMENT_PROOFS}/${user.uid}/`)) {
    return { ok: false, error: "Berkas bukti bayar tidak sah." };
  }

  const now = new Date().toISOString();
  await orderRef(orderId).update({
    status: "awaiting_review",
    proofPath: path,
    payerNote: clean(noteRaw, MAX_NOTE) || null,
    updatedAt: now,
  });

  revalidatePath(`/courses/${order.courseSlug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/payments");

  return { ok: true, message: "Bukti terkirim. Menunggu konfirmasi admin." };
}

// ── Admin ─────────────────────────────────────────────────────────────

/**
 * Admin memutuskan satu pesanan manual.
 *
 * Menyetujui berarti menulis enrollment `source: "paid"` — bentuk dokumen yang
 * sama persis dengan yang ditulis webhook Midtrans, sehingga dashboard,
 * sertifikat, dan ulasan tidak perlu tahu lewat mana kursusnya dibeli.
 *
 * Idempoten: enrollmentId() deterministik dan writeEnrollment() transaksional,
 * jadi menyetujui dua kali tidak menambah `enrolledStudents`.
 */
export async function decideManualOrder(
  orderId: string,
  decision: "approve" | "reject",
  noteRaw: string,
): Promise<ManualResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat memutuskan pembayaran." };
  }

  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (order.method !== "manual") {
    return { ok: false, error: "Pesanan ini tidak memakai pembayaran manual." };
  }
  if (order.status !== "awaiting_review") {
    return { ok: false, error: "Pesanan ini tidak sedang menunggu tinjauan." };
  }

  const note = clean(noteRaw, MAX_NOTE);
  if (decision === "reject" && note.length < MIN_REVIEW_NOTE) {
    return {
      ok: false,
      error: `Tuliskan alasan penolakan, minimal ${MIN_REVIEW_NOTE} karakter.`,
    };
  }

  const now = new Date().toISOString();

  if (decision === "reject") {
    await orderRef(orderId).update({
      status: "failed",
      reviewedAt: now,
      reviewedByUid: admin.uid,
      reviewedByName: admin.name,
      reviewNote: note,
      updatedAt: now,
    });

    revalidatePath(`/courses/${order.courseSlug}`);
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    return { ok: true, message: "Pembayaran ditolak." };
  }

  const course = await getCourse(order.courseSlug);
  if (!course) {
    return { ok: false, error: "Kursusnya sudah tidak ada. Pesanan ini tidak bisa diterapkan." };
  }

  // `order.amount` yang dipakai, bukan `course.price` terkini: itulah nominal
  // yang benar-benar dibayar pembeli. Harga kursus bisa saja berubah setelah
  // pesanannya dibuat.
  await writeEnrollment(newEnrollment(order.uid, course, "paid", order.amount, order.orderId));

  await orderRef(orderId).update({
    status: "paid",
    paidAt: now,
    reviewedAt: now,
    reviewedByUid: admin.uid,
    reviewedByName: admin.name,
    reviewNote: note || null,
    updatedAt: now,
  });

  revalidatePath(`/courses/${order.courseSlug}`);
  revalidatePath("/profil");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");

  return { ok: true, message: "Pembayaran disetujui dan akses dibuka." };
}
