"use server";
import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { createReferralCodeFor } from "@/lib/referralCore";
import { resolveReferral } from "@/lib/referrals";

export type CreateResult = { ok: true; code: string; message: string } | { ok: false; error: string };

/** Membuat kode referral milik SENDIRI — uid selalu dari session cookie. */
export async function createMyReferralCode(raw: unknown): Promise<CreateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const hasil = await createReferralCodeFor(adminDb(), user.uid, raw);
  if (!hasil.ok) return hasil;

  revalidatePath("/dashboard");
  return { ok: true, code: hasil.code, message: `Kode referral ${hasil.code} aktif.` };
}

export type CheckResult =
  | { ok: true; code: string | null; referrerName: string | null }
  | { ok: false; error: string };

// Jendela tetap per uid, in-memory — keterbatasannya sama dengan chatRateLimit.
// Tanpa batas, pengecekan ini bisa dipakai menebak seluruh daftar kode.
const WINDOW_MS = 60_000;
const MAX_CHECKS = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function tooMany(uid: string): boolean {
  const saat = Date.now();
  const b = buckets.get(uid);
  if (!b || b.resetAt <= saat) {
    buckets.set(uid, { count: 1, resetAt: saat + WINDOW_MS });
    return false;
  }
  if (b.count >= MAX_CHECKS) return true;
  b.count++;
  return false;
}

/**
 * Umpan balik saat pembeli memasukkan kode, SEBELUM membeli.
 *
 * Bukan penjaganya — pembuatan pesanan memvalidasi ulang sendiri. Yang
 * dikembalikan hanya nama tampilan perujuk, tidak pernah uid atau email.
 */
export async function checkReferralCode(raw: unknown): Promise<CheckResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (tooMany(user.uid)) return { ok: false, error: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi." };

  const hasil = await resolveReferral(raw, user.uid);
  if (!hasil.ok) return hasil;
  if (!hasil.referral) return { ok: true, code: null, referrerName: null };

  const akun = await adminAuth()
    .getUser(hasil.referral.uid)
    .catch(() => null);
  return { ok: true, code: hasil.referral.code, referrerName: akun?.displayName?.trim() || null };
}
