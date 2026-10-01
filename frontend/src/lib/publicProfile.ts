import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import { listOwnedCourses } from "@/lib/educatorCourses";
import {
  getProfileStats,
  getUserProfile,
  joinedAtOf,
  type ProfileStats,
} from "@/lib/userProfile";
import { toRole, type Role } from "@/lib/roles";
import { getUsernameInfo } from "@/lib/usernames";
import type { EducatorCourseRow } from "@/lib/educatorCourses";
import type { ProfileContent } from "@/lib/profileTypes";

export interface PublicProfile {
  uid: string;
  name: string;
  username: string | null;
  photoURL: string | null;
  role: Role;
  content: ProfileContent;
  stats: ProfileStats;
  /** Bulan & tahun bergabung, mis. "Februari 2026". Kosong bila tak diketahui. */
  joinedAt: string;
  /** Hanya kursus yang tayang — lihat catatan di bawah. */
  courses: EducatorCourseRow[];
}

/**
 * Profil seseorang sebagaimana dilihat orang lain.
 *
 * Tiga hal SENGAJA tidak ikut, dan ketiganya keputusan privasi, bukan
 * kelalaian:
 *
 *   - **Email.** Alamat kontak pribadi. Menyiarkannya di halaman publik
 *     mengubah profil menjadi panen alamat untuk spam.
 *   - **Nomor telepon.** Alasan yang sama; ia memang ditaruh di Pengaturan,
 *     bukan di profil.
 *   - **Kursus yang DIIKUTI.** Apa yang sedang dipelajari seseorang bisa
 *     sangat pribadi — "Trik Jitu Lolos Seleksi Manager" memberi tahu dunia
 *     bahwa orang itu sedang melamar kerja. Yang tampil hanya kursus yang ia
 *     AJARKAN, karena itu memang ditujukan untuk umum.
 *
 * `null` berarti akunnya tidak ada — pemanggilnya yang memutuskan itu 404.
 */
export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const akun = await adminAuth()
    .getUser(uid)
    .catch(() => null);
  if (!akun) return null;

  const role = toRole(akun.customClaims?.role);
  const isEducator = role === "educator" || role === "admin";

  const [content, stats, owned, handle] = await Promise.all([
    getUserProfile(uid),
    getProfileStats(uid, isEducator),
    isEducator ? listOwnedCourses(uid, akun.displayName ?? undefined) : Promise.resolve([]),
    getUsernameInfo(uid),
  ]);

  return {
    uid,
    name: akun.displayName?.trim() || akun.email?.split("@")[0] || "Pengguna",
    username: handle.username,
    photoURL: akun.photoURL ?? null,
    role,
    content,
    stats,
    joinedAt: joinedAtOf(akun.metadata?.creationTime),
    // Kursus tersembunyi disaring DI SINI, bukan di komponen tampilan. Kalau
    // penyaringannya ada di JSX, satu tata letak baru yang lupa menyalinnya
    // langsung membocorkan draft yang belum disetujui admin.
    courses: owned.filter((c) => c.visibility === "public"),
  };
}
