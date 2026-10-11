"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireOwnedClass } from "@/lib/classGuards";
import { getPost, postsRef } from "@/lib/classes";
import {
  classSubmissionId,
  getClassSubmission,
  getPengaturanAi,
  periksaBerkas,
} from "@/lib/classAssignments";
import {
  MAX_AI_CONTEXT_FILES,
  MAX_CLASS_FEEDBACK,
  MIME_AI_KONTEKS,
  type KelasBerkas,
} from "@/lib/classAssignmentRules";
import { bacaBerkasAi } from "@/lib/classGradingFiles";
import { buildClassGradingSystemPrompt, teksBagianJawaban, teksBagianSoal } from "@/lib/classGradingPrompt";
import { parseGradingResponse } from "@/lib/gradingPrompt";
import {
  OpenRouterError,
  openRouterStream,
  openRouterTerkonfigurasi,
  PESAN_AI_BELUM_DIKONFIGURASI,
  VISION_MODELS,
  type OpenRouterContentPart,
  type OpenRouterMessage,
} from "@/lib/openrouter";
import { checkChatRateLimit } from "@/lib/chatRateLimit";
import { deleteObjects } from "@/lib/storageCleanup";
import { CLASS_FILES } from "@/lib/storagePaths";

/**
 * Koreksi AI untuk tugas KELAS — padanan `suggestGrade` (gradingActions.ts)
 * milik kursus.
 *
 * Sama seperti di kursus, AI hanya MENYARANKAN: action ini tidak pernah
 * menulis nilai. Formulir mengisi kolom nilai (dan komentar bila diminta),
 * lalu pengajar tetap harus menekan Simpan lewat `gradeClassSubmission`.
 *
 * Keduanya hanya untuk pengelola kelas (`requireOwnedClass`: pemilik atau
 * admin). Uid siswa datang dari argumen, tetapi hanya dipakai menyusun ID
 * pengumpulan di kelas yang SUDAH terbukti milik pemanggil.
 */

export type SaranNilaiKelas =
  | { ok: true; grade: number; feedback: string; peringatan: string[] }
  | { ok: false; error: string };

export type AiSettingsResult = { ok: true; message: string } | { ok: false; error: string };

export async function suggestClassGrade(
  classId: string,
  postId: string,
  studentUid: string,
): Promise<SaranNilaiKelas> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak menilai tugas ini." };

  // Jatah yang SAMA dengan saran nilai kursus: keduanya menguras kuota
  // OpenRouter yang sama, jadi memisahkannya hanya menggandakan batas semu.
  const limit = checkChatRateLimit(`grade-ai:${user.uid}`);
  if (!limit.ok) {
    return { ok: false, error: "Terlalu banyak permintaan koreksi AI. Coba lagi dalam satu menit." };
  }

  const post = await getPost(classId, postId);
  const p = post?.kind === "assignment" ? post.assignment : null;
  if (!post || !p) return { ok: false, error: "Tugas tidak ditemukan." };

  const sub = await getClassSubmission(classSubmissionId(classId, postId, String(studentUid)));
  if (!sub) return { ok: false, error: "Siswa ini belum mengumpulkan." };

  const ai = await getPengaturanAi(classId, postId);
  if (ai.source === "separate" && ai.files.length === 0) {
    return {
      ok: false,
      error: "Belum ada berkas konteks untuk AI. Unggah di kartu Koreksi AI, atau pilih sumber “Instruksi & lampiran tugas”.",
    };
  }

  const [soal, jawaban] = await Promise.all([
    bacaBerkasAi(ai.source === "separate" ? ai.files : post.attachments, { maxChars: 8000, maxGambar: 2 }),
    bacaBerkasAi(sub.files, { maxChars: 12000, maxGambar: 3 }),
  ]);

  const teksJawaban = [sub.text, jawaban.teks].filter(Boolean).join("\n\n");
  if (!teksJawaban.trim() && jawaban.gambar.length === 0) {
    const sebab = jawaban.tidakTerbaca.length > 0 ? ` (${jawaban.tidakTerbaca.join(", ")})` : "";
    return { ok: false, error: `AI tidak bisa membaca jawaban siswa ini${sebab}. Silakan nilai secara manual.` };
  }

  const bagianSoal = teksBagianSoal({
    judul: post.title,
    // Mode "separate" sengaja HANYA berkas konteks: pengajar memilihnya justru
    // karena instruksi tugas tidak cukup (atau berbeda) sebagai acuan penilaian.
    teks: ai.source === "separate" ? soal.teks : [post.body, soal.teks].filter(Boolean).join("\n\n"),
    tidakTerbaca: soal.tidakTerbaca,
    jumlahGambar: soal.gambar.length,
    maxPoints: p.maxPoints,
    sumber: ai.source,
  });
  const bagianJawaban = teksBagianJawaban({
    teks: teksJawaban,
    tidakTerbaca: jawaban.tidakTerbaca,
    jumlahGambar: jawaban.gambar.length,
  });

  const adaGambar = soal.gambar.length + jawaban.gambar.length > 0;
  const gambarKe = (urls: string[]): OpenRouterContentPart[] =>
    urls.map((url) => ({ type: "image_url", image_url: { url } }));

  const messages: OpenRouterMessage[] = [
    { role: "system", content: buildClassGradingSystemPrompt(p.maxPoints) },
    {
      role: "user",
      // Gambar diselipkan tepat setelah teks bagiannya, supaya model tahu
      // mana gambar soal dan mana gambar jawaban siswa.
      content: adaGambar
        ? [
            { type: "text", text: bagianSoal },
            ...gambarKe(soal.gambar),
            { type: "text", text: bagianJawaban },
            ...gambarKe(jawaban.gambar),
          ]
        : `${bagianSoal}\n\n${bagianJawaban}`,
    },
  ];

  // Diperiksa SETELAH berkas dibaca: jawaban yang tak terbaca tetap
  // dilaporkan dengan alasannya, di server mana pun.
  if (!openRouterTerkonfigurasi()) return { ok: false, error: PESAN_AI_BELUM_DIKONFIGURASI };

  let full = "";
  try {
    const stream = await openRouterStream(messages, adaGambar ? { models: VISION_MODELS, maxTokens: 2000 } : {});
    for await (const chunk of stream) full += chunk;
  } catch (e) {
    if (e instanceof OpenRouterError && e.status === 429) {
      return { ok: false, error: "Kuota harian AI sudah habis. Coba lagi besok, atau nilai secara manual." };
    }
    console.error("[suggestClassGrade] Galat OpenRouter:", e);
    return { ok: false, error: "AI sedang tidak bisa dihubungi. Coba lagi nanti." };
  }

  const parsed = parseGradingResponse(full, MAX_CLASS_FEEDBACK, p.maxPoints);
  if (!parsed) {
    console.error("[suggestClassGrade] Balasan AI tidak sesuai format:", full.slice(0, 300));
    return { ok: false, error: "AI tidak memberi jawaban yang bisa dibaca. Coba lagi." };
  }

  return {
    ok: true,
    grade: parsed.grade,
    feedback: parsed.feedback,
    peringatan: [
      ...soal.tidakTerbaca.map((n) => `Konteks soal tidak terbaca: ${n}`),
      ...jawaban.tidakTerbaca.map((n) => `Jawaban tidak terbaca: ${n}`),
    ],
  };
}

/**
 * Menyimpan pengaturan koreksi AI satu tugas.
 *
 * `keep` = path berkas konteks LAMA yang dipertahankan; dicocokkan dengan
 * daftar tersimpan di server, bukan dipercaya dari browser — jadi berkas yang
 * diunggah admin tetap bisa dipertahankan pemilik kelas, tetapi path asing
 * tidak bisa diselundupkan lewat daftar ini. `files` = unggahan BARU, yang
 * harus berada di folder pemanggil untuk kelas ini.
 */
export async function saveAiGradingSettings(
  classId: string,
  postId: string,
  input: unknown,
): Promise<AiSettingsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengubah tugas ini." };

  const post = await getPost(classId, postId);
  if (!post || post.kind !== "assignment") return { ok: false, error: "Tugas tidak ditemukan." };

  const r = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const source = r.source === "separate" ? "separate" : r.source === "assignment" ? "assignment" : null;
  if (!source) return { ok: false, error: "Sumber konteks tidak valid." };

  const lama = await getPengaturanAi(classId, postId);
  const keep = new Set(Array.isArray(r.keep) ? r.keep.filter((x): x is string => typeof x === "string") : []);
  const dipertahankan = lama.files.filter((f) => keep.has(f.path));

  const baru = await periksaBerkas(
    r.files,
    `${CLASS_FILES}/${user.uid}/${classId}/`,
    MIME_AI_KONTEKS,
    MAX_AI_CONTEXT_FILES,
  );
  if (!baru.ok) return { ok: false, error: baru.error };

  const files: KelasBerkas[] = [...dipertahankan, ...baru.files.filter((f) => !keep.has(f.path))];
  if (files.length > MAX_AI_CONTEXT_FILES) {
    return { ok: false, error: `Maksimal ${MAX_AI_CONTEXT_FILES} berkas konteks.` };
  }
  if (source === "separate" && files.length === 0) {
    return { ok: false, error: "Unggah minimal satu berkas konteks, atau pilih “Instruksi & lampiran tugas”." };
  }

  await postsRef(classId).doc(postId).update({
    aiGrading: { source, files, fillComment: r.fillComment === true, updatedAt: new Date().toISOString() },
  });

  // Dibuang SETELAH tersimpan: gagal di tengah tidak boleh meninggalkan
  // pengaturan yang menunjuk berkas yang sudah hilang.
  const tetap = new Set(files.map((f) => f.path));
  await deleteObjects(lama.files.map((f) => f.path).filter((x) => !tetap.has(x))).catch(() => 0);

  revalidatePath(`/educator/classes/${classId}/tugas/${postId}`);
  return { ok: true, message: "Pengaturan koreksi AI disimpan." };
}
