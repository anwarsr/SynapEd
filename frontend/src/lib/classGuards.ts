import "server-only";
import { getClass, getMembership, type Kelas } from "@/lib/classes";
import type { SessionUser } from "@/lib/firebase/session";

/**
 * Penjaga akses kelas.
 *
 * Dipisah dari classes.ts (data) dan classActions.ts (mutasi) karena keduanya
 * memakainya: halaman memanggilnya untuk memutuskan merender atau notFound(),
 * dan setiap Server Action memanggilnya lagi untuk memutuskan menulis atau
 * menolak. Server Action bisa dipanggil lewat POST langsung tanpa pernah
 * membuka halamannya, jadi pemeriksaan di halaman saja tidak menjaga apa pun.
 */

/**
 * Kelas yang boleh DIKELOLA pengguna ini, atau null.
 *
 * Admin lolos untuk kelas siapa pun — ia yang memoderasi. Bentuknya sengaja
 * meniru requireOwnedCourse: mengembalikan null, bukan melempar, supaya
 * pemanggilnya bebas memilih notFound() (di halaman) atau pesan galat (di
 * action).
 */
export async function requireOwnedClass(
  user: SessionUser,
  classId: string,
): Promise<Kelas | null> {
  if (user.role !== "admin" && user.role !== "educator") return null;

  const kelas = await getClass(classId);
  if (!kelas) return null;

  if (user.role !== "admin" && kelas.ownerUid !== user.uid) return null;
  return kelas;
}

export interface ClassAccess {
  kelas: Kelas;
  /** Pemilik kelas atau admin. Boleh memposting dan memoderasi. */
  isOwner: boolean;
  /** Punya dokumen keanggotaan. Pemilik TIDAK otomatis punya. */
  isMember: boolean;
}

/**
 * Kelas yang boleh DIBACA pengguna ini, atau null.
 *
 * Tiga pintu: pemilik, admin, dan anggota. Pemilik dicek lewat ownerUid dan
 * bukan lewat keanggotaan, karena ia tidak pernah "bergabung" ke kelasnya
 * sendiri — sama seperti educator pemilik kursus yang punya akses penuh tanpa
 * dokumen enrollment.
 */
export async function requireClassAccess(
  user: SessionUser,
  classId: string,
): Promise<ClassAccess | null> {
  const kelas = await getClass(classId);
  if (!kelas) return null;

  const isOwner = kelas.ownerUid === user.uid || user.role === "admin";
  const membership = await getMembership(user.uid, classId);

  if (!isOwner && !membership) return null;

  return { kelas, isOwner, isMember: membership !== null };
}
