import "server-only";
import { COURSE_ASSETS, toSlug } from "@/lib/educatorCourses";
import { toEmbedUrl } from "@/lib/videoEmbed";
import type { Attachment, Lesson, Section } from "@/lib/courses";

/**
 * Validator kurikulum — dipakai lewat curriculumActions.ts DAN courseActions.ts.
 *
 * Bukan file "use server": normalizeSections adalah fungsi sinkron biasa
 * untuk dipakai internal, bukan Server Action. Berkas "use server" HARUS
 * mengekspor fungsi async saja — setiap ekspornya diperlakukan sebagai
 * endpoint yang bisa dipanggil klien, jadi fungsi sinkron di sana ditolak
 * saat kompilasi.
 */

const MAX_SECTIONS = 30;
const MAX_LESSONS = 200;

export interface AttachmentInput {
  name: string;
  path: string;
  size?: number;
  mime?: string;
}

export interface LessonInput {
  /** Ada kalau pelajaran ini sudah pernah disimpan — dipertahankan supaya
   *  progres peserta (completedLessons) dan dokumen kuis tidak jadi yatim. */
  slug?: string;
  title: string;
  type: "video" | "reading" | "quiz";
  duration: string;
  free: boolean;
  videoUrl?: string;
  attachments?: AttachmentInput[];
}

export interface SectionInput {
  title: string;
  lessons: LessonInput[];
}

/** Judul -> slug pelajaran, dijamin unik di dalam satu kursus. */
function slugForLesson(input: LessonInput, seen: Set<string>): string {
  const base = (input.slug?.trim() || toSlug(input.title)) || "pelajaran";
  let slug = base;
  let i = 2;
  while (seen.has(slug)) slug = `${base}-${i++}`;
  seen.add(slug);
  return slug;
}

/**
 * Memvalidasi & menormalkan draft kurikulum jadi Section[] siap simpan.
 *
 * Satu-satunya validator kurikulum di aplikasi ini — dipakai baik oleh
 * saveCurriculum (editor) maupun createCourse (form buat baru), supaya
 * tidak ada dua aturan yang bisa melenceng seiring waktu.
 *
 * `position` SELALU ditulis ulang sebagai indeks array (0-based) di sini,
 * berapa pun nilai yang dikirim klien. Ini yang membuat kursus lama (0-based
 * dari migrasi) dan kursus lama dari form (1-based) konvergen begitu
 * disunting — tanpa migrasi data apa pun.
 *
 * `ownerUids` boleh berisi lebih dari satu uid: pemilik asli kursus (untuk
 * lampiran yang sudah ada) dan pengguna yang sedang menyimpan (untuk
 * lampiran baru). Keduanya sah — lihat komentar di saveCurriculum.
 */
export function normalizeSections(
  raw: SectionInput[],
  ownerUids: string[],
): { ok: true; sections: Section[] } | { ok: false; error: string } {
  if (raw.length === 0) return { ok: false, error: "Kurikulum minimal punya satu bagian." };
  if (raw.length > MAX_SECTIONS) return { ok: false, error: `Maksimal ${MAX_SECTIONS} bagian.` };

  const seenLessonSlugs = new Set<string>();
  const sections: Section[] = [];
  let totalLessons = 0;

  for (const [si, s] of raw.entries()) {
    const title = s.title.trim().slice(0, 120);
    if (!title) return { ok: false, error: `Judul bagian ke-${si + 1} tidak boleh kosong.` };
    if (s.lessons.length === 0) return { ok: false, error: `Bagian "${title}" belum punya pelajaran.` };

    const lessons: Lesson[] = [];

    for (const [li, l] of s.lessons.entries()) {
      totalLessons++;
      if (totalLessons > MAX_LESSONS) return { ok: false, error: `Maksimal ${MAX_LESSONS} pelajaran per kursus.` };

      const lessonTitle = l.title.trim().slice(0, 160);
      if (!lessonTitle) {
        return { ok: false, error: `Judul pelajaran ke-${li + 1} di bagian "${title}" tidak boleh kosong.` };
      }

      const slug = slugForLesson({ ...l, title: lessonTitle }, seenLessonSlugs);

      const lesson: Lesson = {
        slug,
        title: lessonTitle,
        type: l.type,
        duration: l.duration.trim().slice(0, 40) || "—",
        free: Boolean(l.free),
        position: li,
      };

      if (l.type === "video") {
        const raw = (l.videoUrl ?? "").trim();
        const embed = toEmbedUrl(raw);
        if (!embed) return { ok: false, error: `Tautan video pelajaran "${lessonTitle}" tidak dikenali.` };
        lesson.videoUrl = raw;
      }

      if (l.attachments?.length) {
        const attachments: Attachment[] = [];
        for (const a of l.attachments) {
          const owned = ownerUids.some((uid) => a.path.startsWith(`${COURSE_ASSETS}/${uid}/`));
          if (!owned) return { ok: false, error: `Berkas pada pelajaran "${lessonTitle}" tidak sah.` };
          attachments.push({ name: a.name, path: a.path, size: a.size, mime: a.mime });
        }
        lesson.attachments = attachments;
      }

      lessons.push(lesson);
    }

    sections.push({ title, position: si, lessons });
  }

  return { ok: true, sections };
}
