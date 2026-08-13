import "server-only";
import { redirect } from "next/navigation";
import { getCourse, type CourseDetail, type Lesson } from "@/lib/courses";
import { getEnrollment, isActive, type Enrollment } from "@/lib/enrollments";
import { getCurrentUser, type SessionUser } from "@/lib/firebase/session";

/**
 * Siapa boleh melihat apa di dalam sebuah kursus.
 *
 * Modul ini sengaja dibentuk seperti `session.ts`: satu fungsi yang membaca
 * keadaan tanpa mengalihkan (`getCourseAccess`) dan satu penjaga halaman yang
 * mengalihkan (`requireCourseAccess`). Pemisahannya penting — route handler
 * berkas dan Server Action butuh jawaban, bukan pengalihan.
 */

export type AccessLevel = "full" | "preview";

export type AccessReason = "admin" | "owner" | "enrolled" | "expired" | "not-enrolled";

export interface CourseAccess {
  user: SessionUser;
  course: CourseDetail;
  enrollment: Enrollment | null;
  level: AccessLevel;
  reason: AccessReason;
}

/** Kursus hasil migrasi tidak punya ownerUid, jadi field ini memang opsional. */
type OwnedCourse = CourseDetail & { ownerUid?: string };

/**
 * Tidak mengalihkan; `null` berarti belum masuk atau kursusnya tidak ada.
 * Pemanggilnya yang memutuskan apa artinya.
 */
export async function getCourseAccess(slug: string): Promise<CourseAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const course = await getCourse(slug);
  if (!course) return null;

  const decide = (level: AccessLevel, reason: AccessReason, enrollment: Enrollment | null) =>
    ({ user, course, enrollment, level, reason }) satisfies CourseAccess;

  // Admin melihat segalanya — panel admin memang bertugas meninjau isi kursus.
  if (user.role === "admin") return decide("full", "admin", null);

  // Educator wajib bisa membuka kursus buatannya sendiri tanpa mendaftar.
  // Kursus bawaan tidak punya ownerUid, jadi undefined !== uid sudah benar.
  if ((course as OwnedCourse).ownerUid === user.uid) return decide("full", "owner", null);

  const enrollment = await getEnrollment(user.uid, slug);
  if (!enrollment) return decide("preview", "not-enrolled", null);
  if (!isActive(enrollment)) return decide("preview", "expired", enrollment);

  return decide("full", "enrolled", enrollment);
}

/**
 * Penjaga halaman belajar.
 *
 * Belum masuk -> /login dengan ?next=, sama seperti requireUser. Kursus tidak
 * ada -> /courses, bukan notFound(), supaya pengguna mendarat di katalog
 * alih-alih halaman buntu.
 */
export async function requireCourseAccess(slug: string, next?: string): Promise<CourseAccess> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");

  const access = await getCourseAccess(slug);
  if (!access) redirect("/courses");

  return access;
}

/**
 * Boleh membuka satu pelajaran tertentu?
 *
 * Predikat murni tanpa I/O supaya bisa dipanggil di mana saja — termasuk saat
 * merender sidebar untuk menentukan pelajaran mana yang bergembok.
 *
 * Baris kedua inilah yang akhirnya menegakkan `lesson.free`: flag itu sudah
 * ada di data sejak migrasi, tetapi belum pernah dibaca oleh kode mana pun.
 */
export function canViewLesson(access: CourseAccess, lesson: Lesson): boolean {
  return access.level === "full" || lesson.free === true;
}
