"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { flattenLessons, getCourse, type CourseDetail } from "@/lib/courses";
import {
  courseSnapshot,
  enrollmentRef,
  getEnrollment,
  isActive,
  type Enrollment,
} from "@/lib/enrollments";
import { getCurrentUser } from "@/lib/firebase/session";

export type EnrollResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; error: string };

/**
 * Membangun dokumen enrollment yang lengkap.
 *
 * Bentuknya sengaja sama persis untuk gratis, berbayar, dan pemberian admin —
 * hanya `source`, `orderId`, dan `pricePaid` yang berbeda. Dengan begitu
 * webhook Midtrans nanti menulis dokumen yang identik strukturnya dan tidak
 * ada migrasi yang perlu dijalankan.
 */
function newEnrollment(
  uid: string,
  course: CourseDetail,
  source: Enrollment["source"],
  pricePaid: number,
  orderId: string | null,
): Enrollment {
  const now = new Date().toISOString();

  return {
    uid,
    courseSlug: course.slug,
    status: "active",
    source,
    orderId,
    pricePaid,
    currency: "IDR",
    enrolledAt: now,
    expiresAt: null,
    completedLessons: [],
    quizScores: {},
    lastLessonSlug: null,
    lastAccessedAt: now,
    completedAt: null,
    certificateId: null,
    ...courseSnapshot(course),
  };
}

/**
 * Menulis enrollment dan menaikkan jumlah peserta sekaligus.
 *
 * Transaksi, bukan dua tulisan terpisah: tanpanya sebuah klik ganda akan
 * menghitung peserta yang sama dua kali. Mengembalikan false kalau pengguna
 * memang sudah terdaftar — memanggilnya lagi tidak berefek apa pun.
 */
async function writeEnrollment(enrollment: Enrollment): Promise<boolean> {
  const db = adminDb();
  const eRef = enrollmentRef(enrollment.uid, enrollment.courseSlug);
  const cRef = db.collection("courses").doc(enrollment.courseSlug);

  return db.runTransaction(async (tx) => {
    if ((await tx.get(eRef)).exists) return false;

    tx.set(eRef, enrollment);
    tx.update(cRef, { enrolledStudents: FieldValue.increment(1) });
    return true;
  });
}

/**
 * Mendaftar ke kursus gratis.
 *
 * Server Action bisa dipanggil lewat POST langsung, jadi harga TIDAK PERNAH
 * diterima dari klien — ia dibaca dari dokumen kursus di sini. Tanpa itu,
 * siapa pun bisa mendaftar gratis ke kursus berbayar hanya dengan memanggil
 * action ini sendiri.
 */
export async function enrollFree(slug: string): Promise<EnrollResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  if (course.price > 0) {
    return { ok: false, error: "Kursus ini berbayar. Pembayaran belum tersedia." };
  }

  const created = await writeEnrollment(newEnrollment(user.uid, course, "free", 0, null));

  revalidatePath(`/courses/${slug}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    slug,
    message: created ? "Berhasil terdaftar." : "Anda sudah terdaftar di kursus ini.",
  };
}

/**
 * Admin memberikan akses tanpa pembayaran.
 *
 * Role diperiksa di dalam action, bukan mengandalkan halaman pemanggilnya —
 * alasan yang sama seperti di courseActions.
 */
export async function grantEnrollment(uid: string, slug: string): Promise<EnrollResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat memberikan akses." };
  }

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  const created = await writeEnrollment(newEnrollment(uid, course, "granted", 0, null));

  revalidatePath(`/admin/users/${uid}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    slug,
    message: created ? "Akses diberikan." : "Pengguna sudah terdaftar di kursus ini.",
  };
}

/**
 * Menandai satu pelajaran selesai.
 *
 * Server Action bisa dipanggil lewat POST langsung, jadi akses diperiksa
 * ulang di sini — bukan mengandalkan tombolnya tidak dirender. Hanya
 * pengguna dengan enrollment aktif yang progresnya dilacak; pratinjau
 * admin/educator (yang tidak punya dokumen enrollment) ditolak di sini,
 * bukan hanya disembunyikan di UI.
 *
 * arrayUnion dipakai, bukan read-modify-write: idempoten di sisi server,
 * jadi klik ganda atau dua tab terbuka tidak bisa menghasilkan duplikat.
 */
export async function markLessonComplete(slug: string, lessonSlug: string): Promise<EnrollResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  const lessonExists = flattenLessons(course).some((l) => l.slug === lessonSlug);
  if (!lessonExists) return { ok: false, error: "Pelajaran tidak ditemukan." };

  const enrollment = await getEnrollment(user.uid, slug);
  if (!enrollment || !isActive(enrollment)) {
    return { ok: false, error: "Anda belum terdaftar di kursus ini." };
  }

  await enrollmentRef(user.uid, slug).update({
    completedLessons: FieldValue.arrayUnion(lessonSlug),
    lastLessonSlug: lessonSlug,
    lastAccessedAt: new Date().toISOString(),
  });

  revalidatePath(`/courses/${slug}/learn/${lessonSlug}`);
  revalidatePath("/dashboard");

  return { ok: true, slug, message: "Pelajaran ditandai selesai." };
}
