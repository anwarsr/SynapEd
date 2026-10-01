/**
 * Kode referral: satu kode per akun, unik, dan PERMANEN.
 *
 * Tanpa `server-only` dan tanpa impor alias: `db` disuntikkan (pola yang sama
 * dengan `usernameCore`). Aplikasi memakainya lewat `referrals.ts`.
 *
 * Kenapa permanen: kode itu tertanam di setiap tautan yang sudah dibagikan —
 * di grup WhatsApp, bio Instagram, deskripsi video. Mengganti kode akan
 * memutus seluruh tautan lama tanpa pemiliknya sadar, dan melepas kode lama
 * membuka jalan bagi orang lain untuk mengambilnya lalu menerima komisi dari
 * promosi yang dikerjakan orang pertama.
 *
 * Penyimpanan:
 *   - `referralCodes/{KODE}` → `{ uid, createdAt }`. ID dokumen = kodenya,
 *     jadi keunikan dijamin `create()` di dalam transaksi.
 *   - `users/{uid}.referralCode` → salinan untuk pembacaan cepat.
 */
import type { Firestore } from "firebase-admin/firestore";
import { normalizeReferralCode, validateReferralCode } from "./referralRules";

export const REFERRAL_CODES = "referralCodes";

export type CreateCodeResult = { ok: true; code: string } | { ok: false; error: string };

export async function createReferralCodeFor(db: Firestore, uid: string, raw: unknown): Promise<CreateCodeResult> {
  const code = normalizeReferralCode(raw);
  const invalid = validateReferralCode(code);
  if (invalid) return { ok: false, error: invalid };

  const userRef = db.collection("users").doc(uid);
  const codeRef = db.collection(REFERRAL_CODES).doc(code);

  try {
    return await db.runTransaction(async (tx) => {
      const [userSnap, codeSnap] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);

      const punya = userSnap.get("referralCode");
      if (typeof punya === "string" && punya) {
        return { ok: false as const, error: `Anda sudah punya kode referral ${punya}. Kode tidak bisa diganti.` };
      }
      if (codeSnap.exists) return { ok: false as const, error: "Kode ini sudah dipakai orang lain." };

      tx.create(codeRef, { uid, createdAt: new Date().toISOString() });
      tx.set(userRef, { referralCode: code }, { merge: true });
      return { ok: true as const, code };
    });
  } catch (err) {
    // ALREADY_EXISTS: orang lain membuat kode yang sama tepat di antara baca dan komit.
    if ((err as { code?: unknown }).code === 6) return { ok: false, error: "Kode ini sudah dipakai orang lain." };
    throw err;
  }
}

/** Pemilik sebuah kode, atau null bila kodenya tidak ada / tidak sah. */
export async function referralOwnerOf(db: Firestore, raw: unknown): Promise<{ uid: string; code: string } | null> {
  const code = normalizeReferralCode(raw);
  if (validateReferralCode(code) !== null) return null;

  const snap = await db.collection(REFERRAL_CODES).doc(code).get();
  const uid = snap.get("uid");
  return typeof uid === "string" && uid ? { uid, code } : null;
}
