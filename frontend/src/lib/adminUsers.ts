import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { roleRank, toRole, type Role } from "@/lib/roles";

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
  /** Ada lamaran educator yang belum diputuskan — dipakai sebagai penanda. */
  pendingApplication: boolean;
}

function toIso(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Uid yang punya lamaran educator berstatus pending. */
async function pendingUids(): Promise<Set<string>> {
  const snap = await adminDb()
    .collection("educatorApplications")
    .where("status", "==", "pending")
    .get();
  return new Set(snap.docs.map((d) => d.id));
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

  // Nomor HP dan status lamaran hidup di Firestore, bukan di Auth. Keduanya
  // diambil sekali untuk semua akun supaya tidak ada N+1 pembacaan.
  const phones = new Map<string, string | null>();
  let pending = new Set<string>();

  if (users.length) {
    const [profiles, applied] = await Promise.all([
      adminDb().collection("users").get(),
      pendingUids(),
    ]);
    profiles.forEach((d) => phones.set(d.id, (d.data().phone as string | null) ?? null));
    pending = applied;
  }

  return users
    .map((u) => ({
      uid: u.uid,
      name: u.displayName ?? u.email?.split("@")[0] ?? "Pengguna",
      email: u.email ?? "",
      emailVerified: u.emailVerified,
      photoURL: u.photoURL ?? null,
      role: toRole(u.customClaims?.role),
      phone: phones.get(u.uid) ?? null,
      createdAt: toIso(u.metadata.creationTime),
      lastSignInAt: toIso(u.metadata.lastSignInTime),
      disabled: u.disabled,
      pendingApplication: pending.has(u.uid),
    }))
    .sort((a, b) => {
      // Yang menunggu keputusan naik paling atas — itu yang butuh tindakan.
      if (a.pendingApplication !== b.pendingApplication) return a.pendingApplication ? -1 : 1;
      if (a.role !== b.role) return roleRank[a.role] - roleRank[b.role];
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
}

export async function getUser(uid: string): Promise<AdminUserRow | null> {
  const u = await adminAuth().getUser(uid).catch(() => null);
  if (!u) return null;

  const [profile, application] = await Promise.all([
    adminDb().collection("users").doc(uid).get(),
    adminDb().collection("educatorApplications").doc(uid).get(),
  ]);

  return {
    uid: u.uid,
    name: u.displayName ?? u.email?.split("@")[0] ?? "Pengguna",
    email: u.email ?? "",
    emailVerified: u.emailVerified,
    photoURL: u.photoURL ?? null,
    role: toRole(u.customClaims?.role),
    phone: (profile.data()?.phone as string | null) ?? null,
    createdAt: toIso(u.metadata.creationTime),
    lastSignInAt: toIso(u.metadata.lastSignInTime),
    disabled: u.disabled,
    pendingApplication: application.data()?.status === "pending",
  };
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * Tanggal saja, tanpa jam.
 *
 * Dipakai figur di kartu: "8 September 2026 pukul 19.13" membuat baris
 * angka yang seharusnya terbaca sekilas jadi kalimat panjang, dan jamnya
 * tidak pernah menjadi informasi yang dicari di sana.
 */
export function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(iso));
}
