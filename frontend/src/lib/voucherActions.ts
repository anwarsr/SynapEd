"use server";
import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { checkChatRateLimit } from "@/lib/chatRateLimit";
import { ownerUidOf } from "@/lib/educatorCourses";
import { getEnrollment, naikkanKePaid, newEnrollment, writeEnrollment } from "@/lib/enrollments";
import { getOrder, isLive, listOrdersWithVoucher, orderRef, type Order } from "@/lib/orders";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { beriPeriodePremium } from "@/lib/premiumCore";
import { PREMIUM_JUDUL, PREMIUM_SLUG, makePremiumTerms } from "@/lib/premiumRules";
import { termsForNewOrder } from "@/lib/royalty";
import { catatPemakaianVoucher } from "@/lib/voucherCore";
import { bacaSasaran, getVoucher, listPemakaianVoucher, nilaiVoucher, voucherRef } from "@/lib/vouchers";
import { METODE_VOUCHER, normalisasiKode, validasiVoucher, type MasukanVoucher } from "@/lib/voucherRules";

/**
 * Server Action voucher. Setiap ekspor = endpoint publik: tiap fungsi memeriksa
 * sesinya sendiri, uid SELALU dari sesi, harga SELALU dari kursus/setelan.
 * Yang dikirim browser hanya kode dan JENIS barang (kursus apa / Premium).
 */

export type CekVoucherResult =
  | { ok: true; code: string; harga: number; potongan: number; akhir: number }
  | { ok: false; error: string };
export type VoucherResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Pratinjau potongan untuk tombol "Terapkan". BUKAN keputusan: setiap
 * pembuatan pesanan menilai ulang kodenya. Dibatasi lajunya supaya kode tidak
 * bisa ditebak dengan mencoba ribuan kombinasi.
 */
export async function cekVoucher(kodeRaw: unknown, sasaranRaw: unknown): Promise<CekVoucherResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const laju = checkChatRateLimit(`voucher:${user.uid}`);
  if (!laju.ok) return { ok: false, error: `Terlalu banyak percobaan. Coba lagi dalam ${laju.retryAfterSeconds ?? 60} detik.` };

  const code = normalisasiKode(kodeRaw);
  if (!code) return { ok: false, error: "Masukkan kode voucher." };

  const t = await bacaSasaran(sasaranRaw);
  if (!t.ok) return { ok: false, error: t.error };
  const v = await nilaiVoucher(user.uid, code, t.sasaran);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, code, harga: t.sasaran.price, potongan: v.potongan, akhir: v.akhir };
}

/**
 * Voucher yang menutup SELURUH harga: akses dibuka langsung tanpa Midtrans/QRIS
 * (Rp0 tidak bisa diproses gerbang bayar). Dicatat sebagai pesanan lunas
 * `method: "voucher"` bernominal 0 - tidak ada yang dibagi.
 *
 * ID pesanan DETERMINISTIK (kode + akun + pemakaian ke-n): dua klik bersamaan
 * menghasilkan ID yang sama, sehingga pendaftaran, periode premium, dan
 * pemakaian voucher semuanya tercatat sekali saja.
 */
export async function klaimVoucherGratis(kodeRaw: unknown, sasaranRaw: unknown): Promise<VoucherResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const t = await bacaSasaran(sasaranRaw);
  if (!t.ok) return { ok: false, error: t.error };
  const v = await nilaiVoucher(user.uid, kodeRaw, t.sasaran);
  if (!v.ok) return { ok: false, error: v.error };
  if (!v.voucher || v.akhir !== 0) return { ok: false, error: "Voucher ini tidak menggratiskan pembelian - lanjutkan dengan pembayaran." };

  const course = t.course;
  if (course) {
    if (ownerUidOf(course) === user.uid) return { ok: false, error: "Ini kursus Anda sendiri." };
    const ada = await getEnrollment(user.uid, course.slug);
    if (ada && ada.source !== "premium") return { ok: false, error: "Anda sudah terdaftar di kursus ini." };
  }

  const code = v.snapshot.code;
  const ke = (await listPemakaianVoucher(code)).filter((p) => p.uid === user.uid).length + 1;
  const orderId = `VCR-${code}-${user.uid.slice(0, 8)}-${ke}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const settings = await getPaymentSettings();

  if (course) {
    const dibuat = await writeEnrollment(newEnrollment(user.uid, course, "paid", 0, orderId));
    // Sedang dipelajari lewat Premium: dinaikkan jadi milik selamanya, kemajuan tetap.
    if (!dibuat) await naikkanKePaid(user.uid, course.slug, orderId, 0);
  } else {
    await beriPeriodePremium(adminDb(), {
      uid: user.uid,
      periodId: orderId,
      source: "voucher",
      gross: 0,
      terms: null,
      orderId,
      grantedByUid: null,
      note: `Voucher ${code}`,
      now,
    });
  }

  const order: Order = {
    orderId,
    uid: user.uid,
    userEmail: user.email,
    userName: user.name,
    kind: course ? "course" : "premium",
    courseSlug: course?.slug ?? PREMIUM_SLUG,
    courseTitle: course?.title ?? PREMIUM_JUDUL,
    amount: 0,
    currency: "IDR",
    status: "paid",
    method: METODE_VOUCHER,
    paymentType: METODE_VOUCHER,
    snapToken: null,
    proofPath: null,
    payerNote: null,
    reviewedAt: null,
    reviewedByUid: null,
    reviewedByName: null,
    reviewNote: null,
    createdAt: nowIso,
    expiresAt: nowIso,
    paidAt: nowIso,
    updatedAt: nowIso,
    lastNotification: null,
    postPaidStatus: null,
    postPaidTransactionStatus: null,
    postPaidAt: null,
    royalty: course
      ? termsForNewOrder(course, settings, null, nowIso)
      : makePremiumTerms(settings.platformFeePercent, null, nowIso),
    voucher: v.snapshot,
    voucherCode: code,
  };
  // Klik kedua yang bersamaan menulis dokumen yang sama - tidak menggandakan apa pun.
  if (!(await getOrder(orderId))) await orderRef(orderId).set(order);
  await catatPemakaianVoucher(adminDb(), {
    orderId,
    uid: user.uid,
    userName: user.name,
    kind: order.kind,
    courseSlug: order.courseSlug,
    courseTitle: order.courseTitle,
    voucher: v.snapshot,
    method: METODE_VOUCHER,
    at: nowIso,
  });

  if (course) {
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath("/dashboard");
    return { ok: true, message: "Kursus terbuka dengan voucher. Selamat belajar!" };
  }
  revalidatePath("/premium");
  return { ok: true, message: "Premium aktif dengan voucher. Selamat belajar!" };
}

// ── Admin ─────────────────────────────────────────────────────────────

async function pastikanAdmin() {
  const admin = await getCurrentUser();
  return admin?.role === "admin" ? admin : null;
}

/** Email -> uid. Akun yang tak ada dilaporkan, bukan dibuang diam-diam. */
async function uidDariEmail(emails: string[]): Promise<{ ok: true; uids: string[] } | { ok: false; error: string }> {
  const uids: string[] = [];
  const hilang: string[] = [];
  // getUsers menerima paling banyak 100 pengenal sekali panggil.
  for (let i = 0; i < emails.length; i += 100) {
    const potong = emails.slice(i, i + 100);
    const hasil = await adminAuth().getUsers(potong.map((email) => ({ email })));
    const ada = new Map(hasil.users.map((u) => [u.email?.toLowerCase() ?? "", u.uid]));
    for (const e of potong) {
      const uid = ada.get(e);
      if (uid) uids.push(uid);
      else hilang.push(e);
    }
  }
  if (hilang.length > 0) return { ok: false, error: `Akun tidak ditemukan: ${hilang.slice(0, 5).join(", ")}${hilang.length > 5 ? ", …" : ""}` };
  return { ok: true, uids };
}

/** Membuat (`baru`) atau menyunting (`ubah`) voucher. Kode tidak bisa diganti setelah dibuat. */
export async function simpanVoucher(raw: MasukanVoucher, mode: "baru" | "ubah"): Promise<VoucherResult & { code?: string }> {
  const admin = await pastikanAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengelola voucher." };

  const now = new Date();
  const r = validasiVoucher(raw ?? ({} as MasukanVoucher), now, mode === "baru");
  if (!r.ok) return { ok: false, error: r.error };
  const akun = await uidDariEmail(r.data.khususEmail);
  if (!akun.ok) return { ok: false, error: akun.error };

  const ref = voucherRef(r.data.code);
  const isi = { ...r.data, khususUid: akun.uids, updatedAt: now.toISOString() };

  if (mode === "baru") {
    try {
      await ref.create({ ...isi, dipakai: 0, totalPotongan: 0, createdAt: now.toISOString(), createdByUid: admin.uid });
    } catch (err) {
      if ((err as { code?: number }).code === 6) return { ok: false, error: "Kode itu sudah dipakai voucher lain." };
      throw err;
    }
  } else {
    const ada = await ref.get();
    if (!ada.exists) return { ok: false, error: "Voucher tidak ditemukan." };
    // `dipakai`, `totalPotongan`, `createdAt` sengaja tidak disentuh.
    await ref.update(isi);
  }

  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/vouchers/${r.data.code}`);
  return { ok: true, message: mode === "baru" ? `Voucher ${r.data.code} dibuat.` : "Perubahan disimpan. Berlaku untuk pesanan berikutnya.", code: r.data.code };
}

export async function aturVoucherAktif(kodeRaw: unknown, aktif: unknown): Promise<VoucherResult> {
  const admin = await pastikanAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengelola voucher." };
  const v = await getVoucher(normalisasiKode(kodeRaw));
  if (!v) return { ok: false, error: "Voucher tidak ditemukan." };
  await voucherRef(v.code).update({ active: aktif === true, updatedAt: new Date().toISOString() });
  revalidatePath("/admin/vouchers");
  revalidatePath(`/admin/vouchers/${v.code}`);
  return { ok: true, message: aktif === true ? "Voucher diaktifkan." : "Voucher dinonaktifkan." };
}

/**
 * Hanya voucher yang BELUM PERNAH dipakai dan tidak sedang dibawa pesanan
 * tertunda. Yang sudah dipakai cukup dinonaktifkan: riwayatnya bagian dari
 * catatan uang dan kodenya tidak boleh bisa dibuat ulang dengan arti lain.
 */
export async function hapusVoucher(kodeRaw: unknown): Promise<VoucherResult> {
  const admin = await pastikanAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengelola voucher." };
  const v = await getVoucher(normalisasiKode(kodeRaw));
  if (!v) return { ok: false, error: "Voucher tidak ditemukan." };

  const [pemakaian, pesanan] = await Promise.all([listPemakaianVoucher(v.code), listOrdersWithVoucher(v.code)]);
  if (v.dipakai > 0 || pemakaian.length > 0) return { ok: false, error: "Voucher ini sudah pernah dipakai - nonaktifkan saja." };
  if (pesanan.some((o) => isLive(o))) return { ok: false, error: "Ada pesanan tertunda yang memakai voucher ini - nonaktifkan saja." };

  await voucherRef(v.code).delete();
  revalidatePath("/admin/vouchers");
  return { ok: true, message: `Voucher ${v.code} dihapus.` };
}
