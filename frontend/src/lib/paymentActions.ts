"use server";
import { getCourse } from "@/lib/courses";
import { getEnrollment } from "@/lib/enrollments";
import { getCurrentUser } from "@/lib/firebase/session";
import { findPendingOrder, makeOrderId, orderRef, type Order } from "@/lib/orders";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { referralCodeOf, termsForNewOrder } from "@/lib/royalty";
import { resolveReferral } from "@/lib/referrals";
import {
  createSnapTransaction,
  expireTransaction,
  paymentsConfigured,
} from "@/lib/payments/midtrans";

export type OrderResult =
  | { ok: true; token: string; orderId: string }
  | { ok: false; error: string };

/** Seberapa lama QR/VA berlaku sebelum hangus. */
const EXPIRY_MINUTES = 30;

/**
 * Membuat pesanan lalu menerbitkan token pembayaran.
 *
 * Server Action bisa dipanggil lewat POST langsung, jadi TIDAK ADA satu pun
 * angka dari browser yang dipercaya di sini — harga dibaca dari dokumen
 * kursus. Prinsip yang sama sudah berlaku di enrollFree; bedanya, di sini
 * mengabaikannya berarti seseorang bisa membayar Rp1 untuk kursus Rp500.000.
 *
 * Yang TIDAK dilakukan fungsi ini: memberi akses. Token yang dikembalikan
 * hanya membuka popup pembayaran. Akses baru ditulis oleh webhook, setelah
 * Midtrans mengonfirmasi uangnya benar-benar masuk.
 */
export async function createOrder(slug: string, referralCode?: unknown): Promise<OrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  if (!paymentsConfigured()) {
    return { ok: false, error: "Pembayaran belum aktif. Hubungi pengelola." };
  }

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  // Kursus gratis punya jalurnya sendiri (enrollFree). Membiarkannya lewat
  // sini akan membuat transaksi Rp0 yang pasti ditolak Midtrans.
  if (course.price <= 0) {
    return { ok: false, error: "Kursus ini gratis - cukup tekan tombol daftar." };
  }

  const existing = await getEnrollment(user.uid, slug);
  if (existing) return { ok: false, error: "Anda sudah terdaftar di kursus ini." };

  // Divalidasi SEBELUM menyentuh Midtrans: kode yang salah ketik lebih baik
  // dikatakan sekarang daripada diam-diam diabaikan dan perujuknya tidak dibayar.
  const ref = await resolveReferral(referralCode, user.uid);
  if (!ref.ok) return { ok: false, error: ref.error };
  const kode = ref.referral?.code ?? null;

  // Pesanan yang masih hidup dipakai ulang. Tanpa ini, setiap klik "Beli"
  // menerbitkan transaksi baru di Midtrans dan meninggalkan tumpukan pesanan
  // menggantung yang tidak pernah bisa dibedakan dari percobaan yang sah.
  //
  // TAPI hanya kalau nominalnya masih sama dengan harga kursus sekarang.
  //
  // Harga kursus bisa berubah kapan saja, sementara pesanan tertunda hidup
  // 30 menit. Tanpa syarat ini, pembeli melihat harga baru di halaman lalu
  // membayar harga lama di popup Midtrans — dan webhook meloloskannya, sebab
  // nominal yang dibandingkannya adalah nominal pesanan lama itu sendiri,
  // bukan harga kursusnya. Dua-duanya merugikan: harga naik berarti educator
  // dibayar kurang, harga turun berarti pembeli membayar lebih.
  const pending = await findPendingOrder(user.uid, slug);
  if (pending?.snapToken) {
    // Kode referral juga harus sama: pesanan lama membawa perujuknya sendiri,
    // dan membayar lewat token lama berarti komisi jatuh ke orang yang salah.
    if (pending.amount === course.price && referralCodeOf(pending) === kode) {
      return { ok: true, token: pending.snapToken, orderId: pending.orderId };
    }

    // Token lama masih bisa dibayar sampai kedaluwarsa, jadi ia dihanguskan
    // di Midtrans juga — berhenti membagikannya saja tidak cukup untuk
    // pembeli yang popup lamanya masih terbuka.
    const dihanguskan = await expireTransaction(pending.orderId);

    await orderRef(pending.orderId).update({
      status: "expired",
      updatedAt: new Date().toISOString(),
    });

    // Hasil penghangusan ikut dicatat, bukan dibuang. Kalau ia selalu gagal,
    // itu hanya terlihat di sini — pesanan tetap ditandai kedaluwarsa dan
    // alurnya tetap mulus, sehingga tidak ada gejala lain yang muncul.
    console.info(
      `[payment] pesanan ${pending.orderId} dihanguskan: harga/referral ${slug} berubah ` +
        `${pending.amount} -> ${course.price}, ${referralCodeOf(pending) ?? "-"} -> ${kode ?? "-"}` +
        ` (di Midtrans: ${dihanguskan ? "ya" : "tidak / belum ada transaksi"})`,
    );
  }

  const orderId = makeOrderId(slug, user.uid);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60_000);
  const settings = await getPaymentSettings();

  let token: string;
  try {
    token = await createSnapTransaction({
      orderId,
      amount: course.price,
      itemId: slug,
      itemName: course.title,
      customerName: user.name,
      customerEmail: user.email,
      expiryMinutes: EXPIRY_MINUTES,
    });
  } catch (e) {
    // Pesan asli Midtrans tidak diteruskan ke pengguna — isinya istilah teknis
    // dan kadang memuat potongan konfigurasi.
    console.error("[payment] gagal membuat transaksi:", e);
    return { ok: false, error: "Pembayaran tidak dapat dimulai. Coba lagi sebentar lagi." };
  }

  // Dokumen ditulis SETELAH token terbit. Kalau urutannya dibalik, kegagalan
  // di Midtrans meninggalkan pesanan tertunda yang tidak akan pernah bisa
  // dibayar, dan pesanan itu akan dipakai ulang oleh percobaan berikutnya.
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
    method: "midtrans",
    paymentType: null,
    snapToken: token,
    // Field tinjauan hanya terpakai jalur QRIS manual. Tetap ditulis eksplisit
    // sebagai null supaya bentuk dokumennya seragam apa pun metodenya —
    // panel admin dan skrip verifikasi tidak perlu menebak.
    proofPath: null,
    payerNote: null,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByName: null,
    reviewNote: null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    paidAt: null,
    updatedAt: now.toISOString(),
    lastNotification: null,
    postPaidStatus: null,
    postPaidTransactionStatus: null,
    postPaidAt: null,
    // Dibekukan pada detik yang sama dengan `amount`.
    royalty: termsForNewOrder(course, settings, ref.referral, now.toISOString()),
  };

  await orderRef(orderId).set(order);

  return { ok: true, token, orderId };
}
