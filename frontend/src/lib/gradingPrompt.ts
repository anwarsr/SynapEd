/**
 * Prompt & parser untuk draf penilaian AI (gradingActions.ts).
 *
 * Format balasan dibuat sesederhana mungkin — dua baris berlabel, bukan
 * JSON — mengikuti pengalaman nyata proyek ini dengan model gratis
 * OpenRouter (isu reasoning-token, sensitivitas parameter, lihat komentar
 * di openrouter.ts): keandalan lebih diutamakan daripada kerapian.
 */

export interface GradingPromptInput {
  lessonTitle: string;
  instructions: string | null;
  passingGrade: number;
  submissionText: string;
}

export interface GradingPrompt {
  system: string;
  user: string;
}

/**
 * Instruksi yang sama dipakai jalur teks (PDF) maupun jalur gambar — cuma
 * bagian "jawaban peserta" di giliran user yang beda bentuk (teks vs
 * lampiran gambar terpisah, lihat buildImageGradingUserText di bawah).
 */
export function buildGradingSystemPrompt(): string {
  return `Kamu adalah asisten pembantu educator SynapEd menilai tugas peserta. Bahasa
Indonesia saja, obyektif, jangan mengarang. Nilai yang kamu berikan harus
mencerminkan kualitas jawaban dibanding instruksi/rubrik di bawah, BUKAN
direkayasa supaya lulus atau tidak lulus.

WAJIB balas PERSIS dengan format berikut, tanpa teks lain sebelum atau
sesudahnya:

GRADE: <angka bulat 0-100>
FEEDBACK: <catatan untuk peserta, langsung ke peserta ("Kamu sudah...", bukan "Peserta sudah...")>

Jangan tambahkan markdown, tanda kutip, atau penjelasan di luar dua baris itu.`;
}

function briefSection(input: { lessonTitle: string; instructions: string | null; passingGrade: number }): string {
  return `## Judul tugas
${input.lessonTitle}

## Instruksi/rubrik dari educator
${input.instructions?.trim() || "(Tidak ada instruksi eksplisit - nilai berdasar kualitas umum jawaban dan judul tugas.)"}

## Nilai minimum kelulusan kursus ini
${input.passingGrade}`;
}

export function buildGradingPrompt(input: GradingPromptInput): GradingPrompt {
  const user = `${briefSection(input)}

## Teks hasil ekstraksi berkas yang dikumpulkan peserta (format asli mungkin tidak terjaga)
${input.submissionText}`;

  return { system: buildGradingSystemPrompt(), user };
}

/**
 * Teks pengantar untuk jalur GAMBAR — dipasangkan dengan content part
 * `image_url` terpisah di gradingActions.ts, bukan menyertakan isi berkas
 * sebagai teks seperti buildGradingPrompt (tidak ada "teks hasil ekstraksi"
 * untuk gambar; modelnya melihat gambarnya langsung).
 */
export function buildImageGradingUserText(
  input: Pick<GradingPromptInput, "lessonTitle" | "instructions" | "passingGrade">,
): string {
  return `${briefSection(input)}

## Jawaban peserta
Gambar yang dilampirkan berikut adalah jawaban/karya yang dikumpulkan peserta. Amati gambarnya, lalu nilai berdasarkan instruksi/rubrik di atas.`;
}

/**
 * Mengambil kecocokan GRADE: TERAKHIR (jaga-jaga model "mikir keras" dulu
 * sebelum jawaban final) dan segala sesuatu setelah FEEDBACK: TERAKHIR.
 * Grade di luar 0-100 atau tidak ketemu -> null — TIDAK PERNAH menebak atau
 * membulatkan angka yang sebenarnya tidak valid.
 */
export function parseGradingResponse(
  raw: string,
  maxFeedbackChars: number,
): { grade: number; feedback: string } | null {
  const gradeMatches = [...raw.matchAll(/GRADE:\s*(\d{1,3})/gi)];
  if (gradeMatches.length === 0) return null;

  const grade = Math.round(Number(gradeMatches[gradeMatches.length - 1][1]));
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) return null;

  const idx = raw.toUpperCase().lastIndexOf("FEEDBACK:");
  const feedback = idx === -1 ? "" : raw.slice(idx + "FEEDBACK:".length).trim().slice(0, maxFeedbackChars);

  return { grade, feedback };
}
