import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { referralOwnerOf } from "@/lib/referralCore";
import { normalizeReferralCode } from "@/lib/referralRules";

export type ResolvedReferral =
  | { ok: true; referral: { uid: string; code: string } | null }
  | { ok: false; error: string };

/**
 * Memvalidasi kode yang dimasukkan pembeli.
 *
 * Kosong = tanpa referral, dan itu sah. Selain itu kodenya harus ada,
 * pemiliknya harus akun yang masih hidup, dan BUKAN pembelinya sendiri —
 * tanpa syarat terakhir, siapa pun bisa mendapat potongan 10% dari setiap
 * kursus yang ia beli hanya dengan memasukkan kodenya sendiri.
 */
export async function resolveReferral(raw: unknown, buyerUid: string): Promise<ResolvedReferral> {
  if (normalizeReferralCode(raw) === "") return { ok: true, referral: null };

  const owner = await referralOwnerOf(adminDb(), raw);
  if (!owner) return { ok: false, error: "Kode referral tidak ditemukan." };

  if (owner.uid === buyerUid) {
    return { ok: false, error: "Kode referral milik Anda sendiri tidak bisa dipakai untuk pembelian Anda." };
  }

  const hidup = await adminAuth()
    .getUser(owner.uid)
    .then(() => true)
    .catch(() => false);
  if (!hidup) return { ok: false, error: "Kode referral ini sudah tidak aktif." };

  return { ok: true, referral: owner };
}

export async function getMyReferralCode(uid: string): Promise<string | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const code = snap.get("referralCode");
  return typeof code === "string" && code ? code : null;
}
