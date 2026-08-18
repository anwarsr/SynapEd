"use client";
import { useEffect, useState } from "react";
import { loadQuizForEditor, saveQuiz, type QuizInput } from "@/lib/quizActions";
import { Label, inputClass } from "./fields";
import { cn } from "@/lib/cn";

interface DraftOption {
  id: string;
  text: string;
}

// Bentuk standalone, BUKAN diturunkan lewat `&` dari QuizQuestionInput —
// `options` di sana bertipe QuizOptionInput[] (id opsional), dan
// mengintersect-nya dengan tipe options yang id-nya wajib menghasilkan tipe
// gabungan aneh yang tidak bisa ditugaskan apa pun ("A[] & B[]" bukan "B[]").
interface DraftQuestion {
  id: string;
  prompt: string;
  options: DraftOption[];
  correctOptionId: string;
  explanation: string;
  points: number;
}

function newOption(): DraftOption {
  return { id: crypto.randomUUID().slice(0, 8), text: "" };
}

function newQuestion(): DraftQuestion {
  const options = [newOption(), newOption()];
  return {
    id: crypto.randomUUID().slice(0, 8),
    prompt: "",
    options,
    correctOptionId: options[0].id,
    explanation: "",
    points: 10,
  };
}

/**
 * Panel penyusun soal untuk satu pelajaran bertipe kuis.
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

  function updateQuestion(qi: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion()]);
  }

  function removeQuestion(qi: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }

  function addOption(qi: number) {
    updateQuestion(qi, { options: [...questions[qi].options, newOption()] });
  }

  function removeOption(qi: number, oi: number) {
    const q = questions[qi];
    const removed = q.options[oi];
    const options = q.options.filter((_, i) => i !== oi);
    updateQuestion(qi, {
      options,
      correctOptionId: removed.id === q.correctOptionId ? (options[0]?.id ?? "") : q.correctOptionId,
    });
  }

  function updateOptionText(qi: number, oi: number, text: string) {
    const q = questions[qi];
    updateQuestion(qi, { options: q.options.map((o, i) => (i === oi ? { ...o, text } : o)) });
  }

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
    <div className="space-y-5 rounded-xl border border-rule bg-paper-alt p-4">
      {error && (
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`passing-${lessonSlug}`}>Nilai kelulusan (%)</Label>
          <input
            id={`passing-${lessonSlug}`}
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor={`attempts-${lessonSlug}`}>Maksimal percobaan (0 = tanpa batas)</Label>
          <input
            id={`attempts-${lessonSlug}`}
            type="number"
            min={0}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-xl border border-rule bg-paper-card p-4">
            <div className="flex items-start gap-3 mb-3">
              <input
                value={q.prompt}
                onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                placeholder={`Soal ${qi + 1}`}
                className={cn(inputClass, "flex-1")}
              />
              <input
                type="number"
                min={1}
                max={100}
                value={q.points}
                onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) })}
                title="Poin"
                className={cn(inputClass, "w-20 shrink-0")}
              />
              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="p-2 rounded-lg text-rust-700 hover:bg-rust-100 shrink-0"
              >
                Hapus
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {q.options.map((o, oi) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctOptionId === o.id}
                    onChange={() => updateQuestion(qi, { correctOptionId: o.id })}
                    title="Tandai sebagai jawaban benar"
                  />
                  <input
                    value={o.text}
                    onChange={(e) => updateOptionText(qi, oi, e.target.value)}
                    placeholder={`Pilihan ${oi + 1}`}
                    className={cn(inputClass, "flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(qi, oi)}
                    disabled={q.options.length <= 2}
                    className="p-1.5 rounded-lg text-ink-faint hover:bg-paper-alt disabled:opacity-30"
                    aria-label="Hapus pilihan"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(qi)}
                disabled={q.options.length >= 8}
                className="text-xs text-blue-700 hover:underline underline-offset-4 disabled:opacity-40"
              >
                + Tambah pilihan
              </button>
            </div>

            <textarea
              value={q.explanation}
              onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
              rows={2}
              placeholder="Penjelasan (opsional) — tampil ke peserta setelah lulus atau kehabisan percobaan."
              className={cn(inputClass, "resize-y text-xs")}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={addQuestion}
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
        >
          + Tambah Soal
        </button>
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
