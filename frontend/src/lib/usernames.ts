import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { claimUsername, type ClaimResult } from "@/lib/usernameCore";

/**
 * Memastikan akun punya username. Dipanggil setiap kali sesi dibuat, jadi
 * seluruh cara masuk — daftar dengan email, login, Google — melewatinya.
 */
export async function ensureUsername(uid: string): Promise<ClaimResult> {
  const akun = await adminAuth().getUser(uid);
  return claimUsername(adminDb(), uid, akun.email);
}

export interface UsernameInfo {
  username: string | null;
  /** ISO, atau null kalau username masih buatan otomatis. */
  changedAt: string | null;
}

export async function getUsernameInfo(uid: string): Promise<UsernameInfo> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const username = snap.get("username");
  const changedAt = snap.get("usernameChangedAt");
  return {
    username: typeof username === "string" && username ? username : null,
    changedAt: typeof changedAt === "string" && changedAt ? changedAt : null,
  };
}

/** uid -> username untuk banyak akun sekaligus; yang belum punya tidak dimuat. */
export async function getUsernames(uids: readonly string[]): Promise<Map<string, string>> {
  const unik = Array.from(new Set(uids.filter(Boolean)));
  const hasil = new Map<string, string>();
  if (unik.length === 0) return hasil;

  const db = adminDb();
  const snaps = await db.getAll(...unik.map((uid) => db.collection("users").doc(uid)));
  for (const s of snaps) {
    const u = s.get("username");
    if (typeof u === "string" && u) hasil.set(s.id, u);
  }
  return hasil;
}
