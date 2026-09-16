import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import {
  DEFAULT_PASSING_GRADE,
  flattenLessons,
  type CourseDetail,
  type Lesson,
} from "@/lib/courses";

export const SUBMISSIONS = "submissions";

/**
 * Batas panjang feedback — dipakai gradeSubmission() saat menyimpan DAN
 * gradingActions.ts saat memotong saran AI, supaya keduanya menegakkan
 * batas yang PERSIS SAMA (kalau tidak, kolom feedback yang di-prefill saran
 * AI bisa menampilkan teks lebih panjang dari yang benar-benar tersimpan
 * begitu educator menekan simpan).
 */
export const MAX_FEEDBACK = 1000;

/**
 * Pengumpulan tugas dari peserta, beserta penilaian educator.
 *
 * Tertutup rapat dari klien lewat firestore.rules, sama seperti `enrollments`
 * dan `orders`: yang menulis hanya Server Action lewat Admin SDK. Kalau klien
 * boleh menulis, siapa pun bisa memberi nilai 100 pada dirinya sendiri lalu
 * mengunduh sertifikat tanpa pernah mengerjakan apa pun.
 *
 * Nama dan berkasnya disalin ke dalam dokumen ini — bukan diambil lewat join
 * saat dibaca. Alasannya sama dengan courseSnapshot di enrollments.ts: daftar
 * penilaian educator menampilkan puluhan baris sekaligus, dan tanpa salinan
 * itu setiap baris berarti satu pembacaan tambahan ke Auth dan ke kursus.
 */
export type SubmissionStatus = "submitted" | "graded";

export interface Submission {
  /** = id dokumen, `{uid}_{courseSlug}_{lessonSlug}`. */
  id: string;

  uid: string;
  studentName: string;
  studentEmail: string | null;

  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;

  /** Path Storage. TIDAK pernah URL publik — lihat storage.rules. */
  filePath: string;
  fileName: string;
  fileSize: number;

  status: SubmissionStatus;
  /** 0..100. `null` selama belum dinilai. */
  grade: number | null;
  feedback: string | null;

  submittedAt: string;
  gradedAt: string | null;
  gradedByUid: string | null;
  gradedByName: string | null;
}

/**
 * Satu pengumpulan per peserta per pelajaran, dan id-nya bisa dihitung tanpa
 * query.
 *
 * Deterministik dengan alasan yang sama seperti enrollmentId(): mengumpulkan
 * ulang menjadi PENIMPAAN, bukan penggandaan. Dengan auto-ID, satu klik ganda
 * sudah cukup membuat dua pengumpulan dan educator harus menebak mana yang
 * terbaru.
 */
export function submissionId(uid: string, courseSlug: string, lessonSlug: string): string {
  return `${uid}_${courseSlug}_${lessonSlug}`;
}

export function submissionRef(id: string) {
  return adminDb().collection(SUBMISSIONS).doc(id);
}

function toSubmission(id: string, d: FirebaseFirestore.DocumentData): Submission {
  return {
    id,
    uid: (d.uid as string | undefined) ?? "",
    studentName: (d.studentName as string | undefined) ?? "Peserta",
    studentEmail: (d.studentEmail as string | null | undefined) ?? null,
    courseSlug: (d.courseSlug as string | undefined) ?? "",
    lessonSlug: (d.lessonSlug as string | undefined) ?? "",
    lessonTitle: (d.lessonTitle as string | undefined) ?? "",
    filePath: (d.filePath as string | undefined) ?? "",
    fileName: (d.fileName as string | undefined) ?? "berkas",
    fileSize: typeof d.fileSize === "number" ? d.fileSize : 0,
    status: d.status === "graded" ? "graded" : "submitted",
    grade: typeof d.grade === "number" ? d.grade : null,
    feedback: (d.feedback as string | null | undefined) ?? null,
    submittedAt: (d.submittedAt as string | undefined) ?? "",
    gradedAt: (d.gradedAt as string | null | undefined) ?? null,
    gradedByUid: (d.gradedByUid as string | null | undefined) ?? null,
    gradedByName: (d.gradedByName as string | null | undefined) ?? null,
  };
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const snap = await submissionRef(id).get();
  const data = snap.data();
  return data ? toSubmission(snap.id, data) : null;
}

/** Pengumpulan seorang peserta di satu kursus. */
export async function listStudentSubmissions(
  uid: string,
  courseSlug: string,
): Promise<Submission[]> {
  const snap = await adminDb()
    .collection(SUBMISSIONS)
    .where("uid", "==", uid)
    .where("courseSlug", "==", courseSlug)
    .get();

  return snap.docs.map((d) => toSubmission(d.id, d.data()));
}

/** Seluruh pengumpulan di satu kursus — yang belum dinilai di atas. */
export async function listCourseSubmissions(courseSlug: string): Promise<Submission[]> {
  const snap = await adminDb()
    .collection(SUBMISSIONS)
    .where("courseSlug", "==", courseSlug)
    .get();

  return snap.docs
    .map((d) => toSubmission(d.id, d.data()))
    .sort((a, b) => {
      // Yang menunggu dinilai selalu di atas: itulah yang educator cari saat
      // membuka halaman ini.
      if ((a.status === "submitted") !== (b.status === "submitted")) {
        return a.status === "submitted" ? -1 : 1;
      }
      return b.submittedAt.localeCompare(a.submittedAt);
    });
}

/** Pelajaran yang WAJIB dikumpulkan dan dinilai sebelum sertifikat terbit. */
export function gradedLessons(course: CourseDetail): Lesson[] {
  return flattenLessons(course).filter(
    (l) => l.type === "assignment" || l.type === "quiz",
  );
}


/**
 * Nilai minimum kelulusan sebuah kursus.
 *
 * Kursus yang dibuat sebelum fitur ini tidak punya field-nya; dibaca sebagai
 * 70 — bukan 0. Nol akan berarti "apa pun lulus", dan itu diam-diam mencabut
 * syarat yang justru baru saja dipasang.
 */
export function passingGradeOf(course: Pick<CourseDetail, "passingGrade">): number {
  const n = course.passingGrade;
  return typeof n === "number" && n >= 0 && n <= 100 ? n : DEFAULT_PASSING_GRADE;
}

export interface GradingState {
  /** Pelajaran yang wajib dinilai. */
  total: number;
  /** Sudah dikumpulkan, apa pun statusnya. */
  submitted: number;
  /** Sudah dinilai DAN mencapai nilai minimum. */
  passed: number;
  /** Sudah dinilai tetapi di bawah nilai minimum. */
  failed: number;
  /** Semua pelajaran wajib sudah dinilai dan lulus. */
  clear: boolean;
}

/**
 * Apakah peserta ini sudah melewati seluruh penugasan & kuis kursusnya.
 *
 * Dipakai penjaga sertifikat DAN tampilan, supaya keduanya tidak bisa berbeda
 * pendapat tentang siapa yang berhak.
 */
export function gradingStateOf(
  course: CourseDetail,
  submissions: readonly Submission[],
  /**
   * Nilai kuis peserta, `lessonSlug -> persen`.
   *
   * Pelajaran kuis yang dikerjakan lewat SOAL sudah dinilai oleh sistem
   * kuis itu sendiri — submitQuiz hanya menandainya selesai kalau lulus.
   * Menuntut berkas pengumpulan untuk pelajaran seperti itu akan menahan
   * sertifikatnya selamanya, karena tidak ada berkas yang bisa diunggah.
   *
   * Penyusun soal sedang dimatikan (lihat KUIS_BERSOAL), jadi cabang ini
   * memang belum terpakai — tetapi ia harus ada supaya kuis bersoal tetap
   * koheren kalau saklarnya dinyalakan lagi.
   */
  quizScores: Readonly<Record<string, number>> = {},
): GradingState {
  const wajib = gradedLessons(course);
  const batas = passingGradeOf(course);

  const byLesson = new Map(submissions.map((s) => [s.lessonSlug, s]));

  let submitted = 0;
  let passed = 0;
  let failed = 0;

  for (const l of wajib) {
    if (l.type === "quiz" && typeof quizScores[l.slug] === "number") {
      submitted++;
      passed++;
      continue;
    }

    const s = byLesson.get(l.slug);
    if (!s) continue;

    submitted++;
    if (s.status !== "graded" || s.grade === null) continue;
    if (s.grade >= batas) passed++;
    else failed++;
  }

  return {
    total: wajib.length,
    submitted,
    passed,
    failed,
    clear: passed === wajib.length,
  };
}
