import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { classRef } from "@/lib/classes";
import { getUserCards } from "@/lib/userCards";
import {
  harusSelesai,
  idPercobaan,
  peringkatTeratas,
  toPercobaan,
  toQuiz,
  urutanSahih,
  type PercobaanQuiz,
  type Quiz,
  type SoalQuiz,
} from "@/lib/classQuizRules";

/**
 * Data quiz kelas: kueri, penutupan percobaan yang waktunya habis, pembersih,
 * dan bentuk "aman untuk siswa".
 *
 * Modul `server-only` TANPA penjaga peran - sengaja tidak ber-"use server".
 * Setiap ekspor berkas "use server" adalah endpoint publik; fungsi di sini
 * (mis. menghapus seluruh percobaan sebuah kelas) hanya boleh dipanggil dari
 * action/halaman yang sudah memeriksa sesi & kepemilikan.
 *
 * Quiz hidup di subkoleksi `classes/{id}/quizzes` (ikut terhapus oleh
 * recursiveDelete kelas); percobaan siswa di koleksi TERPISAH
 * `classQuizAttempts` dengan id deterministik `{classId}_{quizId}_{uid}` -
 * satu percobaan per siswa, seperti classSubmissions.
 */

export const QUIZZES = "quizzes";
export const QUIZ_ATTEMPTS = "classQuizAttempts";

export function quizzesRef(classId: string) {
  return classRef(classId).collection(QUIZZES);
}

export function percobaanRef(id: string) {
  return adminDb().collection(QUIZ_ATTEMPTS).doc(id);
}

export async function listQuizzes(classId: string): Promise<Quiz[]> {
  const snap = await quizzesRef(classId).get();
  return snap.docs.map((d) => toQuiz(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getQuiz(classId: string, quizId: string): Promise<Quiz | null> {
  const snap = await quizzesRef(classId).doc(quizId).get();
  return snap.exists ? toQuiz(snap.id, snap.data() ?? {}) : null;
}

/** Seluruh percobaan sebuah quiz - kueri satu field, disaring di memori. */
export async function listPercobaan(classId: string, quizId: string): Promise<PercobaanQuiz[]> {
  const snap = await adminDb().collection(QUIZ_ATTEMPTS).where("quizId", "==", quizId).get();
  return snap.docs.map((d) => toPercobaan(d.id, d.data())).filter((p) => p.classId === classId);
}

export async function getPercobaan(classId: string, quizId: string, uid: string): Promise<PercobaanQuiz | null> {
  const snap = await percobaanRef(idPercobaan(classId, quizId, uid)).get();
  return snap.exists ? toPercobaan(snap.id, snap.data() ?? {}) : null;
}

/**
 * Menutup percobaan yang waktunya habis / quiznya ditutup, bila memang sudah
 * waktunya. Dicatat TEPAT di batas waktu (bukan saat halaman kebetulan dibuka),
 * dan dalam transaksi: siswa yang mengumpulkan di detik yang sama tidak tertimpa.
 */
export async function selesaikanBilaPerlu(quiz: Quiz, p: PercobaanQuiz, sekarang: number): Promise<PercobaanQuiz> {
  if (!harusSelesai(quiz, p, sekarang)) return p;

  const ref = percobaanRef(p.id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return p;
    const segar = toPercobaan(snap.id, snap.data() ?? {});
    const h = harusSelesai(quiz, segar, sekarang);
    if (!h) return segar;
    const pada = new Date(h.pada).toISOString();
    tx.update(ref, { submittedAt: pada, finalizedBy: h.alasan });
    return { ...segar, submittedAt: pada, finalizedBy: h.alasan };
  });
}

export async function selesaikanSemua(quiz: Quiz, daftar: readonly PercobaanQuiz[], sekarang: number): Promise<PercobaanQuiz[]> {
  return Promise.all(daftar.map((p) => selesaikanBilaPerlu(quiz, p, sekarang)));
}

// ── Pembersih ───────────────────────────────────────────────────────────

async function hapusDokumen(refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  const db = adminDb();
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const r of refs.slice(i, i + 400)) batch.delete(r);
    await batch.commit();
  }
}

/** Percobaan seluruh kelas - koleksi terpisah, jadi recursiveDelete kelas tak menjangkaunya. */
export async function hapusPercobaanKelas(classId: string): Promise<void> {
  const snap = await adminDb().collection(QUIZ_ATTEMPTS).where("classId", "==", classId).get();
  await hapusDokumen(snap.docs.map((d) => d.ref));
}

export async function hapusPercobaanQuiz(classId: string, quizId: string): Promise<void> {
  const daftar = await listPercobaan(classId, quizId);
  await hapusDokumen(daftar.map((p) => percobaanRef(p.id)));
}

// ── Bentuk aman untuk siswa ─────────────────────────────────────────────

export interface SoalSiswa {
  id: string;
  type: SoalQuiz["type"];
  text: string;
  points: number;
  options: { id: string; text: string }[];
}

/**
 * Soal sesuai URUTAN siswa itu, TANPA kunci jawaban. Satu-satunya bentuk soal
 * yang boleh dikirim ke komponen klien siswa; kunci hanya lewat `KunciSiswa`
 * dan hanya setelah quiz ditutup.
 */
export function soalUntukSiswa(quiz: Quiz, p: PercobaanQuiz): SoalSiswa[] {
  const urutan = urutanSahih(quiz, p.order);
  const peta = new Map(quiz.questions.map((s) => [s.id, s]));
  return urutan.q.flatMap((id) => {
    const s = peta.get(id);
    if (!s) return [];
    const opsi = new Map(s.options.map((o) => [o.id, o]));
    return [
      {
        id: s.id,
        type: s.type,
        text: s.text,
        points: s.points,
        options: (urutan.opt[s.id] ?? []).flatMap((oid) => {
          const o = opsi.get(oid);
          return o ? [{ id: o.id, text: o.text }] : [];
        }),
      },
    ];
  });
}

/** Kunci jawaban: soalId → id opsi benar. Hanya dikirim bila quiz sudah ditutup. */
export function kunciSiswa(quiz: Quiz): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of quiz.questions) if (s.type === "mcq" && s.correct) out[s.id] = s.correct;
  return out;
}

// ── Papan peringkat ─────────────────────────────────────────────────────

export interface BarisPapan {
  uid: string;
  nama: string;
  foto: string | null;
  nilai: number;
  detik: number;
}

/** Tiga teratas beserta nama & foto (satu panggilan Auth untuk seluruhnya). */
export async function muatPapanPeringkat(quiz: Quiz, daftar: readonly PercobaanQuiz[]): Promise<BarisPapan[]> {
  const atas = peringkatTeratas(quiz, daftar);
  if (atas.length === 0) return [];
  const kartu = await getUserCards(atas.map((b) => b.uid));
  return atas.map((b) => ({
    ...b,
    nama: kartu.get(b.uid)?.name ?? "Peserta",
    foto: kartu.get(b.uid)?.photoURL ?? null,
  }));
}

/** Peringatan terakhir per quiz: `classes/{id}/quizAlerts/{quizId}` (satu dokumen, ditimpa tiap kirim). */
export function peringatanRef(classId: string) {
  return classRef(classId).collection("quizAlerts");
}
