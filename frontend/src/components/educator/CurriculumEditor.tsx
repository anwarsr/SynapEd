"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { saveCurriculum } from "@/lib/curriculumActions";
import type { LessonInput, SectionInput } from "@/lib/curriculum";
import { uploadCourseDoc, validateDoc } from "@/lib/courseUpload";
import { toEmbedUrl } from "@/lib/videoEmbed";
import type { CourseDetail } from "@/lib/courses";
import { Label, FilePick, inputClass } from "./fields";
import QuizEditor from "./QuizEditor";
import { cn } from "@/lib/cn";

type LessonType = "video" | "reading" | "quiz";

interface DraftAttachment {
  name: string;
  path: string;
  size?: number;
  mime?: string;
}

interface DraftLesson {
  key: string;
  /** Ada kalau pelajaran ini sudah pernah tersimpan — dipertahankan supaya
   *  progres peserta dan (nanti) dokumen kuis tidak jadi yatim. */
  slug?: string;
  title: string;
  type: LessonType;
  duration: string;
  free: boolean;
  videoUrl: string;
  attachment: DraftAttachment | null;
  uploading: boolean;
  uploadError: string | null;
}

interface DraftSection {
  key: string;
  title: string;
  lessons: DraftLesson[];
}

const TYPE_LABEL: Record<LessonType, string> = { video: "Video", reading: "Bacaan", quiz: "Kuis" };

function newKey(): string {
  return crypto.randomUUID().slice(0, 8);
}

function newLesson(): DraftLesson {
  return {
    key: newKey(),
    title: "",
    type: "reading",
    duration: "",
    free: false,
    videoUrl: "",
    attachment: null,
    uploading: false,
    uploadError: null,
  };
}

function draftFromCourse(course: CourseDetail): DraftSection[] {
  return course.sections.map((s) => ({
    key: newKey(),
    title: s.title,
    lessons: s.lessons.map((l) => ({
      key: newKey(),
      slug: l.slug,
      title: l.title,
      type: (l.type === "video" || l.type === "quiz" ? l.type : "reading") as LessonType,
      duration: l.duration,
      free: l.free,
      videoUrl: l.videoUrl ?? "",
      attachment: l.attachments?.[0] ?? null,
      uploading: false,
      uploadError: null,
    })),
  }));
}

function moved<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/**
 * Editor kurikulum penuh — ganti seluruhnya, bukan patch per pelajaran.
 *
 * Slug pelajaran yang sudah ada dipertahankan apa adanya (field `slug` di
 * DraftLesson) supaya retitle tidak mengyatimkan completedLessons peserta.
 * Pelajaran baru mendapat slug baru dari server saat disimpan — lihat
 * normalizeSections di curriculumActions.ts.
 */
export default function CurriculumEditor({ slug, course }: { slug: string; course: CourseDetail }) {
  const router = useRouter();
  const [sections, setSections] = useState<DraftSection[]>(() => draftFromCourse(course));
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateSection(si: number, patch: Partial<DraftSection>) {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  }

  function updateLesson(si: number, li: number, patch: Partial<DraftLesson>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== si ? s : { ...s, lessons: s.lessons.map((l, j) => (j === li ? { ...l, ...patch } : l)) },
      ),
    );
  }

  function addSection() {
    setSections((prev) => [...prev, { key: newKey(), title: "", lessons: [newLesson()] }]);
  }

  function removeSection(si: number) {
    setSections((prev) => prev.filter((_, i) => i !== si));
  }

  function moveSection(si: number, dir: -1 | 1) {
    setSections((prev) => moved(prev, si, dir));
  }

  function addLesson(si: number) {
    updateSection(si, { lessons: [...sections[si].lessons, newLesson()] });
  }

  function removeLesson(si: number, li: number) {
    updateSection(si, { lessons: sections[si].lessons.filter((_, j) => j !== li) });
  }

  function moveLesson(si: number, li: number, dir: -1 | 1) {
    updateSection(si, { lessons: moved(sections[si].lessons, li, dir) });
  }

  async function pickAttachment(si: number, li: number, file: File | null) {
    if (!file) {
      updateLesson(si, li, { attachment: null, uploadError: null });
      return;
    }

    const invalid = validateDoc(file);
    if (invalid) {
      updateLesson(si, li, { uploadError: invalid });
      return;
    }

    const uid = firebaseAuth().currentUser?.uid;
    if (!uid) {
      updateLesson(si, li, { uploadError: "Sesi berakhir. Silakan masuk kembali." });
      return;
    }

    updateLesson(si, li, { uploading: true, uploadError: null });
    try {
      const doc = await uploadCourseDoc(uid, slug, `lesson-${sections[si].lessons[li].key}`, file);
      updateLesson(si, li, { attachment: doc, uploading: false });
    } catch {
      updateLesson(si, li, { uploading: false, uploadError: "Gagal mengunggah berkas. Coba lagi." });
    }
  }

  function validateDraft(): string | null {
    if (sections.length === 0) return "Kurikulum minimal punya satu bagian.";
    for (const s of sections) {
      if (!s.title.trim()) return "Setiap bagian wajib punya judul.";
      if (s.lessons.length === 0) return `Bagian "${s.title}" belum punya pelajaran.`;
      for (const l of s.lessons) {
        if (!l.title.trim()) return `Ada pelajaran tanpa judul di bagian "${s.title}".`;
        if (l.type === "video" && !toEmbedUrl(l.videoUrl)) {
          return `Tautan video pelajaran "${l.title}" tidak dikenali.`;
        }
        if (l.uploading) return `Tunggu unggahan pelajaran "${l.title}" selesai dulu.`;
      }
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const problem = validateDraft();
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    const payload: SectionInput[] = sections.map((s) => ({
      title: s.title,
      lessons: s.lessons.map(
        (l): LessonInput => ({
          slug: l.slug,
          title: l.title,
          type: l.type,
          duration: l.duration,
          free: l.free,
          videoUrl: l.type === "video" ? l.videoUrl : undefined,
          attachments: l.attachment ? [l.attachment] : undefined,
        }),
      ),
    }));

    const result = await saveCurriculum(slug, payload);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {sections.map((s, si) => (
          <section key={s.key} className="bg-paper-card border border-rule rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="t-numeral-ghost text-xl text-ink-faint pt-2" aria-hidden="true">
                {String(si + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <Label htmlFor={`section-${s.key}`}>Judul bagian</Label>
                <input
                  id={`section-${s.key}`}
                  value={s.title}
                  onChange={(e) => updateSection(si, { title: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div className="flex items-center gap-1 pt-7">
                <button
                  type="button"
                  onClick={() => moveSection(si, -1)}
                  disabled={si === 0}
                  className="p-2 rounded-lg text-ink-muted hover:bg-paper-alt disabled:opacity-30"
                  aria-label="Naikkan bagian"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(si, 1)}
                  disabled={si === sections.length - 1}
                  className="p-2 rounded-lg text-ink-muted hover:bg-paper-alt disabled:opacity-30"
                  aria-label="Turunkan bagian"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(si)}
                  className="p-2 rounded-lg text-rust-700 hover:bg-rust-100"
                  aria-label="Hapus bagian"
                >
                  Hapus
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {s.lessons.map((l, li) => (
                <div key={l.key} className="rounded-xl border border-rule p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-1 grid sm:grid-cols-[1fr_auto] gap-3">
                      <input
                        value={l.title}
                        onChange={(e) => updateLesson(si, li, { title: e.target.value })}
                        placeholder="Judul pelajaran"
                        className={inputClass}
                        required
                      />
                      <select
                        value={l.type}
                        onChange={(e) => updateLesson(si, li, { type: e.target.value as LessonType })}
                        className={inputClass}
                      >
                        {(Object.keys(TYPE_LABEL) as LessonType[]).map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveLesson(si, li, -1)}
                        disabled={li === 0}
                        className="p-2 rounded-lg text-ink-muted hover:bg-paper-alt disabled:opacity-30"
                        aria-label="Naikkan pelajaran"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLesson(si, li, 1)}
                        disabled={li === s.lessons.length - 1}
                        className="p-2 rounded-lg text-ink-muted hover:bg-paper-alt disabled:opacity-30"
                        aria-label="Turunkan pelajaran"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLesson(si, li)}
                        className="p-2 rounded-lg text-rust-700 hover:bg-rust-100"
                        aria-label="Hapus pelajaran"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end mb-3">
                    <input
                      value={l.duration}
                      onChange={(e) => updateLesson(si, li, { duration: e.target.value })}
                      placeholder="Perkiraan durasi, mis. 10 menit"
                      className={inputClass}
                    />
                    <label className="flex items-center gap-2 text-sm text-ink-body pb-2.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={l.free}
                        onChange={(e) => updateLesson(si, li, { free: e.target.checked })}
                        className="rounded border-rule"
                      />
                      Bisa dipratinjau gratis
                    </label>
                  </div>

                  {l.type === "video" ? (
                    <div>
                      <input
                        value={l.videoUrl}
                        onChange={(e) => updateLesson(si, li, { videoUrl: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className={cn(
                          inputClass,
                          l.videoUrl.trim() !== "" && !toEmbedUrl(l.videoUrl) && "border-rust-700/50",
                        )}
                      />
                      {l.videoUrl.trim() !== "" && !toEmbedUrl(l.videoUrl) && (
                        <p className="mt-2 text-sm text-rust-700">Tautan belum dikenali.</p>
                      )}
                    </div>
                  ) : (
                    <FilePick
                      id={`attachment-${l.key}`}
                      file={l.attachment}
                      error={l.uploadError}
                      onPick={(f) => pickAttachment(si, li, f)}
                    />
                  )}
                  {l.uploading && <p className="mt-2 text-sm text-ink-muted">Mengunggah…</p>}

                  {l.type === "quiz" && (
                    <div className="mt-3">
                      {l.slug ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedQuiz((prev) => (prev === l.key ? null : l.key))}
                            className="text-sm text-blue-700 hover:underline underline-offset-4"
                          >
                            {expandedQuiz === l.key ? "Tutup Soal Kuis" : "Kelola Soal Kuis"}
                          </button>
                          {expandedQuiz === l.key && (
                            <div className="mt-3">
                              <QuizEditor courseSlug={slug} lessonSlug={l.slug} />
                            </div>
                          )}
                        </>
                      ) : (
                        // Kuis hidup di dokumen terpisah berkunci lessonSlug —
                        // butuh slug yang stabil, jadi pelajaran baru harus
                        // tersimpan dulu lewat "Simpan Kurikulum" sebelum
                        // soalnya bisa ditambahkan.
                        <p className="text-xs text-ink-muted">
                          Simpan kurikulum dulu supaya pelajaran ini punya alamat tetap, baru soal kuisnya
                          bisa ditambahkan.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addLesson(si)}
              className="mt-4 text-sm text-blue-700 hover:underline underline-offset-4"
            >
              + Tambah pelajaran
            </button>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
      >
        + Tambah Bagian
      </button>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : "Simpan Kurikulum"}
        </button>
        {saved && <span className="text-sm text-blue-700">Tersimpan.</span>}
      </div>
    </form>
  );
}
