"use client";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { uploadCourseDoc, validateDoc } from "@/lib/courseUpload";
import { discardUpload } from "@/lib/uploadCleanupActions";
import { toEmbedUrl } from "@/lib/videoEmbed";
import type { CourseDetail } from "@/lib/courses";
import type { LessonInput, SectionInput } from "@/lib/curriculum";
import { FilePick, Label, inputClass } from "./fields";
import DurationField from "./DurationField";
import QuizEditor from "./QuizEditor";
import QuizQuestionsFields from "./QuizQuestionsFields";
import { emptyQuizDraft, type QuizDraftState } from "./quizDraft";
import { cn } from "@/lib/cn";

/**
 * Penyusun kurikulum — dipakai bersama oleh form BUAT kursus dan editor
 * SUNTING kursus.
 *
 * Dulu keduanya berbeda: form pembuatan memaksa satu template kaku (satu
 * modul, satu video, satu tugas) sementara editor sudah bebas. Akibatnya
 * educator harus melewati bentuk yang tidak dia inginkan dulu, baru
 * membetulkannya di halaman lain. Satu penyusun untuk keduanya menghilangkan
 * itu sekaligus mencegah dua aturan yang perlahan melenceng — alasan yang
 * sama dengan normalizeSections di sisi server.
 */

export type LessonType = "video" | "reading" | "assignment" | "quiz";

/**
 * Dulu penugasan dan kuis satu tipe bernama "quiz", berlabel
 * "Penugasan / Kuis". Keduanya dipisah atas permintaan pemilik proyek supaya
 * educator bisa menyatakan mana yang mana, dan peserta melihat bedanya.
 *
 * Untuk SEKARANG perilakunya sama: keduanya melampirkan PDF. Penyusun soal
 * kuis tidak dibuang — hanya tidak ditawarkan di form — karena pemisahan ini
 * disebut "untuk sekarang", dan membuang fitur yang mungkin kembali itu
 * merusak tanpa perlu.
 */
export const TYPE_LABEL: Record<LessonType, string> = {
  reading: "Modul / Bacaan",
  video: "Video",
  assignment: "Penugasan",
  quiz: "Kuis",
};

/**
 * Penyusun soal kuis ditawarkan atau tidak.
 *
 * Dimatikan atas permintaan pemilik proyek: untuk sekarang kuis berperilaku
 * sama dengan penugasan — cukup melampirkan PDF. Kodenya SENGAJA tidak
 * dibuang (QuizEditor, QuizQuestionsFields, quizActions, QuizRunner semuanya
 * masih utuh dan teruji), karena permintaannya berbunyi "untuk sekarang".
 *
 * Menyalakannya kembali cukup mengubah baris ini menjadi true.
 */
const KUIS_BERSOAL = false;

export interface DraftAttachment {
  name: string;
  path: string;
  size?: number;
  mime?: string;
}

export interface DraftLesson {
  key: string;
  /** Ada kalau pelajaran ini sudah pernah tersimpan — dipertahankan supaya
   *  progres peserta dan dokumen kuis tidak jadi yatim. */
  slug?: string;
  title: string;
  type: LessonType;
  duration: string;
  videoUrl: string;
  attachment: DraftAttachment | null;
  uploading: boolean;
  uploadError: string | null;
  /**
   * Draft soal kuis untuk pelajaran ini SEBELUM tersimpan — hanya relevan
   * kalau type === "quiz". Dipakai langsung di form BUAT kursus (courseSlug
   * belum ada) supaya soalnya bisa diisi sekaligus, ikut tersimpan lewat
   * saveQuiz() begitu kursus (dan slug pelajarannya) sudah ada — lihat
   * CourseForm.tsx. Untuk pelajaran yang sudah tersimpan (konteks sunting),
   * field ini tidak dipakai — kuisnya dikelola lewat QuizEditor sendiri.
   */
  quizDraft?: QuizDraftState;
}

export interface DraftSection {
  key: string;
  title: string;
  lessons: DraftLesson[];
}

/**
 * Kunci sebuah baris — dipakai sebagai React key SEKALIGUS sebagai id elemen
 * form (`section-{key}`, `durasi-{key}`, `attachment-{key}`).
 *
 * Nilainya acak, jadi fungsi ini TIDAK BOLEH ikut membangun keadaan awal yang
 * dirender server. Inisialisasi useState dijalankan dua kali — sekali di
 * server, sekali lagi di browser saat hydration — sehingga server menulis
 * `htmlFor="section-c8dcc25f"` sementara browser menghitung
 * `htmlFor="section-2721bf13"`, dan React melaporkannya sebagai hydration
 * mismatch.
 *
 * Keadaan awal memakai kunci turunan posisi (draftFromCourse, firstSection).
 * Yang acak hanya untuk baris yang DITAMBAHKAN educator setelah halaman hidup —
 * di situ server tidak ikut menghitung apa pun.
 */
export function newKey(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Kunci tetap untuk keadaan awal — sengaja tidak acak, lihat newKey(). */
function seedKey(si: number, li?: number): string {
  return li === undefined ? `s${si}` : `s${si}l${li}`;
}

export function newLesson(type: LessonType = "reading"): DraftLesson {
  return {
    key: newKey(),
    title: "",
    type,
    duration: "",
    videoUrl: "",
    attachment: null,
    uploading: false,
    uploadError: null,
    quizDraft: type === "quiz" ? emptyQuizDraft() : undefined,
  };
}

export function newSection(title = ""): DraftSection {
  return { key: newKey(), title, lessons: [newLesson()] };
}

/**
 * Bagian pembuka form "buat kursus".
 *
 * Terpisah dari newSection() justru karena kuncinya harus tetap: inilah satu-
 * satunya bagian yang sudah ada sebelum educator menyentuh apa pun, jadi
 * satu-satunya yang ikut dirender server.
 */
export function firstSection(title: string): DraftSection[] {
  return [{ key: seedKey(0), title, lessons: [{ ...newLesson(), key: seedKey(0, 0) }] }];
}

export function draftFromCourse(course: CourseDetail): DraftSection[] {
  return course.sections.map((s, si) => ({
    key: seedKey(si),
    title: s.title,
    lessons: s.lessons.map((l, li) => ({
      key: seedKey(si, li),
      slug: l.slug,
      title: l.title,
      // Tipe yang tidak dikenal jatuh ke "reading" — kursus hasil migrasi
      // bisa menyimpan apa saja di field ini.
      type: (["video", "assignment", "quiz"].includes(l.type) ? l.type : "reading") as LessonType,
      duration: l.duration,
      videoUrl: l.videoUrl ?? "",
      attachment: l.attachments?.[0] ?? null,
      uploading: false,
      uploadError: null,
    })),
  }));
}

/** Pemeriksaan cepat di browser; penjaga sebenarnya tetap normalizeSections. */
export function validateDraft(sections: DraftSection[]): string | null {
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

      // Soal kuis tetap OPSIONAL saat membuat kursus — sama seperti sekarang,
      // pelajaran kuis boleh diterbitkan tanpa soal dan diisi belakangan dari
      // halaman sunting. Hanya divalidasi kalau educator sudah mulai mengisi.
      // Mencerminkan validasi saveQuiz() di server (quizActions.ts) supaya
      // kesalahan ketahuan di sini, bukan setelah kursus terlanjur dibuat.
      if (l.type === "quiz" && l.quizDraft && l.quizDraft.questions.length > 0) {
        for (const [qi, q] of l.quizDraft.questions.entries()) {
          const prompt = q.prompt.trim();
          if (!prompt) return `Soal ke-${qi + 1} pada kuis "${l.title}" belum punya pertanyaan.`;
          if (q.options.length < 2) return `Soal "${prompt}" pada kuis "${l.title}" minimal punya dua pilihan.`;
          if (q.options.some((o) => !o.text.trim())) {
            return `Ada pilihan kosong pada soal "${prompt}" di kuis "${l.title}".`;
          }
          if (!q.options.some((o) => o.id === q.correctOptionId)) {
            return `Jawaban benar belum dipilih untuk soal "${prompt}" di kuis "${l.title}".`;
          }
        }
      }

      // Lampiran sengaja TIDAK diwajibkan. Empat kursus hasil migrasi belum
      // punya berkas sama sekali, dan mewajibkannya di sini akan membuat
      // kursus-kursus itu mustahil disunting. Pelajaran tanpa isi tetap
      // tampil rapi di halaman belajar sebagai "Materi belum tersedia".
    }
  }
  return null;
}

export function toSectionInput(sections: DraftSection[]): SectionInput[] {
  return sections.map((s) => ({
    title: s.title,
    lessons: s.lessons.map(
      (l): LessonInput => ({
        slug: l.slug,
        title: l.title,
        type: l.type,
        duration: l.duration,
        videoUrl: l.type === "video" ? l.videoUrl : undefined,
        attachments: l.attachment ? [l.attachment] : undefined,
      }),
    ),
  }));
}

function moved<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

const iconButton =
  "p-2 rounded-lg text-ink-muted transition-colors hover:bg-paper-alt disabled:opacity-30 disabled:hover:bg-transparent";

export default function SectionList({
  sections,
  setSections,
  uploadPrefix,
  courseSlug,
}: {
  sections: DraftSection[];
  setSections: Dispatch<SetStateAction<DraftSection[]>>;
  /** Pengelompokan folder berkas di Storage: slug kursus, atau id draft. */
  uploadPrefix: string;
  /** Tidak ada saat membuat kursus baru — soal kuis butuh alamat tetap dulu. */
  courseSlug?: string;
}) {
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

  // Berkas yang diunggah DI HALAMAN INI dan belum tentu tersimpan.
  //
  // Hanya berkas inilah yang boleh langsung dibuang saat diganti. Lampiran
  // yang sudah tersimpan sengaja dibiarkan: kursusnya masih memakainya sampai
  // tombol simpan ditekan, dan educator bisa saja menutup halaman tanpa
  // menyimpan. Yang lama itu dibuang server saat penyimpanan benar-benar
  // terjadi, lewat pembandingan kurikulum lama dengan yang baru.
  const freshUploads = useRef<Set<string>>(new Set());

  function discardIfFresh(path: string | null | undefined) {
    if (!path || !freshUploads.current.has(path)) return;
    freshUploads.current.delete(path);
    // Tidak ditunggu: mengganti berkas tidak boleh terasa lambat hanya karena
    // berkas sebelumnya sedang dibersihkan.
    void discardUpload(path).catch(() => undefined);
  }

  // Semua perubahan memakai bentuk fungsional. Membaca `sections` dari closure
  // membuat dua klik cepat berturut-turut saling menimpa.
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

  function addLesson(si: number, type: LessonType) {
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, lessons: [...s.lessons, newLesson(type)] } : s)),
    );
  }

  function removeLesson(si: number, li: number, attachment: DraftAttachment | null) {
    discardIfFresh(attachment?.path);
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, lessons: s.lessons.filter((_, j) => j !== li) } : s)),
    );
  }

  function moveLesson(si: number, li: number, dir: -1 | 1) {
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, lessons: moved(s.lessons, li, dir) } : s)),
    );
  }

  async function pickAttachment(
    si: number,
    li: number,
    lessonKey: string,
    file: File | null,
    current: DraftAttachment | null,
  ) {
    if (!file) {
      discardIfFresh(current?.path);
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
      const doc = await uploadCourseDoc(uid, uploadPrefix, `lesson-${lessonKey}`, file);
      freshUploads.current.add(doc.path);

      // Nama berkas yang sama menghasilkan path yang sama, jadi unggahan tadi
      // MENIMPA yang lama alih-alih membuat berkas kedua. Tanpa penjagaan ini,
      // membuang "yang lama" berarti menghapus berkas yang baru saja diunggah.
      if (current?.path !== doc.path) discardIfFresh(current?.path);
      updateLesson(si, li, { attachment: doc, uploading: false });
    } catch {
      updateLesson(si, li, { uploading: false, uploadError: "Gagal mengunggah berkas. Coba lagi." });
    }
  }

  return (
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
                placeholder="Materi Kursus"
                className={inputClass}
                required
              />
            </div>
            <div className="flex items-center gap-1 pt-7">
              <button
                type="button"
                onClick={() => setSections((prev) => moved(prev, si, -1))}
                disabled={si === 0}
                className={iconButton}
                aria-label="Naikkan bagian"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => setSections((prev) => moved(prev, si, 1))}
                disabled={si === sections.length - 1}
                className={iconButton}
                aria-label="Turunkan bagian"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setSections((prev) => prev.filter((_, i) => i !== si))}
                disabled={sections.length === 1}
                className="p-2 rounded-lg text-rust-700 transition-colors hover:bg-rust-100 disabled:opacity-30 disabled:hover:bg-transparent"
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
                      onChange={(e) => {
                        const type = e.target.value as LessonType;
                        updateLesson(si, li, {
                          type,
                          quizDraft: type === "quiz" ? (l.quizDraft ?? emptyQuizDraft()) : l.quizDraft,
                        });
                      }}
                      className={inputClass}
                      aria-label="Jenis pelajaran"
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
                      className={iconButton}
                      aria-label="Naikkan pelajaran"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLesson(si, li, 1)}
                      disabled={li === s.lessons.length - 1}
                      className={iconButton}
                      aria-label="Turunkan pelajaran"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLesson(si, li, l.attachment)}
                      disabled={s.lessons.length === 1}
                      className="p-2 rounded-lg text-rust-700 transition-colors hover:bg-rust-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label="Hapus pelajaran"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                <div className="mb-3 sm:max-w-md">
                  <Label htmlFor={`durasi-${l.key}`}>Durasi</Label>
                  {/* Satuan pelajaran berhenti di Jam — sebuah pelajaran yang
                      diukur berhari-hari sebenarnya beberapa pelajaran. */}
                  <DurationField
                    id={`durasi-${l.key}`}
                    scope="lesson"
                    value={l.duration}
                    onChange={(v) => updateLesson(si, li, { duration: v })}
                  />
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
                    onPick={(f) => pickAttachment(si, li, l.key, f, l.attachment)}
                  />
                )}
                {l.uploading && <p className="mt-2 text-sm text-ink-muted">Mengunggah…</p>}

                {KUIS_BERSOAL && l.type === "quiz" && (
                  <div className="mt-3">
                    {courseSlug ? (
                      l.slug ? (
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
                              <QuizEditor courseSlug={courseSlug} lessonSlug={l.slug} />
                            </div>
                          )}
                        </>
                      ) : (
                        // Kuis hidup di dokumen terpisah berkunci lessonSlug —
                        // butuh slug yang stabil. Ini pelajaran BARU yang
                        // ditambahkan saat menyunting kursus yang sudah ada,
                        // jadi belum punya slug sampai kurikulumnya disimpan.
                        <p className="text-xs text-ink-muted">
                          Simpan dulu supaya pelajaran ini punya alamat tetap, baru soal kuisnya bisa
                          ditambahkan.
                        </p>
                      )
                    ) : (
                      // Membuat kursus baru: belum ada courseSlug SAMA SEKALI,
                      // jadi tidak ada gunanya menunggu "simpan dulu" — soalnya
                      // cukup diisi di sini sebagai draft, lalu ikut tersimpan
                      // otomatis begitu kursusnya diterbitkan (lihat
                      // CourseForm.tsx).
                      <QuizQuestionsFields
                        passingScore={l.quizDraft?.passingScore ?? emptyQuizDraft().passingScore}
                        onPassingScoreChange={(v) =>
                          updateLesson(si, li, { quizDraft: { ...(l.quizDraft ?? emptyQuizDraft()), passingScore: v } })
                        }
                        maxAttempts={l.quizDraft?.maxAttempts ?? emptyQuizDraft().maxAttempts}
                        onMaxAttemptsChange={(v) =>
                          updateLesson(si, li, { quizDraft: { ...(l.quizDraft ?? emptyQuizDraft()), maxAttempts: v } })
                        }
                        questions={l.quizDraft?.questions ?? []}
                        onQuestionsChange={(next) =>
                          updateLesson(si, li, { quizDraft: { ...(l.quizDraft ?? emptyQuizDraft()), questions: next } })
                        }
                        idPrefix={l.key}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Jenis dipilih saat menambah, bukan sesudahnya — educator tahu apa
              yang ingin ditambahkan, dan ini menghemat satu langkah. */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-sm text-ink-muted">Tambah:</span>
            {(Object.keys(TYPE_LABEL) as LessonType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addLesson(si, t)}
                className="rounded-lg border border-rule px-3.5 py-1.5 text-sm text-ink-body transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
              >
                + {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => setSections((prev) => [...prev, newSection()])}
        className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
      >
        + Tambah Bagian
      </button>
    </div>
  );
}
