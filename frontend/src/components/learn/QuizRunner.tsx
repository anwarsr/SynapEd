"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitQuiz, type QuizSubmitResult } from "@/lib/quizActions";
import type { PublicQuiz } from "@/lib/quiz";
import { cn } from "@/lib/cn";

type SuccessResult = Extract<QuizSubmitResult, { ok: true }>;

/**
 * Mengerjakan kuis satu pelajaran.
 *
 * `quiz` sudah dalam bentuk publik (tanpa correctOptionId/explanation
 * mentah) — lihat toPublicQuiz() di lib/quiz.ts. Penilaian sesungguhnya
 * terjadi di server lewat submitQuiz; komponen ini hanya mengumpulkan
 * jawaban dan menampilkan hasilnya.
 */
export default function QuizRunner({ courseSlug, quiz }: { courseSlug: string; quiz: PublicQuiz }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attemptsExhausted = !quiz.passed && quiz.attemptsLeft === 0;
  const unanswered = quiz.questions.filter((q) => !answers[q.id]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitQuiz(courseSlug, quiz.lessonSlug, answers);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res);
      // Menyegarkan progres di sidebar & bilah atas — LearnShell menerima
      // completed/progress sebagai prop dari Server Component.
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {quiz.bestScore !== null && !result && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            quiz.passed ? "border-blue-100 bg-blue-50 text-blue-700" : "border-rule bg-paper-alt text-ink-body",
          )}
        >
          {quiz.passed
            ? `Anda sudah lulus kuis ini — skor terbaik ${quiz.bestScore}%.`
            : `Skor terbaik Anda sejauh ini: ${quiz.bestScore}%. Nilai kelulusan: ${quiz.passingScore}%.`}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}

      {result ? (
        <div className="space-y-5">
          <div
            className={cn(
              "rounded-2xl border p-6 text-center",
              result.passed ? "border-blue-100 bg-blue-50" : "border-rust-700/25 bg-rust-100",
            )}
          >
            <p className={cn("t-h3 text-lg mb-1", result.passed ? "text-blue-700" : "text-rust-700")}>
              {result.passed ? "Selamat, Anda lulus!" : "Belum lulus"}
            </p>
            <p className="text-sm text-ink-muted">
              Skor: {result.score}% (nilai kelulusan {quiz.passingScore}%)
              {!result.passed && result.attemptsLeft !== null && ` — sisa percobaan: ${result.attemptsLeft}`}
            </p>
          </div>

          {result.passed && result.certificateId && (
            <div className="text-center">
              <Link
                href={`/courses/${courseSlug}/complete`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
              >
                Lihat Halaman Kelulusan →
              </Link>
            </div>
          )}

          <ul className="space-y-3">
            {quiz.questions.map((q) => {
              const graded = result.perQuestion.find((p) => p.id === q.id);
              return (
                <li
                  key={q.id}
                  className={cn(
                    "rounded-xl border p-4 text-sm",
                    graded?.correct ? "border-blue-100 bg-blue-50" : "border-rust-700/25 bg-rust-100",
                  )}
                >
                  <p className="font-medium text-ink mb-1">{q.prompt}</p>
                  <p className={graded?.correct ? "text-blue-700" : "text-rust-700"}>
                    {graded?.correct ? "Jawaban benar" : "Coba Lagi"}
                  </p>
                  {graded?.explanation && <p className="mt-2 text-ink-muted">{graded.explanation}</p>}
                </li>
              );
            })}
          </ul>

          {!result.passed && result.attemptsLeft !== 0 && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
            >
              Coba Lagi
            </button>
          )}
        </div>
      ) : attemptsExhausted ? (
        <div className="rounded-2xl border border-rust-700/25 bg-rust-100 p-6 text-center text-sm text-rust-700">
          Percobaan untuk kuis ini sudah habis.
        </div>
      ) : (
        <div className="space-y-5">
          {quiz.questions.map((q, qi) => (
            <fieldset key={q.id} className="rounded-xl border border-rule p-4">
              <legend className="text-sm font-medium text-ink px-1">
                {qi + 1}. {q.prompt}
              </legend>
              <div className="mt-3 space-y-2">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-colors duration-200",
                      answers[q.id] === o.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-rule text-ink-body hover:border-blue-500/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o.id}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                      className="shrink-0"
                    />
                    {o.text}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <button
            type="button"
            onClick={submit}
            disabled={pending || unanswered.length > 0}
            className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Menilai…" : "Kirim Jawaban"}
          </button>
          {unanswered.length > 0 && (
            <p className="mt-2 text-xs text-ink-muted">Jawab semua soal dulu — {unanswered.length} tersisa.</p>
          )}
        </div>
      )}
    </div>
  );
}
