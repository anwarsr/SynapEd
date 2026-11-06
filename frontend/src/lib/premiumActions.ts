"use server";
import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { getCourse } from "@/lib/courses";
import { ownerUidOf } from "@/lib/educatorCourses";
import { enrollmentRef, getEnrollment, isActive, newEnrollment, writeEnrollment } from "@/lib/enrollments";
import { findPendingOrder, makeOrderId, orderRef, type Order } from "@/lib/orders";
import { getPaymentSettings, manualQrisReady } from "@/lib/paymentSettings";
import { resolveReferral } from "@/lib/referrals";
import { createSnapTransaction, expireTransaction, paymentsConfigured } from "@/lib/payments/midtrans";
import { getPremium } from "@/lib/premium";
import { beriPeriodePremium, bagiSemuaPeriode, cabutPremium } from "@/lib/premiumCore";
import {
  PREMIUM_HARI_ADMIN_MAKS,
  PREMIUM_JUDUL,
  PREMIUM_SLUG,
  makePremiumTerms,
  parsePremiumTerms,
} from "@/lib/premiumRules";

/**
 * Server Action SynapEd Premium.
 *
 * Setiap ekspor berkas ini adalah endpoint publik (bisa di-POST langsung), jadi
 * setiap fungsi memeriksa sesi & perannya sendiri, uid SELALU dari sesi, dan
 * harga SELALU dari setelan - tidak satu pun angka dari browser dipercaya.
 * Yang memberi premium karena pembayaran bukan berkas ini, melainkan webhook
 * bertanda tangan dan keputusan admin (`premiumCore.beriPeriodePremium`).
 */

export type PremiumResult = { ok: true; message: string } | { ok: false; error: string };
export type PremiumOrderResult = { ok: true; token: string; orderId: string } | { ok: false; error: string };
export type PremiumManualResult = { ok: true; message: string; order: Order } | { ok: false; error: string };

const EXPIRY_MINUTES = 30;
const MANUAL_TTL_MINUTES = 24 * 60;
const MAX_CATATAN = 300;

function kodeReferralDari(order: Pick<Order, "royalty">): string | null {
  return parsePremiumTerms(order.royalty)?.referral?.code ?? null;
}

/** Pesanan premium baru - bentuk dokumen sama dengan pesanan kursus, `kind: "premium"`. */
function pesananPremium(
  user: { uid: string; email: string | null; name: string | null },
  orderId: string,
  amount: number,
  method: Order["method"],
  terms: unknown,
  now: Date,
  ttlMinutes: number,
  snapToken: string | null,
): Order {
  return {
    orderId,
    uid: user.uid,
    userEmail: user.email,
    userName: user.name,
    kind: "premium",
    courseSlug: PREMIUM_SLUG,
    courseTitle: PREMIUM_JUDUL,
    amount,
    currency: "IDR",
    status: "pending",
    method,
    paymentType: method === "manual" ? "qris_manual" : null,
    snapToken,
    proofPath: null,
    payerNote: null,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByName: null,
    reviewNote: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    paidAt: null,
    updatedAt: now.toISOString(),
    lastNotification: null,
    postPaidStatus: null,
    postPaidTransactionStatus: null,
    postPaidAt: null,
    // Dibekukan pada detik yang sama dengan `amount`: potongan platform & perujuk.
    royalty: terms,
  };
}

/** Membeli premium 30 hari lewat Midtrans. Akses BARU diberikan webhook setelah uang masuk. */
export async function createPremiumOrder(referralCode?: unknown): Promise<PremiumOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!paymentsConfigured()) return { ok: false, error: "Pembayaran belum aktif. Hubungi pengelola." };

  const settings = await getPaymentSettings();
  if (!settings.midtransEnabled) return { ok: false, error: "Pembayaran otomatis sedang tidak tersedia." };
  const harga = settings.premiumPrice;

  const ref = await resolveReferral(referralCode, user.uid);
  if (!ref.ok) return { ok: false, error: ref.error };
  const kode = ref.referral?.code ?? null;

  // Pesanan tertunda dipakai ulang HANYA bila harga & kode referral sama -
  // alasan yang sama dengan createOrder kursus (harga bisa diubah admin).
  const pending = await findPendingOrder(user.uid, PREMIUM_SLUG, "midtrans", "premium");
  if (pending?.snapToken) {
    if (pending.amount === harga && kodeReferralDari(pending) === kode) {
      return { ok: true, token: pending.snapToken, orderId: pending.orderId };
    }
    await expireTransaction(pending.orderId);
    await orderRef(pending.orderId).update({ status: "expired", updatedAt: new Date().toISOString() });
  }

  const orderId = makeOrderId(PREMIUM_SLUG, user.uid);
  const now = new Date();
  let token: string;
  try {
    token = await createSnapTransaction({
      orderId,
      amount: harga,
      itemId: PREMIUM_SLUG,
      itemName: PREMIUM_JUDUL,
      customerName: user.name,
      customerEmail: user.email,
      expiryMinutes: EXPIRY_MINUTES,
    });
  } catch (e) {
    console.error("[premium] gagal membuat transaksi:", e);
    return { ok: false, error: "Pembayaran tidak dapat dimulai. Coba lagi sebentar lagi." };
  }

  const terms = makePremiumTerms(
    settings.platformFeePercent,
    ref.referral ? { ...ref.referral, percent: settings.referralPercent } : null,
    now.toISOString(),
  );
  await orderRef(orderId).set(pesananPremium(user, orderId, harga, "midtrans", terms, now, EXPIRY_MINUTES, token));
  return { ok: true, token, orderId };
}

/** Membeli premium lewat QRIS manual - premium diberikan saat admin menyetujui bukti bayar. */
export async function createManualPremiumOrder(referralCode?: unknown): Promise<PremiumManualResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const settings = await getPaymentSettings();
  if (!manualQrisReady(settings)) return { ok: false, error: "Pembayaran QRIS manual sedang tidak tersedia." };
  const harga = settings.premiumPrice;

  const ref = await resolveReferral(referralCode, user.uid);
  if (!ref.ok) return { ok: false, error: ref.error };
  const kode = ref.referral?.code ?? null;

  const reuse = await findPendingOrder(user.uid, PREMIUM_SLUG, "manual", "premium");
  if (reuse) {
    if (reuse.amount === harga && kodeReferralDari(reuse) === kode) {
      return { ok: true, message: "Melanjutkan pesanan yang belum selesai.", order: reuse };
    }
    await orderRef(reuse.orderId).update({ status: "expired", updatedAt: new Date().toISOString() });
  }

  const now = new Date();
  const orderId = makeOrderId(PREMIUM_SLUG, user.uid);
  const terms = makePremiumTerms(
    settings.platformFeePercent,
    ref.referral ? { ...ref.referral, percent: settings.referralPercent } : null,
    now.toISOString(),
  );
  const order = pesananPremium(user, orderId, harga, "manual", terms, now, MANUAL_TTL_MINUTES, null);
  await orderRef(orderId).set(order);
  revalidatePath("/premium");
  return { ok: true, message: "Pesanan dibuat.", order };
}

/**
 * Mulai mempelajari kursus berbayar dengan Premium.
 *
 * Menulis pendaftaran `source: "premium"` yang `expiresAt`-nya = masa aktif
 * premium; setiap perpanjangan/pencabutan menyamakannya lagi. Cakupan: kursus
 * PUBLIK BERBAYAR selain milik sendiri (gratis punya jalurnya sendiri).
 */
export async function enrollPremium(slug: string): Promise<PremiumResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const status = await getPremium(user.uid);
  if (!status.aktif || !status.activeUntil) return { ok: false, error: "Premium Anda tidak aktif." };

  const course = await getCourse(String(slug));
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };
  if (course.visibility === "private") return { ok: false, error: "Kursus ini tidak termasuk Premium." };
  if (course.price <= 0) return { ok: false, error: "Kursus ini gratis - cukup tekan Daftar Kursus Ini." };
  if (ownerUidOf(course) === user.uid) return { ok: false, error: "Ini kursus Anda sendiri." };

  const ada = await getEnrollment(user.uid, course.slug);
  if (ada) {
    if (ada.source === "premium") {
      // Pendaftaran premium dari periode sebelumnya: cukup disamakan lagi.
      await enrollmentRef(user.uid, course.slug).update({ expiresAt: status.activeUntil });
      revalidatePath(`/courses/${course.slug}`);
      return { ok: true, message: "Akses Premium dibuka kembali. Lanjutkan belajar!" };
    }
    if (isActive(ada)) return { ok: false, error: "Anda sudah terdaftar di kursus ini." };
    return { ok: false, error: "Pendaftaran Anda di kursus ini sudah berakhir dan tidak bisa dibuka lewat Premium." };
  }

  await writeEnrollment({ ...newEnrollment(user.uid, course, "premium", 0, null), expiresAt: status.activeUntil });
  revalidatePath(`/courses/${course.slug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Kursus terbuka lewat Premium. Selamat belajar!" };
}

/**
 * Status premium PENGGUNA SESI (untuk lencana navbar). Tidak menerima uid:
 * tidak ada cara memakai endpoint ini untuk menanyakan akun orang lain.
 */
export async function statusPremiumSaya(): Promise<{ aktif: boolean; activeUntil: string | null; sisaHari: number }> {
  const user = await getCurrentUser();
  if (!user) return { aktif: false, activeUntil: null, sisaHari: 0 };
  return getPremium(user.uid);
}

// ── Admin ─────────────────────────────────────────────────────────────

async function pastikanAdmin() {
  const admin = await getCurrentUser();
  return admin?.role === "admin" ? admin : null;
}

/** Akun sasaran dari email ATAU UID (admin biasanya tahu email-nya). null = tidak ada. */
async function uidSasaran(raw: unknown): Promise<string | null> {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  try {
    return (t.includes("@") ? await adminAuth().getUserByEmail(t) : await adminAuth().getUser(t)).uid;
  } catch {
    return null;
  }
}

/** Memberi premium tanpa bayar (beasiswa, guru mitra). Sasaran = email atau UID. Tidak ada uang → tidak ada yang dibagi. */
export async function grantPremiumAdmin(targetUid: unknown, hariRaw: unknown, catatanRaw: unknown): Promise<PremiumResult> {
  const admin = await pastikanAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat memberi premium." };

  const hari = typeof hariRaw === "number" ? hariRaw : Number.NaN;
  if (!Number.isInteger(hari) || hari < 1 || hari > PREMIUM_HARI_ADMIN_MAKS) {
    return { ok: false, error: `Lama premium harus 1 sampai ${PREMIUM_HARI_ADMIN_MAKS} hari.` };
  }
  const uid = await uidSasaran(targetUid);
  if (!uid) return { ok: false, error: "Akun tidak ditemukan." };

  const now = new Date();
  const catatan = typeof catatanRaw === "string" ? catatanRaw.trim().slice(0, MAX_CATATAN) : "";
  const { activeUntil } = await beriPeriodePremium(adminDb(), {
    uid,
    periodId: `admin-${uid.slice(0, 8)}-${now.getTime().toString(36)}`,
    source: "admin",
    gross: 0,
    terms: null,
    orderId: null,
    grantedByUid: admin.uid,
    note: catatan,
    hari,
    now,
  });

  revalidatePath("/admin/premium");
  return { ok: true, message: `Premium diberikan ${hari} hari, aktif sampai ${new Date(activeUntil).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" })}.` };
}

/** Mencabut premium sekarang (mis. pengembalian dana). Kemajuan belajar tetap tersimpan. */
export async function revokePremiumAdmin(targetUid: unknown, catatanRaw: unknown): Promise<PremiumResult> {
  const admin = await pastikanAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mencabut premium." };
  const uid = await uidSasaran(targetUid);
  if (!uid) return { ok: false, error: "Akun tidak ditemukan." };
  const catatan = typeof catatanRaw === "string" ? catatanRaw.trim().slice(0, MAX_CATATAN) : "";

  const dicabut = await cabutPremium(adminDb(), { uid, now: new Date(), byUid: admin.uid, note: catatan });
  if (!dicabut) return { ok: false, error: "Akun ini sedang tidak premium." };
  revalidatePath("/admin/premium");
  return { ok: true, message: "Premium dicabut. Akses kursus lewat Premium berhenti sekarang." };
}

/** Membagi hasil semua periode premium yang sudah berakhir. Aman ditekan berulang kali. */
export async function settlePremiumNow(): Promise<PremiumResult> {
  const admin = await pastikanAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat membagikan pendapatan premium." };

  const { dibagi, gagal } = await bagiSemuaPeriode(adminDb(), new Date());
  revalidatePath("/admin/premium");
  revalidatePath("/dashboard/pendapatan");
  if (gagal.length > 0) {
    console.error("[premium] pembagian gagal:", gagal);
    return { ok: false, error: `${dibagi} periode dibagi, ${gagal.length} gagal - lihat log server.` };
  }
  return { ok: true, message: dibagi > 0 ? `${dibagi} periode premium dibagikan ke educator.` : "Tidak ada periode yang menunggu dibagi." };
}
