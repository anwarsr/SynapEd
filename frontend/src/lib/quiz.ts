import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { enrollmentRef, type Enrollment } from "@/lib/enrollments";

/**
 * Kuis hidup di subcollection `courses/{slug}/quizzes/{lessonSlug}` —
 * BUKAN di dalam dokumen kursus. Itu keputusan yang menopang seluruh
 * keamanan fitur ini: `courses/{slug}` adalah `allow read: if true`, jadi
 * apa pun yang bersarang di dalamnya (termasuk di dalam array `sections`)
 * bersifat publik. Jawaban benar tidak boleh hidup di sana dalam bentuk
 * apa pun — bahkan di-hash pun tidak aman, karena soal pilihan ganda 4
 * opsi hanya punya 4 kandidat hash yang bisa dibobol dalam mikrodetik.
 *
 * Subcollection tidak ikut terbawa saat dokumen induknya dibaca — getCourse()
 * tetap tepat 1 pembacaan. Firestore rules juga tidak hierarkis: dokumen di
 * sini TIDAK ikut menjadi publik hanya karena `courses/{slug}` publik. Sudah
 * jatuh ke deny-all di firestore.rules tanpa perlu baris tambahan; blok
 * eksplisit ditambahkan di sana murni sebagai dokumentasi.
 */

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  /** TIDAK PERNAH meninggalkan server — lihat toPublicQuiz(). */
  correctOptionId: string;
  /** TIDAK PERNAH meninggalkan server sampai peserta lulus atau kehabisan percobaan. */
  explanation: string;
  points: number;
}

export interface QuizDoc {
  courseSlug: string;
  lessonSlug: string;
  passingScore: number;
  /** 0 berarti tidak dibatasi. */
  maxAttempts: number;
  questions: QuizQuestion[];
  updatedAt: string;
}

/** Soal tanpa jawaban benar — bentuk yang boleh dikirim ke peserta. */
export interface PublicQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  points: number;
}

export interface PublicQuiz {
  lessonSlug: string;
  passingScore: number;
  maxAttempts: number;
  attemptsUsed: number;
  /** null berarti tidak dibatasi. */
  attemptsLeft: number | null;
  bestScore: number | null;
  passed: boolean;
  questions: PublicQuestion[];
}

export function quizRef(courseSlug: string, lessonSlug: string) {
  return adminDb().collection("courses").doc(courseSlug).collection("quizzes").doc(lessonSlug);
}

export async function getQuiz(courseSlug: string, lessonSlug: string): Promise<QuizDoc | null> {
  const doc = await quizRef(courseSlug, lessonSlug).get();
  return doc.exists ? (doc.data() as QuizDoc) : null;
}

/**
 * Satu-satunya konversi yang disahkan dari QuizDoc (punya jawaban) ke bentuk
 * publik (tidak punya). Field dipilih eksplisit satu per satu — BUKAN spread
 * lalu menghapus field, karena `{...q, correctOptionId: undefined}` tetap
 * menyerialkan kuncinya ke payload RSC yang dikirim ke browser.
 */
/**
 * Kuis untuk ditampilkan di halaman belajar — dipanggil langsung dari Server
 * Component (bukan lewat Server Action, karena ini pembacaan yang dipicu
 * server, bukan mutasi yang dipicu klien).
 *
 * `enrollment` boleh null: pelajaran kuis bertanda `free` tetap bisa
 * dipratinjau tanpa mendaftar (soal-soalnya tampil), tapi mengerjakannya
 * tetap butuh enrollment aktif — itu ditegakkan di submitQuiz, bukan di sini.
 */
export async function getPublicQuizForViewer(
  courseSlug: string,
  lessonSlug: string,
  enrollment: Enrollment | null,
): Promise<PublicQuiz | null> {
  const doc = await getQuiz(courseSlug, lessonSlug);
  if (!doc) return null;

  if (!enrollment) {
    return toPublicQuiz(doc, { attemptsUsed: 0, bestScore: null, passed: false });
  }

  const attemptsSnap = await enrollmentRef(enrollment.uid, courseSlug)
    .collection("quizAttempts")
    .where("lessonSlug", "==", lessonSlug)
    .get();

  return toPublicQuiz(doc, {
    attemptsUsed: attemptsSnap.size,
    bestScore: enrollment.quizScores[lessonSlug] ?? null,
    passed: enrollment.completedLessons.includes(lessonSlug),
  });
}

export function toPublicQuiz(
  doc: QuizDoc,
  state: { attemptsUsed: number; bestScore: number | null; passed: boolean },
): PublicQuiz {
  const attemptsLeft = doc.maxAttempts === 0 ? null : Math.max(0, doc.maxAttempts - state.attemptsUsed);

  return {
    lessonSlug: doc.lessonSlug,
    passingScore: doc.passingScore,
    maxAttempts: doc.maxAttempts,
    attemptsUsed: state.attemptsUsed,
    attemptsLeft,
    bestScore: state.bestScore,
    passed: state.passed,
    questions: doc.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      points: q.points,
    })),
  };
}
