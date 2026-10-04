import "server-only";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { deleteObjects } from "@/lib/storageCleanup";
import {
  MAX_CLASS_FILE_BYTES,
  toBerkasList,
  type KelasBerkas,
  type KelasSubmission,
} from "@/lib/classAssignmentRules";
import type { KelasPost } from "@/lib/classTypes";

/**
 * Data pengumpulan tugas kelas, pemeriksa berkas, dan pembersihnya.
 *
 * Modul `server-only` TANPA penjaga peran — sengaja tidak ber-"use server".
 * Setiap ekspor berkas "use server" adalah endpoint publik; fungsi di sini
 * (mis. menghapus seluruh pengumpulan sebuah kelas) hanya boleh dipanggil
 * dari action yang sudah memeriksa sesi & kepemilikan.
 */

export const CLASS_SUBMISSIONS = "classSubmissions";

/** Deterministik: mengumpulkan dua kali menyentuh dokumen yang sama. */
export function classSubmissionId(classId: string, postId: string, uid: string): string {
  return `${classId}_${postId}_${uid}`;
}

export function classSubmissionRef(id: string) {
  return adminDb().collection(CLASS_SUBMISSIONS).doc(id);
}

export function toClassSubmission(id: string, d: FirebaseFirestore.DocumentData): KelasSubmission {
  return {
    id,
    classId: (d.classId as string | undefined) ?? "",
    postId: (d.postId as string | undefined) ?? "",
    uid: (d.uid as string | undefined) ?? "",
    text: (d.text as string | undefined) ?? "",
    files: toBerkasList(d.files),
    status: d.status === "graded" ? "graded" : "submitted",
    late: d.late === true,
    grade: typeof d.grade === "number" ? d.grade : null,
    feedback: typeof d.feedback === "string" ? d.feedback : null,
    submittedAt: (d.submittedAt as string | undefined) ?? "",
    gradedAt: typeof d.gradedAt === "string" ? d.gradedAt : null,
    gradedByUid: typeof d.gradedByUid === "string" ? d.gradedByUid : null,
  };
}

export async function getClassSubmission(id: string): Promise<KelasSubmission | null> {
  const snap = await classSubmissionRef(id).get();
  return snap.exists ? toClassSubmission(snap.id, snap.data() ?? {}) : null;
}

/**
 * Seluruh pengumpulan satu kelas — kueri satu field, disaring di memori.
 * Dipakai untuk hitungan di tab Tugas pengajar dan untuk pembersihan.
 */
export async function listClassSubmissions(classId: string): Promise<KelasSubmission[]> {
  const snap = await adminDb().collection(CLASS_SUBMISSIONS).where("classId", "==", classId).get();
  return snap.docs.map((d) => toClassSubmission(d.id, d.data()));
}

export async function listPostSubmissions(classId: string, postId: string): Promise<KelasSubmission[]> {
  const snap = await adminDb().collection(CLASS_SUBMISSIONS).where("postId", "==", postId).get();
  return snap.docs
    .map((d) => toClassSubmission(d.id, d.data()))
    .filter((s) => s.classId === classId);
}

/** Pengumpulan MILIK satu orang untuk sederet tugas, lewat ID deterministik. */
export async function getMySubmissions(
  uid: string,
  classId: string,
  postIds: readonly string[],
): Promise<Map<string, KelasSubmission>> {
  const out = new Map<string, KelasSubmission>();
  if (postIds.length === 0) return out;

  const refs = postIds.map((p) => classSubmissionRef(classSubmissionId(classId, p, uid)));
  const snaps = await adminDb().getAll(...refs);
  for (const s of snaps) {
    if (!s.exists) continue;
    const sub = toClassSubmission(s.id, s.data() ?? {});
    out.set(sub.postId, sub);
  }
  return out;
}

/** Hitungan terkumpul & dinilai per tugas, untuk tab Tugas pengajar. */
export async function hitunganPengumpulan(
  classId: string,
): Promise<Map<string, { kumpul: number; dinilai: number }>> {
  const out = new Map<string, { kumpul: number; dinilai: number }>();
  for (const s of await listClassSubmissions(classId)) {
    const h = out.get(s.postId) ?? { kumpul: 0, dinilai: 0 };
    h.kumpul++;
    if (s.status === "graded") h.dinilai++;
    out.set(s.postId, h);
  }
  return out;
}

/**
 * Jam server untuk halaman. Satu nilai per render, dioper ke seluruh
 * komponen, supaya dua baris di halaman yang sama tidak menilai tenggat
 * dengan "sekarang" yang berbeda.
 */
export function jamServer(): number {
  return Date.now();
}

// ── Pemeriksa berkas ────────────────────────────────────────────────────

export type BerkasHasil = { ok: true; files: KelasBerkas[] } | { ok: false; error: string };

/**
 * Mengubah daftar `{path, name}` kiriman browser menjadi berkas yang tercatat.
 *
 * Yang dipercaya dari browser hanya NAMA tampilan. Path harus berada di
 * folder milik pengirim untuk kelas (dan tugas) ini — tanpa itu satu
 * panggilan mentah bisa menautkan berkas orang lain ke postingan sendiri.
 * Ukuran dan MIME dibaca ULANG dari Storage: storage.rules memang sudah
 * menyaring keduanya, tapi rules tidak ikut deploy otomatis, dan aturan uang
 * repo ini berlaku juga di sini — angka dari browser tidak dipercaya.
 */
export async function periksaBerkas(
  raw: unknown,
  awalan: string,
  mimeBoleh: readonly string[],
  maks: number,
): Promise<BerkasHasil> {
  if (raw === undefined || raw === null) return { ok: true, files: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Daftar berkas tidak sah." };
  if (raw.length > maks) return { ok: false, error: `Maksimal ${maks} berkas.` };

  const bucket = adminStorage().bucket();
  const files: KelasBerkas[] = [];
  const dilihat = new Set<string>();

  for (const item of raw) {
    const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const path = typeof r.path === "string" ? r.path : "";

    // `..` dan `//` ditolak sekalipun Storage memperlakukannya sebagai nama
    // biasa: awalan yang dicocokkan secara teks tidak boleh punya celah.
    if (!path.startsWith(awalan) || path.includes("..") || path.includes("//") || path.length > 500) {
      return { ok: false, error: "Berkas tidak sah." };
    }
    if (dilihat.has(path)) continue;
    dilihat.add(path);

    const berkas = bucket.file(path);
    const [ada] = await berkas.exists();
    if (!ada) return { ok: false, error: "Berkas belum terunggah. Coba lagi." };

    const [meta] = await berkas.getMetadata();
    const size = Number(meta.size ?? 0);
    const mime = meta.contentType ?? "";

    if (!mimeBoleh.includes(mime)) return { ok: false, error: "Format berkas tidak diterima." };
    if (!(size > 0) || size >= MAX_CLASS_FILE_BYTES) {
      return { ok: false, error: "Ukuran berkas harus di bawah 20 MB." };
    }

    const nama = typeof r.name === "string" ? r.name.replace(/[\r\n"\\]/g, "").trim().slice(0, 200) : "";
    files.push({ name: nama || "berkas", path, size, mime });
  }

  return { ok: true, files };
}

// ── Pembersihan ─────────────────────────────────────────────────────────

/** Menghapus dokumen pengumpulan beserta berkasnya. Kegagalan berkas tidak dilempar. */
async function hapusPengumpulan(subs: readonly KelasSubmission[]): Promise<void> {
  if (subs.length === 0) return;

  const db = adminDb();
  // 400 per batch, di bawah batas 500 tulisan Firestore.
  for (let i = 0; i < subs.length; i += 400) {
    const batch = db.batch();
    for (const s of subs.slice(i, i + 400)) batch.delete(classSubmissionRef(s.id));
    await batch.commit();
  }

  await deleteObjects(subs.flatMap((s) => s.files.map((f) => f.path))).catch(() => 0);
}

/**
 * Sisa sebuah postingan setelah dokumennya dihapus: lampiran pengajar dan
 * seluruh pengumpulan siswa. Pengumpulan hidup di koleksi TERPISAH, jadi
 * recursiveDelete pada postingan tidak menjangkaunya.
 */
export async function bersihkanPost(classId: string, post: KelasPost): Promise<void> {
  await hapusPengumpulan(await listPostSubmissions(classId, post.id));
  await deleteObjects(post.attachments.map((a) => a.path)).catch(() => 0);
}

/** Sama, untuk seluruh kelas. `posts` dibaca SEBELUM kelasnya dihapus. */
export async function bersihkanKelas(classId: string, posts: readonly KelasPost[]): Promise<void> {
  await hapusPengumpulan(await listClassSubmissions(classId));
  await deleteObjects(posts.flatMap((p) => p.attachments.map((a) => a.path))).catch(() => 0);
}
