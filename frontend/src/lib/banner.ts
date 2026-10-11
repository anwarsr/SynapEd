import "server-only";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Banner profil — gambar sampul di atas profil seseorang.
 *
 * Disimpan sebagai URL unduhan Firebase Storage di `users/{uid}.bannerURL`.
 * Berkasnya sendiri selalu `avatars/{uid}/banner.jpg` (satu nama tetap, hasil
 * kompresi di browser), jadi mengganti banner menimpa yang lama dan tak ada
 * sisa berkas. Memakai folder `avatars/{uid}/` supaya aturan tulis yang sudah
 * ter-deploy (storage.rules) berlaku tanpa perubahan.
 *
 * `null` = belum punya banner: tampilan memakai bawaan hitam, sama dengan foto
 * profil bawaan.
 */

const HOST = "https://firebasestorage.googleapis.com/";

/** Hanya URL Firebase Storage yang diterima; selain itu dianggap tak ada. */
export function cleanBannerURL(raw: unknown): string | null {
  return typeof raw === "string" && raw.startsWith(HOST) && raw.length <= 900 ? raw : null;
}

export async function getBannerURL(uid: string): Promise<string | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return cleanBannerURL(snap.get("bannerURL"));
}

/** Banner banyak akun sekaligus (satu getAll) — dipakai kartu ulasan di beranda. */
export async function getBannerURLs(uids: string[]): Promise<Record<string, string | null>> {
  const unik = [...new Set(uids.filter(Boolean))];
  if (unik.length === 0) return {};

  const db = adminDb();
  const snaps = await db.getAll(...unik.map((u) => db.collection("users").doc(u)));

  const out: Record<string, string | null> = {};
  snaps.forEach((s, i) => {
    out[unik[i]] = cleanBannerURL(s.get("bannerURL"));
  });
  return out;
}
