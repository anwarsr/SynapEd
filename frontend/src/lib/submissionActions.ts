"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getCurrentUser } from "@/lib/firebase/session";
import { getCourse, flattenLessons } from "@/lib/courses";
import { enrollmentRef, getEnrollment, isActive } from "@/lib/enrollments";
import { issueCertificateIfComplete } from "@/lib/certificates";
import { requireOwnedCourse } from "@/lib/educatorCourses";
import { deleteObjects } from "@/lib/storageCleanup";
import { SUBMISSION_FILES } from "@/lib/storagePaths";
import {
  getSubmission,
  MAX_FEEDBACK,
  submissionId,
  submissionRef,
  type Submission,
} from "@/lib/submissions";

export type SubmissionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Pengumpulan tugas peserta dan penilaiannya oleh educator.
 *
 * Dua penjaga yang menopang seluruh gunanya:
 *
 *   1. Yang MENGUMPULKAN harus peserta aktif kursus itu, dan berkasnya harus
 *      berada di foldernya sendiri. Tanpa syarat kedua, satu panggilan mentah
 *      bisa menautkan berkas milik orang lain ke pengumpulan sendiri.
 *   2. Yang MENILAI harus pemilik kursus atau admin. Kalau longgar, peserta
 *      bisa memberi nilai 100 pada dirinya sendiri lalu menarik sertifikat
 *      tanpa pernah dikoreksi siapa pun.
 */

function clean(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

// ── Peserta ───────────────────────────────────────────────────────────

/**
 * Mengumpulkan (atau mengumpulkan ULANG) berkas tugas.
 *
 * Mengumpulkan sekaligus menandai pelajarannya selesai — satu tindakan, bukan
 * dua. Sertifikatnya tetap tertahan sampai educator menilai; itu penjaga
 * terpisah di issueCertificateIfComplete().
 */
export async function submitAssignment(
  courseSlug: string,
  lessonSlug: string,
  filePath: string,
  fileName: string,
  fileSize: number,
): Promise<SubmissionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await getCourse(courseSlug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  const lesson = flattenLessons(course).find((l) => l.slug === lessonSlug);
  if (!lesson) return { ok: false, error: "Pelajaran tidak ditemukan." };
  if (lesson.type !== "assignment" && lesson.type !== "quiz") {
    return { ok: false, error: "Pelajaran ini tidak menerima pengumpulan tugas." };
  }

  const enrollment = await getEnrollment(user.uid, courseSlug);
  if (!enrollment || !isActive(enrollment)) {
    return { ok: false, error: "Anda belum terdaftar di kursus ini." };
  }

  const path = clean(filePath, 500);
  if (!path.startsWith(`${SUBMISSION_FILES}/${user.uid}/`)) {
    return { ok: false, error: "Berkas tugas tidak sah." };
  }

  const id = submissionId(user.uid, courseSlug, lessonSlug);
  const lama = await getSubmission(id);
  const now = new Date().toISOString();

  const doc: Submission = {
    id,
    uid: user.uid,
    studentName: user.name,
    studentEmail: user.email,
    courseSlug,
    lessonSlug,
    lessonTitle: lesson.title,
    filePath: path,
    fileName: clean(fileName, 200) || "berkas",
    fileSize: Number.isFinite(fileSize) && fileSize > 0 ? Math.round(fileSize) : 0,
    // Mengumpulkan ulang MENGHAPUS nilai lama. Nilai yang menempel pada berkas
    // yang sudah diganti tidak berarti apa-apa, dan membiarkannya membuat
    // educator mengira tugas ini sudah selesai dikoreksi.
    status: "submitted",
    grade: null,
    feedback: null,
    submittedAt: now,
    gradedAt: null,
    gradedByUid: null,
    gradedByName: null,
  };

  await submissionRef(id).set(doc);

  // Berkas lama dibuang SETELAH yang baru tercatat — kalau urutannya dibalik
  // dan penulisannya gagal, peserta kehilangan berkas tanpa punya penggantinya.
  if (lama && lama.filePath && lama.filePath !== path) {
    await deleteObjects([lama.filePath]).catch(() => undefined);
  }

  // arrayUnion: idempoten di server, jadi mengumpulkan ulang tidak menggandakan.
  await enrollmentRef(user.uid, courseSlug).update({
    completedLessons: FieldValue.arrayUnion(lessonSlug),
    lastLessonSlug: lessonSlug,
    lastAccessedAt: now,
  });

  revalidatePath(`/courses/${courseSlug}/learn/${lessonSlug}`);
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/profil");
  revalidatePath(`/educator/courses/${courseSlug}/students`);

  return {
    ok: true,
    message: lama ? "Tugas diganti. Menunggu dinilai ulang." : "Tugas terkumpul. Menunggu dinilai.",
  };
}

// ── Educator ──────────────────────────────────────────────────────────

/**
 * Memberi nilai pada satu pengumpulan.
 *
 * Hanya pemilik kursus atau admin. requireOwnedCourse() sudah memperlakukan
 * admin sebagai pemilik, jadi tidak ada cabang peran terpisah di sini.
 */
export async function gradeSubmission(
  id: string,
  gradeRaw: number,
  feedbackRaw: string,
): Promise<SubmissionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const submission = await getSubmission(id);
  if (!submission) return { ok: false, error: "Pengumpulan tidak ditemukan." };

  const course = await requireOwnedCourse(user, submission.courseSlug);
  if (!course) return { ok: false, error: "Anda tidak berhak menilai kursus ini." };

  const grade = Math.round(Number(gradeRaw));
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
    return { ok: false, error: "Nilai harus antara 0 sampai 100." };
  }

  const now = new Date().toISOString();
  await submissionRef(id).update({
    status: "graded",
    grade,
    feedback: clean(feedbackRaw, MAX_FEEDBACK) || null,
    gradedAt: now,
    gradedByUid: user.uid,
    gradedByName: user.name,
  });

  // Penilaian adalah GERBANG TERAKHIR sertifikat.
  //
  // Mengumpulkan tugas menandai pelajarannya selesai, tetapi sertifikat
  // tertahan sampai dinilai — jadi kalau pemicunya hanya ada di
  // markLessonComplete, peserta yang tugasnya adalah pelajaran terakhir
  // TIDAK akan pernah menerima sertifikatnya. Di sinilah pemeriksaan itu
  // harus dijalankan ulang.
  //
  // Seluruh syaratnya diperiksa ulang di dalam issueCertificateIfComplete
  // (pelajaran lengkap, semua tugas dinilai dan lulus), jadi memanggilnya
  // di sini aman walau nilainya di bawah batas.
  const enrollment = await getEnrollment(submission.uid, submission.courseSlug);
  if (enrollment) {
    await issueCertificateIfComplete(
      { uid: submission.uid, name: submission.studentName },
      course,
      enrollment,
      enrollment.completedLessons,
    );
  }

  revalidatePath(`/educator/courses/${submission.courseSlug}/students`);
  revalidatePath(`/courses/${submission.courseSlug}/learn/${submission.lessonSlug}`);
  revalidatePath("/profil");

  return { ok: true, message: `Nilai ${grade} tersimpan.` };
}
