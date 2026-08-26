"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { flattenLessons, getCourse } from "@/lib/courses";
import {
  enrollmentRef,
  getEnrollment,
  isActive,
  newEnrollment,
  writeEnrollment,
} from "@/lib/enrollments";
import { getCurrentUser } from "@/lib/firebase/session";
import { getQuiz } from "@/lib/quiz";
import { issueCertificateIfComplete } from "@/lib/certificates";

export type EnrollResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; error: string };

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
  revalidatePath("/profil");

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
  revalidatePath("/profil");

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

  const lesson = flattenLessons(course).find((l) => l.slug === lessonSlug);
  if (!lesson) return { ok: false, error: "Pelajaran tidak ditemukan." };

  // Pelajaran kuis yang sudah punya soal hanya bisa selesai lewat submitQuiz
  // (dan hanya kalau lulus) — bukan lewat tombol tandai-selesai generik ini.
  // Diperiksa di server, bukan cuma disembunyikan di UI, supaya tidak bisa
  // dilewati dengan memanggil action ini langsung. Kuis yang belum punya
  // soal (mis. kursus hasil migrasi) tetap boleh lewat jalur ini — itulah
  // jalan mundur yang menjaga kursus lama tetap berfungsi tanpa migrasi.
  if (lesson.type === "quiz" && (await getQuiz(slug, lessonSlug))) {
    return { ok: false, error: "Selesaikan pelajaran ini lewat kuis, bukan tombol ini." };
  }

  const enrollment = await getEnrollment(user.uid, slug);
  if (!enrollment || !isActive(enrollment)) {
    return { ok: false, error: "Anda belum terdaftar di kursus ini." };
  }

  const now = new Date().toISOString();
  // Simulasi union yang sama dengan arrayUnion di server — lihat komentar
  // serupa di quizActions.ts submitQuiz.
  const finalCompletedLessons = Array.from(new Set([...enrollment.completedLessons, lessonSlug]));

  await enrollmentRef(user.uid, slug).update({
    completedLessons: FieldValue.arrayUnion(lessonSlug),
    lastLessonSlug: lessonSlug,
    lastAccessedAt: now,
  });

  await issueCertificateIfComplete(user, course, enrollment, finalCompletedLessons);

  revalidatePath(`/courses/${slug}/learn/${lessonSlug}`);
  revalidatePath("/profil");

  return { ok: true, slug, message: "Pelajaran ditandai selesai." };
}
