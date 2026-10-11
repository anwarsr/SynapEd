"use server";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireOwnedCourse } from "@/lib/educatorCourses";
import { flattenLessons } from "@/lib/courses";
import { getSubmission, MAX_FEEDBACK } from "@/lib/submissions";
import { adminStorage } from "@/lib/firebase/admin";
import { extractPdfText } from "@/lib/pdfText";
import { buildGradingPrompt, buildGradingSystemPrompt, buildImageGradingUserText, parseGradingResponse } from "@/lib/gradingPrompt";
import {
  OpenRouterError,
  openRouterStream,
  openRouterTerkonfigurasi,
  PESAN_AI_BELUM_DIKONFIGURASI,
  VISION_MODELS,
  type OpenRouterMessage,
} from "@/lib/openrouter";
import { checkChatRateLimit } from "@/lib/chatRateLimit";
import { SUBMISSION_FILES } from "@/lib/storagePaths";

export type SuggestGradeResult = { ok: true; grade: number; feedback: string } | { ok: false; error: string };

/** Ekstensi -> mime — hanya jenis yang diverifikasi berfungsi dengan VISION_MODELS. */
const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function imageMimeOf(fileName: string): string | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return IMAGE_MIME[ext] ?? null;
}

/**
 * Batas aman ukuran gambar yang dikirim ke model vision — base64 menggembungkan
 * ukurannya ~33%, dan berkas pengumpulan boleh sampai 50 MB (storage.rules).
 * Angka ini belum diukur presisi terhadap batas OpenRouter/model, sengaja
 * konservatif; sesuaikan kalau ternyata terlalu ketat/longgar di pemakaian nyata.
 */
const MAX_VISION_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Draf nilai + feedback dari AI untuk satu pengumpulan tugas — TIDAK PERNAH
 * menyimpan apa pun sendiri. Educator tetap harus meninjau lalu memanggil
 * gradeSubmission() sendiri lewat GradeForm.tsx, persis alur manual yang
 * sudah ada — ini murni lapisan saran di atasnya.
 *
 * Otorisasi PERSIS sama dengan gradeSubmission() (submissionActions.ts):
 * hanya pemilik kursus atau admin, lewat requireOwnedCourse.
 */
export async function suggestGrade(submissionId: string): Promise<SuggestGradeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  // Kunci terpisah dari chat FAQ ("uid:"/"ip:") supaya jatah chat educator
  // sendiri dan jatah saran-AI-penilaian tidak saling termakan diam-diam —
  // dua fitur yang tidak berkaitan, sebaiknya tidak berbagi satu jatah.
  const limit = checkChatRateLimit(`grade-ai:${user.uid}`);
  if (!limit.ok) {
    return { ok: false, error: "Terlalu banyak permintaan saran AI. Coba lagi dalam beberapa menit." };
  }

  if (!openRouterTerkonfigurasi()) return { ok: false, error: PESAN_AI_BELUM_DIKONFIGURASI };

  const submission = await getSubmission(submissionId);
  if (!submission) return { ok: false, error: "Pengumpulan tidak ditemukan." };

  const course = await requireOwnedCourse(user, submission.courseSlug);
  if (!course) return { ok: false, error: "Anda tidak berhak menilai kursus ini." };

  const lesson = flattenLessons(course).find((l) => l.slug === submission.lessonSlug);
  if (!lesson) return { ok: false, error: "Pelajaran tidak ditemukan." };

  if (!submission.filePath.startsWith(`${SUBMISSION_FILES}/${submission.uid}/`)) {
    return { ok: false, error: "Berkas tidak sah." };
  }

  const file = adminStorage().bucket().file(submission.filePath);
  const [exists] = await file.exists();
  if (!exists) return { ok: false, error: "Berkas pengumpulan sudah tidak ada." };

  const [buffer] = await file.download();
  const imageMime = imageMimeOf(submission.fileName);

  let messages: OpenRouterMessage[];
  let modelOpts: { models?: readonly string[]; maxTokens?: number } = {};

  if (imageMime) {
    // Jalur GAMBAR — belum ada di ronde sebelumnya (fase itu hanya PDF).
    // Diverifikasi langsung: model vision gratis benar-benar bisa "melihat"
    // gambar, lihat komentar VISION_MODELS di openrouter.ts.
    if (buffer.byteLength > MAX_VISION_IMAGE_BYTES) {
      const mb = Math.round(MAX_VISION_IMAGE_BYTES / (1024 * 1024));
      return { ok: false, error: `Ukuran gambar melebihi ${mb} MB untuk dianalisis AI. Silakan nilai secara manual.` };
    }

    const userText = buildImageGradingUserText({
      lessonTitle: lesson.title,
      instructions: lesson.instructions ?? null,
      passingGrade: course.passingGrade,
    });
    const dataUrl = `data:${imageMime};base64,${buffer.toString("base64")}`;

    messages = [
      { role: "system", content: buildGradingSystemPrompt() },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ];
    // Lebih longgar dari MAX_TOKENS bawaan (1500) — model vision kadang
    // butuh lebih banyak token untuk "memeriksa" gambar sebelum menjawab,
    // walau reasoning eksplisit dimatikan.
    modelOpts = { models: VISION_MODELS, maxTokens: 2000 };
  } else {
    // Jalur TEKS (PDF) — sama seperti sebelumnya.
    const extraction = await extractPdfText(buffer, { maxPages: 30, maxChars: 12000, minChars: 100 });
    if (!extraction.ok) {
      return {
        ok: false,
        error: "Format berkas ini belum bisa dianalisis AI (bukan PDF atau gambar yang didukung). Silakan nilai secara manual.",
      };
    }

    const prompt = buildGradingPrompt({
      lessonTitle: lesson.title,
      instructions: lesson.instructions ?? null,
      passingGrade: course.passingGrade,
      submissionText: extraction.text,
    });
    messages = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ];
  }

  let full = "";
  try {
    const stream = await openRouterStream(messages, modelOpts);
    for await (const chunk of stream) full += chunk;
  } catch (e) {
    if (e instanceof OpenRouterError && e.status === 429) {
      return { ok: false, error: "Kuota harian asisten AI sudah habis. Coba lagi besok." };
    }
    console.error("[suggestGrade] Galat OpenRouter:", e);
    return { ok: false, error: "AI sedang tidak bisa dihubungi. Coba lagi nanti." };
  }

  const parsed = parseGradingResponse(full, MAX_FEEDBACK);
  if (!parsed) {
    console.error("[suggestGrade] Balasan AI tidak sesuai format:", full.slice(0, 300));
    return { ok: false, error: "AI tidak memberi jawaban yang bisa dibaca. Coba lagi." };
  }

  return { ok: true, grade: parsed.grade, feedback: parsed.feedback };
}
