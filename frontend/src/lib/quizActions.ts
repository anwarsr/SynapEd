"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { flattenLessons, getCourse } from "@/lib/courses";
import { requireOwnedCourse } from "@/lib/educatorCourses";
import { enrollmentRef, getEnrollment, isActive, type Enrollment } from "@/lib/enrollments";
import { issueCertificateIfComplete } from "@/lib/certificates";
import { getQuiz, quizRef, type QuizDoc, type QuizOption, type QuizQuestion } from "@/lib/quiz";

export type QuizEditResult = { ok: true; message: string } | { ok: false; error: string };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function shortId(): string {
  return randomBytes(4).toString("hex");
}

export interface QuizOptionInput {
  id?: string;
  text: string;
}

export interface QuizQuestionInput {
  id?: string;
  prompt: string;
  options: QuizOptionInput[];
  correctOptionId: string;
  explanation: string;
  points: number;
}

export interface QuizInput {
  passingScore: number;
  maxAttempts: number;
  questions: QuizQuestionInput[];
}

/** Untuk panel editor educator — mengembalikan dokumen APA ADANYA (dengan jawaban benar). */
export async function loadQuizForEditor(
  courseSlug: string,
  lessonSlug: string,
): Promise<{ ok: true; quiz: QuizDoc | null } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await requireOwnedCourse(user, courseSlug);
  if (!course) return { ok: false, error: "Anda tidak berhak melihat kuis ini." };

  return { ok: true, quiz: await getQuiz(courseSlug, lessonSlug) };
}

/**
 * Menyimpan kuis — penggantian penuh per lessonSlug, dokumen terpisah dari
 * `saveCurriculum` karena memang hidup di subcollection yang berbeda.
 *
 * Server Action bisa dipanggil lewat POST langsung, jadi kepemilikan
 * diperiksa ulang di sini lewat requireOwnedCourse.
 */
export async function saveQuiz(courseSlug: string, lessonSlug: string, input: QuizInput): Promise<QuizEditResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await requireOwnedCourse(user, courseSlug);
  if (!course) return { ok: false, error: "Anda tidak berhak menyunting kursus ini." };

  const lesson = flattenLessons(course).find((l) => l.slug === lessonSlug);
  if (!lesson) return { ok: false, error: "Pelajaran tidak ditemukan." };
  if (lesson.type !== "quiz") return { ok: false, error: "Pelajaran ini bukan bertipe kuis." };

  if (input.questions.length === 0) return { ok: false, error: "Kuis minimal punya satu soal." };
  if (input.questions.length > 50) return { ok: false, error: "Maksimal 50 soal per kuis." };

  const passingScore = clampInt(input.passingScore, 0, 100, 70);
  const maxAttempts = clampInt(input.maxAttempts, 0, 20, 3);

  const questions: QuizQuestion[] = [];
  for (const [qi, q] of input.questions.entries()) {
    const prompt = q.prompt.trim().slice(0, 500);
    if (!prompt) return { ok: false, error: `Soal ke-${qi + 1} belum punya pertanyaan.` };
    if (q.options.length < 2) return { ok: false, error: `Soal "${prompt}" minimal punya dua pilihan.` };
    if (q.options.length > 8) return { ok: false, error: `Soal "${prompt}" maksimal delapan pilihan.` };

    const options: QuizOption[] = q.options.map((o) => ({
      id: o.id?.trim() || shortId(),
      text: o.text.trim().slice(0, 300),
    }));
    if (options.some((o) => !o.text)) return { ok: false, error: `Ada pilihan kosong pada soal "${prompt}".` };
    if (!options.some((o) => o.id === q.correctOptionId)) {
      return { ok: false, error: `Jawaban benar belum dipilih untuk soal "${prompt}".` };
    }

    questions.push({
      id: q.id?.trim() || shortId(),
      prompt,
      options,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation.trim().slice(0, 1000),
      points: clampInt(q.points, 1, 100, 10),
    });
  }

  const doc: QuizDoc = {
    courseSlug,
    lessonSlug,
    passingScore,
    maxAttempts,
    questions,
    updatedAt: new Date().toISOString(),
  };

  await quizRef(courseSlug, lessonSlug).set(doc);

  revalidatePath(`/courses/${courseSlug}/learn/${lessonSlug}`);

  return { ok: true, message: "Kuis tersimpan." };
}

export type QuizSubmitResult =
  | {
      ok: true;
      passed: boolean;
      score: number;
      attemptsLeft: number | null;
      perQuestion: { id: string; correct: boolean; explanation: string | null }[];
    }
  | { ok: false; error: string };

/**
 * Menilai satu percobaan kuis.
 *
 * Kepemilikan enrollment diperiksa langsung (enrollment aktif), bukan lewat
 * getCourseAccess — enrollment aktif SUDAH berarti akses penuh (persis pola
 * markLessonComplete di enrollmentActions.ts), jadi tidak perlu pembacaan
 * ganda. Pratinjau admin/pemilik tanpa enrollment tidak bisa mengerjakan
 * kuis di sini karena memang tidak ada dokumen enrollment untuk dicatat
 * progresnya — itu konsisten dengan `canTrackProgress` di halaman belajar.
 */
export async function submitQuiz(
  courseSlug: string,
  lessonSlug: string,
  answers: Record<string, string>,
): Promise<QuizSubmitResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await getCourse(courseSlug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  const lesson = flattenLessons(course).find((l) => l.slug === lessonSlug);
  if (!lesson) return { ok: false, error: "Pelajaran tidak ditemukan." };

  const enrollment = await getEnrollment(user.uid, courseSlug);
  if (!enrollment || !isActive(enrollment)) {
    return { ok: false, error: "Anda belum terdaftar di kursus ini." };
  }

  const quiz = await getQuiz(courseSlug, lessonSlug);
  if (!quiz) return { ok: false, error: "Kuis tidak ditemukan." };

  let earned = 0;
  let total = 0;
  const graded = quiz.questions.map((q) => {
    total += q.points;
    const correct = answers[q.id] === q.correctOptionId;
    if (correct) earned += q.points;
    return { id: q.id, correct, explanation: q.explanation };
  });
  const score = total === 0 ? 0 : Math.round((earned / total) * 100);
  const passed = score >= quiz.passingScore;

  const now = new Date().toISOString();
  const eRef = enrollmentRef(user.uid, courseSlug);
  const attemptsCollection = eRef.collection("quizAttempts");

  let attemptsUsedBefore = 0;
  let finalCompletedLessons: string[] = enrollment.completedLessons;

  try {
    await adminDb().runTransaction(async (tx) => {
      const attemptsQuery = attemptsCollection.where("lessonSlug", "==", lessonSlug);
      const [eSnap, attemptsSnap] = await Promise.all([tx.get(eRef), tx.get(attemptsQuery)]);

      attemptsUsedBefore = attemptsSnap.size;
      if (quiz.maxAttempts > 0 && attemptsUsedBefore >= quiz.maxAttempts) {
        throw new Error("ATTEMPTS_EXCEEDED");
      }

      const current = eSnap.data() as Enrollment;
      const bestScore = Math.max(current.quizScores?.[lessonSlug] ?? 0, score);

      // arrayUnion di server memutuskan array FINAL yang sesungguhnya; ini
      // cuma simulasi di memori (union yang sama) supaya issueCertificateIfComplete
      // tidak perlu baca ulang Firestore setelah commit.
      finalCompletedLessons = passed
        ? Array.from(new Set([...current.completedLessons, lessonSlug]))
        : current.completedLessons;

      tx.set(attemptsCollection.doc(), { lessonSlug, score, passed, answeredAt: now });

      const update: Record<string, unknown> = {
        [`quizScores.${lessonSlug}`]: bestScore,
        lastLessonSlug: lessonSlug,
        lastAccessedAt: now,
      };
      if (passed) update.completedLessons = FieldValue.arrayUnion(lessonSlug);
      tx.update(eRef, update);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ATTEMPTS_EXCEEDED") {
      return { ok: false, error: "Percobaan untuk kuis ini sudah habis." };
    }
    throw e;
  }

  const attemptsUsedAfter = attemptsUsedBefore + 1;
  const attemptsLeft = quiz.maxAttempts === 0 ? null : Math.max(0, quiz.maxAttempts - attemptsUsedAfter);
  // Penjelasan hanya dibuka kalau lulus atau percobaannya sudah habis — bukan
  // di setiap percobaan, supaya soal tidak bisa "dibobol" dengan mencoba
  // berkali-kali sambil membaca penjelasan tiap kali gagal.
  const revealExplanation = passed || attemptsLeft === 0;

  if (passed) {
    await issueCertificateIfComplete(user, course, enrollment, finalCompletedLessons);
  }

  revalidatePath(`/courses/${courseSlug}/learn/${lessonSlug}`);
  revalidatePath("/profil");

  return {
    ok: true,
    passed,
    score,
    attemptsLeft,
    perQuestion: graded.map((g) => ({
      id: g.id,
      correct: g.correct,
      explanation: revealExplanation ? g.explanation : null,
    })),
  };
}
