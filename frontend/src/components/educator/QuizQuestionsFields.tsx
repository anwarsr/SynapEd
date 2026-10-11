"use client";
import { Label, inputClass } from "./fields";
import { newOption, newQuestion, type DraftQuestion } from "./quizDraft";
import { cn } from "@/lib/cn";

/**
 * UI penyusun soal — murni presentasional, tidak tahu apa pun soal
 * loadQuizForEditor/saveQuiz. Dipakai oleh QuizEditor.tsx (kuis pelajaran
 * yang sudah tersimpan, punya tombol simpan sendiri) dan curriculumDraft.tsx
 * (draft kuis di form buat kursus, ikut tersimpan saat kursus diterbitkan —
 * lihat komentar di sana).
 *
 * `idPrefix` menggantikan lessonSlug sebagai dasar id elemen form: draft di
 * form buat kursus belum punya lessonSlug (pelajarannya sendiri belum
 * tersimpan), jadi pemanggil mengoper apa pun yang stabil di sisinya
 * (lessonSlug di QuizEditor, DraftLesson.key di curriculumDraft).
 */
export default function QuizQuestionsFields({
  passingScore,
  onPassingScoreChange,
  maxAttempts,
  onMaxAttemptsChange,
  questions,
  onQuestionsChange,
  idPrefix,
}: {
  passingScore: number;
  onPassingScoreChange: (value: number) => void;
  maxAttempts: number;
  onMaxAttemptsChange: (value: number) => void;
  questions: DraftQuestion[];
  onQuestionsChange: (next: DraftQuestion[]) => void;
  idPrefix: string;
}) {
  function updateQuestion(qi: number, patch: Partial<DraftQuestion>) {
    onQuestionsChange(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    onQuestionsChange([...questions, newQuestion()]);
  }

  function removeQuestion(qi: number) {
    onQuestionsChange(questions.filter((_, i) => i !== qi));
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

  return (
    <div className="space-y-5 bg-white/[0.04] p-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`passing-${idPrefix}`}>Nilai kelulusan (%)</Label>
          <input
            id={`passing-${idPrefix}`}
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => onPassingScoreChange(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor={`attempts-${idPrefix}`}>Maksimal percobaan (0 = tanpa batas)</Label>
          <input
            id={`attempts-${idPrefix}`}
            type="number"
            min={0}
            max={20}
            value={maxAttempts}
            onChange={(e) => onMaxAttemptsChange(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={q.id} className="bg-white/[0.05] p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3">
              <input
                value={q.prompt}
                onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                placeholder={`Soal ${qi + 1}`}
                className={cn(inputClass, "flex-1 min-w-0")}
              />
              <div className="flex items-center gap-3">
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
                  className="p-2 text-error-text hover:bg-rust-100 shrink-0"
                >
                  Hapus
                </button>
              </div>
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
                    className="p-1.5 text-ink-faint hover:bg-white/10 disabled:opacity-30"
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
              placeholder="Penjelasan (opsional) - tampil ke peserta setelah lulus atau kehabisan percobaan."
              className={cn(inputClass, "resize-y text-xs")}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
      >
        + Tambah Soal
      </button>
    </div>
  );
}
