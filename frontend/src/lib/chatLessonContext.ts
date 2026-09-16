import "server-only";
import { getCourseAccess, canViewLesson } from "@/lib/courseAccess";
import { flattenLessons, type Attachment } from "@/lib/courses";
import { adminStorage } from "@/lib/firebase/admin";
import { extractPdfText } from "@/lib/pdfText";
import type { LessonPromptContext } from "@/lib/chatPrompt";

/**
 * Menyusun konteks pelajaran untuk tutor dalam course, dipanggil dari
 * /api/chat/route.ts. Klien HANYA mengirim courseSlug/lessonSlug (lihat
 * ChatContext.tsx) — semua isi sesungguhnya diambil & diotorisasi ulang DI
 * SINI dari sesi asli, bukan dipercaya dari body permintaan. `null` berarti
 * tidak berhak/tidak ditemukan — pemanggil otomatis jatuh ke mode FAQ biasa,
 * tanpa error yang perlu ditampilkan ke peserta.
 */
export async function resolveLessonPromptContext(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonPromptContext | null> {
  const access = await getCourseAccess(courseSlug);
  if (!access || !canViewLesson(access)) return null;

  const lesson = flattenLessons(access.course).find((l) => l.slug === lessonSlug);
  if (!lesson) return null;

  const sectionTitle =
    access.course.sections.find((s) => s.lessons.some((l) => l.slug === lesson.slug))?.title ?? null;

  return {
    courseTitle: access.course.title,
    courseDesc: access.course.longDesc.slice(0, 600),
    sectionTitle,
    lessonTitle: lesson.title,
    lessonType: lesson.type,
    instructions: lesson.type === "assignment" ? (lesson.instructions ?? null) : null,
    attachmentExcerpt: await excerptOf(lesson.attachments?.[0]),
  };
}

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { text: string | null; cachedAt: number }>();

/**
 * Cuplikan teks dari lampiran pertama pelajaran, kalau bisa diekstrak.
 * Tidak digating lewat mime — attachment.mime opsional/tidak selalu ada;
 * lampiran non-PDF (mis. .docx lama) otomatis gagal di extractPdfText dan
 * terdegradasi jadi null, bukan error yang mengganggu chat.
 *
 * Cache in-memory 15 menit per proses (preseden sama dengan chatRateLimit.ts)
 * — best-effort, bukan jaminan. Chat tidak boleh gagal hanya karena satu
 * lampiran gagal diurai.
 */
async function excerptOf(attachment?: Attachment): Promise<string | null> {
  if (!attachment) return null;
  const key = `${attachment.path}:${attachment.size ?? 0}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < TTL_MS) return cached.text;

  try {
    const file = adminStorage().bucket().file(attachment.path);
    const [exists] = await file.exists();
    if (!exists) {
      cache.set(key, { text: null, cachedAt: Date.now() });
      return null;
    }
    const [buffer] = await file.download();
    const result = await extractPdfText(buffer, { maxPages: 20, maxChars: 4000 });
    const text = result.ok ? result.text : null;
    cache.set(key, { text, cachedAt: Date.now() });
    return text;
  } catch {
    return null;
  }
}
