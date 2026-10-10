import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { listMyEnrollments, type Enrollment } from "@/lib/enrollments";
import { listCourses } from "@/lib/courses";
import { listOwnedCourses } from "@/lib/educatorCourses";
import {
  getProfileStats,
  getUserProfile,
  joinedAtOf,
  type ProfileStats,
} from "@/lib/userProfile";
import { toRole, type Role } from "@/lib/roles";
import { getUsernameInfo } from "@/lib/usernames";
import { getBannerURL } from "@/lib/banner";
import type { EducatorCourseRow } from "@/lib/educatorCourses";
import type { ProfileContent } from "@/lib/profileTypes";

export interface PublicProfile {
  uid: string;
  name: string;
  username: string | null;
  photoURL: string | null;
  bannerURL: string | null;
  role: Role;
  content: ProfileContent;
  stats: ProfileStats;
  /** Bulan & tahun bergabung, mis. "Februari 2026". Kosong bila tak diketahui. */
  joinedAt: string;
  /** Hanya kursus yang tayang — lihat catatan di bawah. */
  courses: EducatorCourseRow[];
  /**
   * Kursus yang DIIKUTI, sudah dibersihkan (tanpa order, harga, nilai kuis,
   * sertifikat). `null` = tidak ditampilkan: akun admin, atau pengguna biasa yang
   * belum pernah menulis komentar publik. Lihat catatan privasi di bawah.
   */
  followed: Enrollment[] | null;
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
 *   - **Kursus yang DIIKUTI - kini DIPERBOLEHKAN, dengan batas.** Dulu sengaja
 *     disembunyikan (apa yang dipelajari seseorang bisa sangat pribadi). Atas
 *     permintaan pemilik proyek kini tampil di profil lengkap, TETAPI hanya untuk
 *     educator (tokoh publik) dan pengguna yang memang menulis komentar publik;
 *     tidak untuk admin; hanya kursus di katalog publik; dan tanpa data transaksi
 *     (order, harga, nilai kuis, sertifikat) - lihat `bersihkanEnrollment`.
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

  const pernahMengulas =
    role === "admin"
      ? false
      : !(await adminDb().collection("reviews").where("uid", "==", uid).limit(1).get()).empty;
  const bolehLihatDiikuti = role === "admin" ? false : isEducator || pernahMengulas;

  const [content, stats, owned, handle, bannerURL, diikuti, katalog] = await Promise.all([
    getUserProfile(uid),
    getProfileStats(uid, isEducator),
    isEducator ? listOwnedCourses(uid, akun.displayName ?? undefined) : Promise.resolve([]),
    getUsernameInfo(uid),
    getBannerURL(uid).catch(() => null),
    bolehLihatDiikuti ? listMyEnrollments(uid).catch(() => []) : Promise.resolve(null),
    bolehLihatDiikuti ? listCourses() : Promise.resolve([]),
  ]);

  const publik = new Set(katalog.map((c) => c.slug));

  return {
    uid,
    name: akun.displayName?.trim() || akun.email?.split("@")[0] || "Pengguna",
    username: handle.username,
    photoURL: akun.photoURL ?? null,
    bannerURL,
    role,
    content,
    stats,
    joinedAt: joinedAtOf(akun.metadata?.creationTime),
    // Kursus tersembunyi disaring DI SINI, bukan di komponen tampilan. Kalau
    // penyaringannya ada di JSX, satu tata letak baru yang lupa menyalinnya
    // langsung membocorkan draft yang belum disetujui admin.
    courses: owned.filter((c) => c.visibility === "public"),
    followed: diikuti
      ? diikuti
          .filter((e) => publik.has(e.courseSlug))
          .sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))
          .map(bersihkanEnrollment)
      : null,
  };
}

/** Hanya yang dibutuhkan kartu kursus + kemajuan; semua data transaksi dibuang. */
function bersihkanEnrollment(e: Enrollment): Enrollment {
  return {
    ...e,
    source: "free",
    orderId: null,
    pricePaid: 0,
    expiresAt: null,
    quizScores: {},
    certificateId: null,
    lastLessonSlug: null,
  };
}
