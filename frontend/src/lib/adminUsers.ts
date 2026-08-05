import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/firebase/session";

export interface AdminUserRow {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  photoURL: string | null;
  role: Role;
  phone: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  disabled: boolean;
}

function toRole(claims: Record<string, unknown> | undefined): Role {
  return claims?.role === "admin" ? "admin" : "user";
}

function toIso(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Daftar akun untuk panel admin.
 *
 * Memakai Admin SDK, yang melewati security rules — itulah sebabnya
 * firestore.rules bisa tetap seketat "pemilik saja" tanpa mengorbankan
 * fitur ini. Halaman admin dirender di server, jadi data ini tidak
 * pernah sampai ke browser pengguna biasa.
 *
 * listUsers() memberi maksimal 1000 akun per panggilan. Untuk skala saat ini
 * satu panggilan sudah cukup; kalau nanti melebihi itu, perlu paginasi
 * memakai pageToken.
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const { users } = await adminAuth().listUsers(1000);

  // Nomor HP hidup di Firestore, bukan di Auth — diambil sekaligus supaya
  // tidak ada N+1 pembacaan.
  const phones = new Map<string, string | null>();
  if (users.length) {
    const snap = await adminDb().collection("users").get();
    snap.forEach((d) => phones.set(d.id, (d.data().phone as string | null) ?? null));
  }

  return users
    .map((u) => ({
      uid: u.uid,
      name: u.displayName ?? u.email?.split("@")[0] ?? "Pengguna",
      email: u.email ?? "",
      emailVerified: u.emailVerified,
      photoURL: u.photoURL ?? null,
      role: toRole(u.customClaims),
      phone: phones.get(u.uid) ?? null,
      createdAt: toIso(u.metadata.creationTime),
      lastSignInAt: toIso(u.metadata.lastSignInTime),
      disabled: u.disabled,
    }))
    .sort((a, b) => {
      // Admin di atas, lalu yang terbaru mendaftar.
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
}

export async function getUser(uid: string): Promise<AdminUserRow | null> {
  const u = await adminAuth().getUser(uid).catch(() => null);
  if (!u) return null;

  const snap = await adminDb().collection("users").doc(uid).get();

  return {
    uid: u.uid,
    name: u.displayName ?? u.email?.split("@")[0] ?? "Pengguna",
    email: u.email ?? "",
    emailVerified: u.emailVerified,
    photoURL: u.photoURL ?? null,
    role: toRole(u.customClaims),
    phone: (snap.data()?.phone as string | null) ?? null,
    createdAt: toIso(u.metadata.creationTime),
    lastSignInAt: toIso(u.metadata.lastSignInTime),
    disabled: u.disabled,
  };
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}
