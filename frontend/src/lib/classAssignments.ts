import "server-only";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { deleteObjects } from "@/lib/storageCleanup";
import {
  MAX_CLASS_FILE_BYTES,
  toBerkasList,
  toPengaturanAi,
  type KelasBerkas,
  type KelasSubmission,
  type PengaturanAi,
} from "@/lib/classAssignmentRules";
import type { KelasPost } from "@/lib/classTypes";
import { MIME_MODEL3D, MIME_UNGGAH_MODEL3D, adaMeshGanda, validasiAnotasi, validasiJudulModel, type Hasil3D, type Model3D } from "@/lib/model3dRules";
import { postsRef } from "@/lib/classes";

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

// ── Pengaturan koreksi AI ───────────────────────────────────────────────

/**
 * Pengaturan koreksi AI satu tugas, dibaca langsung dari field `aiGrading`.
 *
 * Tidak lewat `toPost`/`KelasPost` dengan sengaja (lihat classAssignmentRules):
 * berkas konteksnya bisa berupa kunci jawaban, jadi hanya halaman pengelola
 * dan action penilaian yang memanggil fungsi ini.
 */
export async function getPengaturanAi(classId: string, postId: string): Promise<PengaturanAi> {
  const snap = await postsRef(classId).doc(postId).get();
  return toPengaturanAi(snap.data()?.aiGrading);
}

/** Path berkas konteks AI seluruh tugas sebuah kelas — dibaca SEBELUM kelasnya dihapus. */
export async function berkasAiKelas(classId: string): Promise<string[]> {
  const snap = await postsRef(classId).get();
  return snap.docs.flatMap((d) => toPengaturanAi(d.data().aiGrading).files.map((f) => f.path));
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

/**
 * Memeriksa berkas .glb kiriman browser dan membacanya ulang dari Storage.
 *
 * Selain ukuran & MIME (lewat `periksaBerkas`), 12 byte pertama dibaca:
 * berkas GLB sah selalu diawali ajaib "glTF" dan versi 2. Tanpa ini siapa
 * pun bisa menamai berkas apa saja `.glb` dan membuat peramban murid
 * menguraikannya sebagai model.
 */
export async function periksaBerkasModel(raw: unknown, awalan: string): Promise<Hasil3D<Model3D["file"]>> {
  const hasil = await periksaBerkas(raw === undefined || raw === null ? [] : [raw], awalan, [MIME_MODEL3D, MIME_UNGGAH_MODEL3D], 1);
  if (!hasil.ok) return { ok: false, error: hasil.error };
  const berkas = hasil.files[0];
  if (!berkas) return { ok: false, error: "Berkas objek 3D belum terunggah. Coba lagi." };
  if (!berkas.name.toLowerCase().endsWith(".glb")) return { ok: false, error: "Objek 3D harus berkas .glb." };

  const kepala = await new Promise<Buffer>((resolve, reject) => {
    const potong: Buffer[] = [];
    adminStorage()
      .bucket()
      .file(berkas.path)
      .createReadStream({ start: 0, end: 11 })
      .on("data", (c: Buffer) => potong.push(c))
      .on("end", () => resolve(Buffer.concat(potong)))
      .on("error", reject);
  });
  if (kepala.length < 12 || kepala.toString("latin1", 0, 4) !== "glTF" || kepala.readUInt32LE(4) !== 2) {
    return { ok: false, error: "Berkas itu bukan GLB (glTF 2.0) yang sah." };
  }
  return { ok: true, value: { ...berkas, mime: MIME_MODEL3D } };
}

/**
 * Bentuk `model3d` dari formulir → yang disimpan.
 *
 * `lama` = model yang sudah tersimpan di postingan (untuk edit). Berkas yang
 * tidak dikirim ulang hanya boleh berarti "pertahankan berkas lama" — path
 * dari browser tidak pernah dipercaya untuk menunjuk berkas yang tak dimiliki
 * postingan ini.
 */
export async function periksaModel3D(
  raw: unknown,
  awalan: string,
  lama: Model3D | null,
): Promise<Hasil3D<Model3D>> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const anotasi = validasiAnotasi(r.annotations);
  if (!anotasi.ok) return anotasi;
  if (adaMeshGanda(anotasi.value)) return { ok: false, error: "Satu komponen hanya boleh punya satu keterangan." };

  let file: Model3D["file"];
  if (r.file !== undefined && r.file !== null) {
    const baru = await periksaBerkasModel(r.file, awalan);
    if (!baru.ok) return baru;
    file = baru.value;
  } else if (lama) {
    file = lama.file;
  } else {
    return { ok: false, error: "Berkas objek 3D belum dipilih." };
  }

  return { ok: true, value: { file, title: validasiJudulModel(r.title, file.name), annotations: anotasi.value } };
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
 * Sisa sebuah postingan setelah dokumennya dihapus: lampiran pengajar, berkas
 * konteks AI, dan seluruh pengumpulan siswa. Pengumpulan hidup di koleksi
 * TERPISAH, jadi recursiveDelete pada postingan tidak menjangkaunya. Path
 * berkas AI dioper pemanggil karena hanya terbaca sebelum dokumennya hilang.
 */
export async function bersihkanPost(classId: string, post: KelasPost, berkasAi: readonly string[] = []): Promise<void> {
  await hapusPengumpulan(await listPostSubmissions(classId, post.id));
  await deleteObjects([...post.attachments.map((a) => a.path), ...(post.model3d ? [post.model3d.file.path] : []), ...berkasAi]).catch(() => 0);
}

/** Sama, untuk seluruh kelas. `posts` & `berkasAi` dibaca SEBELUM kelasnya dihapus. */
export async function bersihkanKelas(
  classId: string,
  posts: readonly KelasPost[],
  berkasAi: readonly string[] = [],
): Promise<void> {
  await hapusPengumpulan(await listClassSubmissions(classId));
  await deleteObjects([
    ...posts.flatMap((p) => [...p.attachments.map((a) => a.path), ...(p.model3d ? [p.model3d.file.path] : [])]),
    ...berkasAi,
  ]).catch(() => 0);
}
