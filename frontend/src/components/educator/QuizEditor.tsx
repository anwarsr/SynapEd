"use client";
import { useEffect, useState } from "react";
import { loadQuizForEditor, saveQuiz, type QuizInput } from "@/lib/quizActions";
import QuizQuestionsFields from "./QuizQuestionsFields";
import type { DraftQuestion } from "./quizDraft";

/**
 * Panel penyusun soal untuk satu pelajaran bertipe kuis YANG SUDAH TERSIMPAN.
 *
 * Berdiri sendiri, bukan bagian dari "Simpan Kurikulum" — kuis hidup di
 * subcollection `courses/{slug}/quizzes/{lessonSlug}`, dokumen terpisah dari
 * kursus induknya (lihat komentar di lib/quiz.ts), jadi wajar punya alur
 * simpan sendiri (saveQuiz), bukan ikut payload saveCurriculum.
 *
 * Memuat dokumen APA ADANYA lewat loadQuizForEditor — termasuk jawaban
 * benar. Itu aman di sini: halaman ini hanya bisa dibuka pemilik kursus
 * atau admin (requireOwnedCourse di server action), bukan peserta yang
 * mengerjakan kuisnya.
 *
 * UI soal sendiri (prompt/opsi/radio jawaban benar/penjelasan/poin) ada di
 * QuizQuestionsFields — dipakai juga oleh curriculumDraft.tsx untuk draft
 * kuis pelajaran yang BELUM tersimpan (form buat kursus), tanpa load/save
 * apa pun di sana.
 */
export default function QuizEditor({ courseSlug, lessonSlug }: { courseSlug: string; lessonSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    loadQuizForEditor(courseSlug, lessonSlug).then((res) => {
      if (!alive) return;
      if (res.ok && res.quiz) {
        setPassingScore(res.quiz.passingScore);
        setMaxAttempts(res.quiz.maxAttempts);
        setQuestions(res.quiz.questions.map((q) => ({ ...q })));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [courseSlug, lessonSlug]);

  async function onSave() {
    setError(null);
    setSaved(false);

    if (questions.length === 0) {
      setError("Kuis minimal punya satu soal.");
      return;
    }

    setPending(true);
    const input: QuizInput = { passingScore, maxAttempts, questions };
    const result = await saveQuiz(courseSlug, lessonSlug, input);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  if (loading) return <p className="text-sm text-ink-muted">Memuat soal…</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}

      <QuizQuestionsFields
        passingScore={passingScore}
        onPassingScoreChange={setPassingScore}
        maxAttempts={maxAttempts}
        onMaxAttemptsChange={setMaxAttempts}
        questions={questions}
        onQuestionsChange={setQuestions}
        idPrefix={lessonSlug}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Simpan Kuis"}
        </button>
        {saved && <span className="text-sm text-blue-700">Tersimpan.</span>}
      </div>
    </div>
  );
}
