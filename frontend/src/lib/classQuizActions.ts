"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess, requireOwnedClass } from "@/lib/classGuards";
import { deleteObjects } from "@/lib/storageCleanup";
import { pathGambar, urlGambarSah } from "@/lib/gambarKelas";
import {
  getPercobaan,
  getQuiz,
  hapusPercobaanQuiz,
  listPercobaan,
  listQuizzes,
  peringatanRef,
  percobaanRef,
  quizzesRef,
  selesaikanBilaPerlu,
} from "@/lib/classQuizzes";
import { listClassMembers } from "@/lib/classes";
import { formatWib } from "@/lib/classAssignmentRules";
import {
  MAX_QUIZ_PER_KELAS,
  MAX_TAMBAH_MENIT,
  TOLERANSI_DETIK,
  sisaJedaPeringatan,
  toPeringatan,
  sudahDibuka,
  bersihkanJawaban,
  batasWaktuMs,
  harusSelesai,
  idPercobaan,
  strukturSama,
  urutanUntukSiswa,
  validasiNilaiEsai,
  validasiQuiz,
  type PercobaanQuiz,
  type Quiz,
} from "@/lib/classQuizRules";

export type QuizResult = { ok: true; message: string; quizId?: string } | { ok: false; error: string };

/**
 * Seluruh mutasi quiz kelas. Setiap export berkas ini endpoint publik: tiap
 * fungsi memeriksa sesi & peran sendiri, uid SELALU dari sesi, dan semua angka
 * (poin, batas waktu, nilai) dihitung/diperiksa ulang di server.
 *
 *  - Membuat/mengubah/menutup/menilai/menambah waktu: pemilik kelas atau admin.
 *  - Mulai/menyimpan/mengumpulkan: HANYA anggota (pengajar tidak mengerjakan).
 */

const now = () => new Date().toISOString();

function segarkan(classId: string, quizId?: string) {
  revalidatePath(`/kelas/${classId}`);
  revalidatePath(`/educator/classes/${classId}`);
  if (quizId) {
    revalidatePath(`/kelas/${classId}/quiz/${quizId}`);
    revalidatePath(`/educator/classes/${classId}/quiz/${quizId}`);
  }
}

/**
 * Membuka kembali percobaan yang tadinya ditutup paksa (waktu habis / quiz
 * ditutup) bila sekarang batasnya sudah longgar - dipakai setelah pengajar
 * menambah waktu atau membuka kembali quiz. Percobaan yang esainya sudah
 * dinilai tidak dibuka lagi (nilainya sudah berjalan).
 */
async function bukaKembali(quiz: Quiz, daftar: readonly PercobaanQuiz[]): Promise<void> {
  const sekarang = Date.now();
  await Promise.all(
    daftar.map(async (p) => {
      if (!p.submittedAt || p.finalizedBy === "siswa" || p.finalizedBy === null) return;
      if (Object.keys(p.essayScores).length > 0) return;
      if (harusSelesai(quiz, { ...p, submittedAt: null }, sekarang)) return;
      await percobaanRef(p.id).update({ submittedAt: null, finalizedBy: null });
    }),
  );
}

// ── Pengajar ────────────────────────────────────────────────────────────

/**
 * Menyimpan quiz (baru bila `quizId` null). `terbitkan` = true menerbitkan
 * (pemeriksaan penuh, total tepat 100), false = simpan sebagai draf.
 *
 * Setelah ada yang mengerjakan, soal terkunci (teks, pilihan, kunci, urutan);
 * yang boleh berubah hanya poin, judul, deskripsi, dan setelan. Nilai siswa
 * dihitung ulang otomatis dari poin baru (lihat hitungNilai).
 */
export async function saveQuiz(classId: string, quizId: string | null, input: unknown, terbitkan: boolean): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak mengelola quiz di kelas ini." };

  const isi = validasiQuiz(input, terbitkan === true);
  if (!isi.ok) return { ok: false, error: isi.error };

  const waktu = now();

  // Banner: tak dikirim = tak diubah, null = dibuang, string = gambar baru (path wajib milik uid SESI).
  const r = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  let banner: string | null | undefined = undefined;
  if (r.bannerURL === null) banner = null;
  else if (r.bannerURL !== undefined) {
    banner = urlGambarSah(r.bannerURL, user.uid);
    if (!banner) return { ok: false, error: "Banner quiz tidak valid." };
  }

  if (quizId) {
    const lama = await getQuiz(classId, quizId);
    if (!lama) return { ok: false, error: "Quiz tidak ditemukan." };

    const percobaan = await listPercobaan(classId, quizId);
    if (percobaan.length > 0) {
      if (!strukturSama(lama.questions, isi.value.questions)) {
        return {
          ok: false,
          error: "Soal tidak bisa diubah karena sudah ada yang mengerjakan. Poin, judul, dan setelan masih bisa diubah.",
        };
      }
      if (lama.published && !terbitkan) {
        return { ok: false, error: "Quiz yang sudah dikerjakan tidak bisa dijadikan draf. Gunakan Tutup quiz." };
      }
    }

    await quizzesRef(classId)
      .doc(quizId)
      .update({ ...isi.value, ...(banner !== undefined ? { bannerURL: banner } : {}), published: terbitkan === true, updatedAt: waktu });
    // Banner lama dibuang (upaya terbaik) setelah yang baru tersimpan.
    const lamaBanner = pathGambar(lama.bannerURL);
    if (banner !== undefined && lamaBanner && lama.bannerURL !== banner) void deleteObjects([lamaBanner]).catch(() => 0);
    segarkan(classId, quizId);
    return { ok: true, message: terbitkan ? "Quiz diterbitkan." : "Draf quiz disimpan.", quizId };
  }

  if ((await listQuizzes(classId)).length >= MAX_QUIZ_PER_KELAS) {
    return { ok: false, error: `Satu kelas maksimal ${MAX_QUIZ_PER_KELAS} quiz.` };
  }

  const ref = quizzesRef(classId).doc();
  await ref.set({
    ...isi.value,
    bannerURL: banner ?? null,
    classId,
    authorUid: user.uid,
    published: terbitkan === true,
    closed: false,
    extraMin: 0,
    createdAt: waktu,
    updatedAt: waktu,
  });
  segarkan(classId);
  return { ok: true, message: terbitkan ? "Quiz diterbitkan." : "Draf quiz disimpan.", quizId: ref.id };
}

export async function deleteQuiz(classId: string, quizId: string): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak menghapus quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz) return { ok: false, error: "Quiz tidak ditemukan." };

  // Percobaan hidup di koleksi terpisah: dihapus lebih dulu, baru quiznya.
  await hapusPercobaanQuiz(classId, quizId);
  await quizzesRef(classId).doc(quizId).delete();
  const banner = pathGambar(quiz.bannerURL);
  if (banner) void deleteObjects([banner]).catch(() => 0);
  segarkan(classId, quizId);
  return { ok: true, message: "Quiz dihapus." };
}

/** Menutup quiz (tak ada yang bisa mulai/mengumpulkan; kunci terbuka bagi siswa) atau membukanya kembali. */
export async function setQuizClosed(classId: string, quizId: string, closed: boolean): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { ok: false, error: "Quiz tidak ditemukan atau belum diterbitkan." };

  await quizzesRef(classId).doc(quizId).update({ closed: closed === true, updatedAt: now() });

  if (closed !== true) await bukaKembali({ ...quiz, closed: false }, await listPercobaan(classId, quizId));
  segarkan(classId, quizId);
  return { ok: true, message: closed ? "Quiz ditutup." : "Quiz dibuka kembali." };
}

/**
 * Menambah waktu: `uid` null = SEMUA siswa, selain itu satu siswa. Siswa yang
 * waktunya sudah habis dibuka kembali bila waktu barunya masih tersisa.
 */
export async function addQuizTime(classId: string, quizId: string, menit: unknown, uid: string | null): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const m = typeof menit === "number" ? menit : Number(menit);
  if (!Number.isInteger(m) || m < 1 || m > MAX_TAMBAH_MENIT) {
    return { ok: false, error: `Tambahan waktu harus 1-${MAX_TAMBAH_MENIT} menit.` };
  }

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { ok: false, error: "Quiz tidak ditemukan atau belum diterbitkan." };
  if (quiz.settings.durationMin === null) return { ok: false, error: "Quiz ini tanpa batas waktu." };
  if (quiz.closed) return { ok: false, error: "Quiz sedang ditutup. Buka kembali dulu." };

  if (uid) {
    const p = await getPercobaan(classId, quizId, uid);
    if (!p) return { ok: false, error: "Siswa itu belum memulai quiz." };
    await percobaanRef(p.id).update({ extraSec: p.extraSec + m * 60 });
    await bukaKembali(quiz, [{ ...p, extraSec: p.extraSec + m * 60 }]);
  } else {
    const baru = { ...quiz, extraMin: quiz.extraMin + m };
    await quizzesRef(classId).doc(quizId).update({ extraMin: baru.extraMin, updatedAt: now() });
    await bukaKembali(baru, await listPercobaan(classId, quizId));
  }

  segarkan(classId, quizId);
  return { ok: true, message: uid ? `Waktu siswa ditambah ${m} menit.` : `Waktu semua siswa ditambah ${m} menit.` };
}

/** Poin esai seorang siswa. Hanya untuk percobaan yang sudah dikumpulkan/ditutup. */
export async function gradeQuizEssay(classId: string, quizId: string, studentUid: string, scores: unknown): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak menilai quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz) return { ok: false, error: "Quiz tidak ditemukan." };

  const awal = await getPercobaan(classId, quizId, studentUid);
  if (!awal) return { ok: false, error: "Siswa itu belum mengerjakan quiz." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now());
  if (!p.submittedAt) return { ok: false, error: "Siswa itu masih mengerjakan. Nilai setelah dikumpulkan." };

  const nilai = validasiNilaiEsai(quiz, scores);
  if (!nilai) return { ok: false, error: "Poin esai tidak sah (bilangan bulat 0 sampai poin soalnya)." };

  await percobaanRef(p.id).update({ essayScores: { ...p.essayScores, ...nilai } });
  segarkan(classId, quizId);
  return { ok: true, message: "Nilai esai disimpan." };
}

/** Menghapus percobaan seorang siswa supaya ia bisa mengulang dari awal. */
export async function resetQuizAttempt(classId: string, quizId: string, studentUid: string): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const p = await getPercobaan(classId, quizId, studentUid);
  if (!p) return { ok: false, error: "Siswa itu belum mengerjakan quiz." };
  await percobaanRef(p.id).delete();
  segarkan(classId, quizId);
  return { ok: true, message: "Percobaan siswa dihapus. Ia bisa mengulang." };
}

// ── Siswa ───────────────────────────────────────────────────────────────

/** Quiz yang BOLEH dikerjakan pembaca ini, atau pesan galat. */
async function siapkanSiswa(classId: string, quizId: string) {
  const user = await getCurrentUser();
  if (!user) return { galat: "Silakan masuk terlebih dahulu.", user: null, quiz: null } as const;

  const akses = await requireClassAccess(user, classId);
  if (!akses?.isMember) return { galat: "Hanya peserta kelas yang mengerjakan quiz.", user: null, quiz: null } as const;

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { galat: "Quiz tidak ditemukan.", user: null, quiz: null } as const;
  return { galat: null, user, quiz } as const;
}

export async function startQuiz(classId: string, quizId: string): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;

  if (quiz.closed) return { ok: false, error: "Quiz ini sudah ditutup." };
  // Jam server yang berwenang: mengubah jam perangkat tak membuka quiz lebih awal.
  if (!sudahDibuka(quiz, Date.now())) {
    return { ok: false, error: `Quiz ini baru dibuka pada ${formatWib(quiz.opensAt)}.` };
  }
  if (quiz.questions.length === 0) return { ok: false, error: "Quiz ini belum punya soal." };

  const id = idPercobaan(classId, quizId, user.uid);
  try {
    // create(): gagal bila sudah ada, jadi klik ganda tak mengulang waktu mulai.
    await percobaanRef(id).create({
      classId,
      quizId,
      uid: user.uid,
      startedAt: now(),
      submittedAt: null,
      finalizedBy: null,
      answers: {},
      order: urutanUntukSiswa(quiz, user.uid),
      extraSec: 0,
      essayScores: {},
    });
  } catch (e) {
    if ((e as { code?: number }).code !== 6) throw e;
  }

  segarkan(classId, quizId);
  return { ok: true, message: "Quiz dimulai." };
}

/**
 * Menyimpan jawaban sementara (dipanggil berkala oleh pengerja). Setelah waktu
 * habis kiriman diabaikan - jawaban terakhir yang TERSIMPAN yang dinilai.
 */
export async function saveQuizAnswers(classId: string, quizId: string, answers: unknown): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;

  const awal = await getPercobaan(classId, quizId, user.uid);
  if (!awal) return { ok: false, error: "Mulai quiz dulu." };
  const p = await selesaikanBilaPerlu(quiz, awal, Date.now() - TOLERANSI_DETIK * 1000);
  if (p.submittedAt) return { ok: false, error: "Waktu habis atau quiz sudah dikumpulkan." };

  await percobaanRef(p.id).update({ answers: bersihkanJawaban(quiz, answers) });
  return { ok: true, message: "Tersimpan." };
}

/**
 * Mengumpulkan quiz. Kiriman yang tiba dalam toleransi singkat setelah batas
 * waktu masih dihitung (waktu pengumpulan dijepit ke batasnya); lebih lambat
 * dari itu, yang dinilai hanya jawaban yang sudah tersimpan.
 */
export async function submitQuiz(classId: string, quizId: string, answers: unknown): Promise<QuizResult> {
  const s = await siapkanSiswa(classId, quizId);
  if (s.galat !== null) return { ok: false, error: s.galat };
  const { user, quiz } = s;

  const awal = await getPercobaan(classId, quizId, user.uid);
  if (!awal) return { ok: false, error: "Mulai quiz dulu." };

  const sekarang = Date.now();
  const bersih = bersihkanJawaban(quiz, answers);

  const hasil = await adminDb().runTransaction(async (tx) => {
    const ref = percobaanRef(awal.id);
    const snap = await tx.get(ref);
    if (!snap.exists) return "tidak-ada" as const;
    const data = snap.data() ?? {};
    if (typeof data.submittedAt === "string" && data.submittedAt) return "sudah" as const;

    const batas = batasWaktuMs(quiz, { startedAt: String(data.startedAt ?? ""), extraSec: Number(data.extraSec ?? 0) });
    const terlambat = batas !== null && sekarang > batas + TOLERANSI_DETIK * 1000;
    if (terlambat || quiz.closed) {
      tx.update(ref, { submittedAt: new Date(batas !== null && terlambat ? batas : sekarang).toISOString(), finalizedBy: terlambat ? "waktu" : "ditutup" });
      return "habis" as const;
    }

    const pada = batas !== null ? Math.min(sekarang, batas) : sekarang;
    tx.update(ref, { answers: bersih, submittedAt: new Date(pada).toISOString(), finalizedBy: "siswa" });
    return "ok" as const;
  });

  segarkan(classId, quizId);
  if (hasil === "ok") return { ok: true, message: "Quiz dikumpulkan." };
  if (hasil === "sudah") return { ok: false, error: "Quiz ini sudah dikumpulkan." };
  if (hasil === "habis") return { ok: false, error: "Waktu habis. Jawaban terakhir yang tersimpan sudah dikumpulkan otomatis." };
  return { ok: false, error: "Mulai quiz dulu." };
}

/**
 * "Peringatkan murid": menyimpan peringatan untuk siswa yang BELUM memulai quiz.
 * Siswa mengambilnya lewat /api/classes/quiz-alert (poll) dan layarnya ditutupi
 * peringatan + alarm 2 detik. Hanya pengelola; sasaran dihitung SERVER saat ini
 * (anggota tanpa percobaan), dan ada jeda antar kiriman supaya tak jadi teror.
 */
export async function warnQuizStudents(classId: string, quizId: string): Promise<QuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!(await requireOwnedClass(user, classId))) return { ok: false, error: "Anda tidak berhak mengubah quiz ini." };

  const quiz = await getQuiz(classId, quizId);
  if (!quiz || !quiz.published) return { ok: false, error: "Quiz tidak ditemukan atau belum diterbitkan." };
  if (quiz.closed) return { ok: false, error: "Quiz sudah ditutup." };
  const sekarang = Date.now();
  if (!sudahDibuka(quiz, sekarang)) return { ok: false, error: "Quiz belum dibuka. Peringatan bisa dikirim setelah jadwal mulai." };

  const ref = peringatanRef(classId).doc(quizId);
  const lama = await ref.get();
  const sisa = sisaJedaPeringatan(lama.exists ? toPeringatan(quizId, lama.data() ?? {}) : null, sekarang);
  if (sisa > 0) return { ok: false, error: `Tunggu ${sisa} detik sebelum memperingatkan lagi.` };

  const sudah = new Set((await listPercobaan(classId, quizId)).map((p) => p.uid));
  const sasaran = (await listClassMembers(classId)).map((m) => m.uid).filter((uid) => !sudah.has(uid));
  if (sasaran.length === 0) return { ok: false, error: "Semua siswa sudah memulai quiz ini." };

  await ref.set({ at: new Date(sekarang).toISOString(), uids: sasaran, byUid: user.uid });
  return { ok: true, message: `Peringatan dikirim ke ${sasaran.length} siswa.` };
}
