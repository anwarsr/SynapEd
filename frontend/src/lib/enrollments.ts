import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { flattenLessons, type CourseDetail } from "@/lib/courses";

export const ENROLLMENTS = "enrollments";

/**
 * Pendaftaran seorang pengguna pada satu kursus.
 *
 * Koleksi ini tertutup rapat dari klien (`allow read, write: if false`) —
 * seluruh alurnya berjalan lewat Server Action dengan Admin SDK, persis
 * seperti `educatorApplications`. Tidak ada satu pun pembacaan dari browser,
 * jadi tidak ada yang perlu dilonggarkan di rules.
 */
export interface Enrollment {
  uid: string;
  courseSlug: string;

  status: "active" | "completed";

  /**
   * Dari mana akses ini datang. Sudah disiapkan sekarang supaya webhook
   * pembayaran nanti menulis dokumen yang bentuknya sama persis — tidak ada
   * migrasi yang perlu dijalankan saat Midtrans dipasang.
   */
  source: "free" | "paid" | "granted";
  orderId: string | null;
  pricePaid: number;
  currency: "IDR";

  /** ISO — disimpan sebagai string supaya aman melintasi batas server->klien. */
  enrolledAt: string;
  /** null berarti akses selamanya. */
  expiresAt: string | null;

  /**
   * Slug pelajaran yang sudah diselesaikan.
   *
   * Sengaja array di dokumen ini, bukan subcollection: sidebar halaman belajar
   * merender SEMUA pelajaran beserta tanda centangnya setiap kali halaman
   * dimuat. Subcollection berarti satu query per tampilan halaman; array ikut
   * gratis di dalam dokumen yang toh sudah harus dibaca untuk kontrol akses.
   *
   * Ditulis dengan arrayUnion, tidak pernah read-modify-write — arrayUnion
   * idempoten di sisi server, jadi klik ganda dan dua tab terbuka tidak bisa
   * menghasilkan duplikat.
   */
  completedLessons: string[];
  /** lessonSlug -> nilai terbaik dalam persen. */
  quizScores: Record<string, number>;

  lastLessonSlug: string | null;
  lastAccessedAt: string;
  completedAt: string | null;
  certificateId: string | null;

  /**
   * Salinan tampilan kursus.
   *
   * Ada supaya "Kursus Saya" di dashboard dirender dari satu query dan NOL
   * pembacaan dokumen kursus. Bukan sumber kebenaran — ia disegarkan setiap
   * kali pengguna menandai pelajaran selesai, jadi hanya bisa basi bagi murid
   * yang tidak pernah maju sama sekali.
   */
  courseTitle: string;
  courseIcon: string;
  courseTint: string;
  courseLevel: string;
  courseLevelColor: string;
  lessonsTotal: number;
}

/**
 * Document ID = `{uid}_{slug}`.
 *
 * ID yang bisa dihitung, bukan auto-ID, karena itulah yang membuat webhook
 * pembayaran nanti idempoten tanpa transaksi: Midtrans mengirim ulang
 * notifikasi saat retry dan bisa datang tidak berurutan, dan `set(..., {merge})`
 * pada ID tetap aman dijalankan berapa kali pun.
 *
 * Aman dipisah di `_` pertama: UID Firebase 28 karakter alfanumerik tanpa
 * garis bawah, dan `toSlug()` hanya menghasilkan [a-z0-9-].
 */
export function enrollmentId(uid: string, courseSlug: string): string {
  return `${uid}_${courseSlug}`;
}

export function enrollmentRef(uid: string, courseSlug: string) {
  return adminDb().collection(ENROLLMENTS).doc(enrollmentId(uid, courseSlug));
}

/** Potongan tampilan kursus yang ikut disimpan di dokumen enrollment. */
export function courseSnapshot(course: CourseDetail) {
  return {
    courseTitle: course.title,
    courseIcon: course.icon,
    courseTint: course.tint,
    courseLevel: course.level,
    courseLevelColor: course.levelColor,
    lessonsTotal: course.lessonsCount,
  };
}

/** Satu pembacaan langsung — tanpa query, tanpa indeks. */
export async function getEnrollment(
  uid: string,
  courseSlug: string,
): Promise<Enrollment | null> {
  const doc = await enrollmentRef(uid, courseSlug).get();
  return doc.exists ? (doc.data() as Enrollment) : null;
}

/** Kursus yang diikuti seorang pengguna, yang terakhir dibuka di atas. */
export async function listMyEnrollments(uid: string): Promise<Enrollment[]> {
  const snap = await adminDb()
    .collection(ENROLLMENTS)
    .where("uid", "==", uid)
    .orderBy("lastAccessedAt", "desc")
    .get();

  return snap.docs.map((d) => d.data() as Enrollment);
}

/** Peserta sebuah kursus — dipakai educator & admin. */
export async function listCourseEnrollments(courseSlug: string): Promise<Enrollment[]> {
  const snap = await adminDb()
    .collection(ENROLLMENTS)
    .where("courseSlug", "==", courseSlug)
    .orderBy("enrolledAt", "desc")
    .get();

  return snap.docs.map((d) => d.data() as Enrollment);
}

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

/**
 * Kemajuan belajar, selalu dihitung terhadap kurikulum yang HIDUP.
 *
 * Irisan dengan daftar pelajaran saat ini bukan detail: begitu educator bisa
 * menghapus pelajaran, `completedLessons.length / total` yang naif akan
 * merender 110%. Sama alasannya dengan `lessonsCount` yang tidak pernah
 * disimpan — angka turunan yang ditulis ke database pasti melenceng.
 */
export function progressOf(course: CourseDetail, enrollment: Enrollment | null): Progress {
  const total = course.lessonsCount;
  if (!enrollment) return { done: 0, total, percent: 0 };

  const current = new Set(flattenLessons(course).map((l) => l.slug));
  const done = enrollment.completedLessons.filter((slug) => current.has(slug)).length;

  return {
    done,
    total: current.size,
    percent: current.size === 0 ? 0 : Math.round((done / current.size) * 100),
  };
}

/** Kemajuan dari snapshot saja — untuk dashboard, tanpa membaca dokumen kursus. */
export function progressFromSnapshot(enrollment: Enrollment): Progress {
  const total = enrollment.lessonsTotal;
  const done = Math.min(enrollment.completedLessons.length, total);

  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Masih berlaku? `expiresAt` null berarti selamanya. */
export function isActive(enrollment: Enrollment, now = new Date()): boolean {
  if (enrollment.expiresAt === null) return true;
  return new Date(enrollment.expiresAt) > now;
}
