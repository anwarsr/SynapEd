"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess, requireOwnedClass } from "@/lib/classGuards";
import { getPost } from "@/lib/classes";
import {
  classSubmissionId,
  classSubmissionRef,
  periksaBerkas,
  toClassSubmission,
} from "@/lib/classAssignments";
import {
  MAX_ANSWER_TEXT,
  MAX_CLASS_FEEDBACK,
  MAX_FILES_PER_SUBMISSION,
  lewatTenggat,
  masihDibuka,
  mimeUntukFormat,
  validasiNilai,
} from "@/lib/classAssignmentRules";
import { deleteObjects } from "@/lib/storageCleanup";
import { CLASS_SUBMISSION_FILES } from "@/lib/storagePaths";

export type TugasResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Pengumpulan, pembatalan, dan penilaian tugas kelas.
 *
 * Penjaga yang menopang seluruh gunanya, semuanya diperiksa DI SINI karena
 * setiap ekspor berkas ini bisa di-POST langsung tanpa membuka halamannya:
 *
 *   1. Yang MENGUMPULKAN hanya anggota kelas, untuk dirinya sendiri (uid dari
 *      sesi), dengan berkas dari folder miliknya untuk tugas INI saja.
 *   2. Tenggat diukur dengan jam SERVER. Jam browser bisa dimundurkan.
 *   3. Format dibaca dari tugasnya, bukan dari formulir: berkas yang tidak
 *      diminta pengajar ditolak meski formulirnya diakali.
 *   4. Yang MENILAI hanya pemilik kelas atau admin, dan nilai yang sudah ada
 *      mengunci pengiriman dari pembatalan siswa.
 */

function clean(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function segarkan(classId: string, postId: string) {
  revalidatePath(`/kelas/${classId}`);
  revalidatePath(`/kelas/${classId}/tugas/${postId}`);
  revalidatePath(`/educator/classes/${classId}`);
  revalidatePath(`/educator/classes/${classId}/tugas/${postId}`);
}

/** Tugas di kelas ini, atau null kalau postingannya bukan tugas. */
async function ambilTugas(classId: string, postId: string) {
  const post = await getPost(classId, postId);
  return post && post.kind === "assignment" && post.assignment ? { post, p: post.assignment } : null;
}

// ── Pengajar ────────────────────────────────────────────────────────────

export async function gradeClassSubmission(
  classId: string,
  postId: string,
  studentUid: string,
  gradeRaw: unknown,
  feedbackRaw: unknown,
): Promise<TugasResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const kelas = await requireOwnedClass(user, classId);
  if (!kelas) return { ok: false, error: "Anda tidak berhak menilai tugas ini." };

  const tugas = await ambilTugas(classId, postId);
  if (!tugas) return { ok: false, error: "Tugas tidak ditemukan." };

  const grade = validasiNilai(gradeRaw, tugas.p.maxPoints);
  if (grade === null) {
    return { ok: false, error: `Nilai harus bilangan bulat 0–${tugas.p.maxPoints}.` };
  }

  const feedback = clean(feedbackRaw, MAX_CLASS_FEEDBACK);
  const ref = classSubmissionRef(classSubmissionId(classId, postId, String(studentUid)));

  // Transaksi: siswa bisa membatalkan pengirimannya tepat saat dinilai, dan
  // nilai tidak boleh menempel pada dokumen yang baru saja hilang.
  const galat = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "Siswa ini belum mengumpulkan.";

    tx.update(ref, {
      status: "graded",
      grade,
      feedback: feedback || null,
      gradedAt: new Date().toISOString(),
      gradedByUid: user.uid,
    });
    return null;
  });
  if (galat) return { ok: false, error: galat };

  segarkan(classId, postId);
  return { ok: true, message: "Nilai disimpan." };
}

// ── Siswa ───────────────────────────────────────────────────────────────

/**
 * Mengumpulkan jawaban: teks, berkas, atau keduanya — sesuai format tugasnya.
 *
 * Satu pengiriman per siswa per tugas. Untuk menggantinya, siswa membatalkan
 * dulu (selama belum dinilai dan pengumpulan masih dibuka), lalu mengirim lagi.
 */
export async function submitClassAssignment(
  classId: string,
  postId: string,
  input: unknown,
): Promise<TugasResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const akses = await requireClassAccess(user, classId);
  if (!akses) return { ok: false, error: "Anda bukan anggota kelas ini." };
  // Pemilik/admin tidak punya keanggotaan — pengajar tidak mengumpulkan tugas.
  if (!akses.isMember) return { ok: false, error: "Hanya peserta kelas yang mengumpulkan tugas." };

  const tugas = await ambilTugas(classId, postId);
  if (!tugas) return { ok: false, error: "Tugas tidak ditemukan." };
  const { p } = tugas;

  const saat = Date.now();
  if (!masihDibuka(p, saat)) {
    return { ok: false, error: "Tenggat sudah lewat dan tugas ini tidak menerima pengumpulan terlambat." };
  }

  const r = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const text = clean(r.text, MAX_ANSWER_TEXT);
  if (text && !p.formats.includes("text")) {
    return { ok: false, error: "Tugas ini tidak menerima jawaban teks — lampirkan berkas." };
  }

  const berkas = await periksaBerkas(
    r.files,
    `${CLASS_SUBMISSION_FILES}/${user.uid}/${classId}/${postId}/`,
    mimeUntukFormat(p.formats),
    MAX_FILES_PER_SUBMISSION,
  );
  if (!berkas.ok) return { ok: false, error: berkas.error };

  if (!text && berkas.files.length === 0) {
    return { ok: false, error: "Tulis jawaban atau lampirkan berkas terlebih dahulu." };
  }

  const ref = classSubmissionRef(classSubmissionId(classId, postId, user.uid));
  const late = lewatTenggat(p.dueAt, saat);

  const galat = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return toClassSubmission(snap.id, snap.data() ?? {}).status === "graded"
        ? "Tugas Anda sudah dinilai."
        : "Tugas sudah dikumpulkan. Batalkan pengiriman dulu untuk menggantinya.";
    }

    tx.set(ref, {
      classId,
      postId,
      uid: user.uid,
      text,
      files: berkas.files,
      status: "submitted",
      late,
      grade: null,
      feedback: null,
      submittedAt: new Date(saat).toISOString(),
      gradedAt: null,
      gradedByUid: null,
    });
    return null;
  });
  if (galat) return { ok: false, error: galat };

  segarkan(classId, postId);
  return { ok: true, message: late ? "Tugas terkumpul (terlambat)." : "Tugas terkumpul." };
}

/**
 * Membatalkan pengiriman: dokumen DAN berkasnya dihapus.
 *
 * Ditolak setelah dinilai (nilai tidak boleh hilang diam-diam), dan setelah
 * tenggat bila tugasnya tidak menerima keterlambatan — kalau tidak, siswa
 * bisa membatalkan lalu tidak bisa mengirim lagi sama sekali.
 */
export async function unsubmitClassAssignment(classId: string, postId: string): Promise<TugasResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const akses = await requireClassAccess(user, classId);
  if (!akses?.isMember) return { ok: false, error: "Anda bukan anggota kelas ini." };

  const tugas = await ambilTugas(classId, postId);
  if (!tugas) return { ok: false, error: "Tugas tidak ditemukan." };

  if (!masihDibuka(tugas.p, Date.now())) {
    return { ok: false, error: "Tenggat sudah lewat; pengiriman tidak bisa dibatalkan lagi." };
  }

  const id = classSubmissionId(classId, postId, user.uid);
  const ref = classSubmissionRef(id);

  const hasil = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { galat: "Belum ada pengiriman untuk dibatalkan.", berkas: [] as string[] };

    const sub = toClassSubmission(snap.id, snap.data() ?? {});
    if (sub.status === "graded") {
      return { galat: "Tugas yang sudah dinilai tidak bisa dibatalkan.", berkas: [] as string[] };
    }

    tx.delete(ref);
    return { galat: null, berkas: sub.files.map((f) => f.path) };
  });
  if (hasil.galat) return { ok: false, error: hasil.galat };

  // Berkas dibuang SETELAH dokumennya hilang: sebaliknya, kegagalan di tengah
  // meninggalkan pengiriman yang menunjuk berkas yang sudah tidak ada.
  await deleteObjects(hasil.berkas).catch(() => 0);

  segarkan(classId, postId);
  return { ok: true, message: "Pengiriman dibatalkan." };
}

