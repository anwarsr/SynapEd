"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { getCourse } from "@/lib/courses";
import { LEVELS, ownerUidOf, requireOwnedCourse } from "@/lib/educatorCourses";
import { categoryExists } from "@/lib/categories";
import { resolveThumbnail } from "@/lib/courseThumbnail";
import { canonicalDuration } from "@/lib/duration";
import { normalizeSections, type SectionInput } from "@/lib/curriculum";
import {
  COURSE_REQUESTS,
  getRequest,
  pendingRequestFor,
  requestRef,
  type CourseSnapshot,
  type RequestType,
} from "@/lib/courseRequests";
import {
  attachmentPaths,
  courseFilePaths,
  deleteObjects,
  pruneAttachmentFolders,
} from "@/lib/storageCleanup";
import type { CourseDetail, Section } from "@/lib/courses";
import type { SessionUser } from "@/lib/firebase/session";

export type RequestResult = { ok: true; message: string } | { ok: false; error: string };

const MIN_REASON = 10;
const MAX_REASON = 1000;

/**
 * Alur persetujuan perubahan kursus.
 *
 * Educator tidak lagi mengubah kursus secara langsung; ia mengusulkan, admin
 * memutuskan. Yang mengubah dokumen kursus hanyalah fungsi persetujuan di
 * berkas ini.
 *
 * Admin dikecualikan: ia yang menyetujui, jadi mengantrekan pekerjaannya
 * sendiri untuk disetujui dirinya sendiri hanya menambah langkah tanpa
 * menambah pengawasan. Pengecualian itu dijalankan di courseActions dan
 * curriculumActions, bukan di sini.
 */

async function requireEducatorOwner(slug: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, course: null };

  const course = await requireOwnedCourse(user, slug);
  return { user, course };
}

function cleanReason(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, MAX_REASON) : "";
}

/** Potret bagian kursus yang bisa berubah — dipakai sebagai "sebelum". */
export async function snapshotOf(course: CourseDetail): Promise<CourseSnapshot> {
  return {
    title: course.title,
    shortDesc: course.shortDesc,
    longDesc: course.longDesc,
    level: course.level,
    levelColor: course.levelColor,
    category: course.category,
    duration: course.duration,
    price: course.price,
    thumbnail: course.thumbnail,
    whatYouLearn: course.whatYouLearn ?? [],
    requirements: course.requirements ?? [],
    sections: course.sections ?? [],
  };
}

async function createRequest(input: {
  type: RequestType;
  course: CourseDetail;
  reason: string;
  uid: string;
  name: string;
  before: CourseSnapshot | null;
  after: CourseSnapshot | null;
}): Promise<RequestResult> {
  const now = new Date().toISOString();
  const ref = adminDb().collection(COURSE_REQUESTS).doc();

  await ref.set({
    courseSlug: input.course.slug,
    courseTitle: input.course.title,
    type: input.type,
    reason: input.reason,
    requestedByUid: input.uid,
    requestedByName: input.name,
    status: "pending",
    before: input.before,
    after: input.after,
    createdAt: now,
    decidedAt: null,
    decidedByUid: null,
    decidedByName: null,
    decisionNote: null,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/course-requests");
  revalidatePath("/educator/courses");
  revalidatePath(`/educator/courses/${input.course.slug}/edit`);

  return { ok: true, message: "Pengajuan terkirim. Menunggu persetujuan admin." };
}

/**
 * Penjaga bersama untuk seluruh pengajuan.
 *
 * Satu pengajuan menggantung per kursus. Tanpa aturan itu, dua usulan sunting
 * yang disetujui berurutan akan saling menimpa: yang kedua menulis salinan
 * yang dibuat SEBELUM yang pertama berlaku, sehingga persetujuan pertama
 * diam-diam terhapus.
 */
type Guard =
  | { ok: false; error: string }
  | { ok: true; user: SessionUser; course: CourseDetail };

async function guard(slug: string, reason: string): Promise<Guard> {
  if (reason.length < MIN_REASON) {
    return { ok: false, error: `Tuliskan alasannya, minimal ${MIN_REASON} karakter.` };
  }

  const { user, course } = await requireEducatorOwner(slug);
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (!course) return { ok: false, error: "Anda tidak berhak mengubah kursus ini." };

  const pending = await pendingRequestFor(slug);
  if (pending) {
    return {
      ok: false,
      error: "Masih ada pengajuan untuk kursus ini yang menunggu keputusan admin.",
    };
  }

  return { ok: true, user, course };
}

// ── Pengajuan dari educator ───────────────────────────────────────────

/** Mengajukan perubahan visibility, dua arah — sesuai keputusan pemilik proyek. */
export async function requestVisibilityChange(
  slug: string,
  target: "public" | "private",
  reasonRaw: string,
): Promise<RequestResult> {
  const reason = cleanReason(reasonRaw);
  const g = await guard(slug, reason);
  if (!g.ok) return { ok: false, error: g.error };

  if (g.course.visibility === target) {
    return {
      ok: false,
      error: target === "public" ? "Kursus ini sudah tayang." : "Kursus ini sudah tersembunyi.",
    };
  }

  return createRequest({
    type: target === "public" ? "publish" : "unpublish",
    course: g.course,
    reason,
    uid: g.user.uid,
    name: g.user.name,
    before: null,
    after: null,
  });
}

/** Mengajukan penghapusan kursus. */
export async function requestCourseDeletion(
  slug: string,
  reasonRaw: string,
): Promise<RequestResult> {
  const reason = cleanReason(reasonRaw);
  const g = await guard(slug, reason);
  if (!g.ok) return { ok: false, error: g.error };

  return createRequest({
    type: "delete",
    course: g.course,
    reason,
    uid: g.user.uid,
    name: g.user.name,
    before: null,
    after: null,
  });
}

export interface CourseEditInput {
  title: string;
  shortDesc: string;
  longDesc: string;
  level: string;
  category: string;
  duration: string;
  price: number;
  /** undefined = tidak diubah; null = dihapus; string = path baru. */
  thumbnail?: string | null;
  whatYouLearn: string[];
  requirements: string[];
  sections: SectionInput[];
}

/**
 * Mengajukan suntingan isi kursus.
 *
 * Divalidasi SEKARANG, bukan saat disetujui. Kalau ditunda, admin bisa
 * menyetujui usulan yang ternyata ditolak validator, dan kegagalannya muncul
 * di layar admin atas kesalahan orang lain — jauh dari tempat ia bisa
 * diperbaiki.
 */
export async function requestCourseEdit(
  slug: string,
  input: CourseEditInput,
  reasonRaw: string,
): Promise<RequestResult> {
  const reason = cleanReason(reasonRaw);
  const g = await guard(slug, reason);
  if (!g.ok) return { ok: false, error: g.error };

  const { user, course } = g;

  const title = input.title.trim().slice(0, 120);
  const shortDesc = input.shortDesc.trim().slice(0, 200);
  const longDesc = input.longDesc.trim().slice(0, 4000) || shortDesc;

  if (title.length < 4) return { ok: false, error: "Judul kursus minimal 4 karakter." };
  if (shortDesc.length < 10) return { ok: false, error: "Deskripsi singkat minimal 10 karakter." };

  const level = LEVELS.find((l) => l.value === input.level);
  if (!level) return { ok: false, error: "Tingkat kesulitan tidak valid." };

  const category = input.category.trim().slice(0, 60);
  if (!(await categoryExists(category))) return { ok: false, error: "Kategori tidak valid." };

  const price = Number.isFinite(input.price) && input.price >= 0 ? Math.round(input.price) : 0;

  let thumbnail = course.thumbnail;
  if (input.thumbnail !== undefined) {
    const resolved = resolveThumbnail(input.thumbnail, [user.uid, ownerUidOf(course) ?? ""]);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    thumbnail = resolved.value;
  }

  // Lampiran lama berasal dari folder pemilik ASLI kursus; lampiran yang baru
  // diunggah berasal dari folder penyunting. Keduanya sah — alasan yang sama
  // dengan saveCurriculum.
  const ownerUids = [user.uid, ownerUidOf(course)].filter((v): v is string => Boolean(v));
  const normalized = normalizeSections(input.sections ?? [], ownerUids);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const after: CourseSnapshot = {
    title,
    shortDesc,
    longDesc,
    level: level.value,
    levelColor: level.color,
    category,
    duration: canonicalDuration(input.duration, "course") || "—",
    price,
    thumbnail,
    whatYouLearn: input.whatYouLearn.map((s) => s.trim()).filter(Boolean).slice(0, 20),
    requirements: input.requirements.map((s) => s.trim()).filter(Boolean).slice(0, 20),
    sections: normalized.sections,
  };

  return createRequest({
    type: "edit",
    course,
    reason,
    uid: user.uid,
    name: user.name,
    before: await snapshotOf(course),
    after,
  });
}

/** Educator membatalkan pengajuannya sendiri selama belum diputuskan. */
export async function withdrawRequest(id: string): Promise<RequestResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const req = await getRequest(id);
  if (!req) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (req.requestedByUid !== user.uid) return { ok: false, error: "Ini bukan pengajuan Anda." };
  if (req.status !== "pending") return { ok: false, error: "Pengajuan ini sudah diputuskan." };

  await requestRef(id).delete();

  revalidatePath("/admin");
  revalidatePath("/admin/course-requests");
  revalidatePath("/educator/courses");
  revalidatePath(`/educator/courses/${req.courseSlug}/edit`);

  return { ok: true, message: "Pengajuan dibatalkan." };
}

// ── Keputusan admin ───────────────────────────────────────────────────

/**
 * Admin menyetujui atau menolak sebuah pengajuan.
 *
 * Inilah SATU-SATUNYA tempat perubahan yang diusulkan benar-benar diterapkan
 * ke dokumen kursus.
 */
/**
 * Menghapus satu catatan pengajuan yang sudah diputuskan.
 *
 * Yang masih "menunggu" ditolak: catatannya adalah satu-satunya jejak bahwa
 * seorang educator sedang menanti jawaban, dan menghapusnya berarti
 * permintaannya lenyap tanpa pernah dijawab. Aturan yang sama berlaku di
 * deleteApplication().
 *
 * Tidak ada pengecualian "terkunci" seperti pada pengajuan educator. Di sana
 * catatan bisa mustahil diputuskan karena akun pelamarnya hilang; di sini
 * penolakan tidak menyentuh dokumen kursus sama sekali, jadi pengajuan atas
 * kursus yang sudah dihapus pun tetap bisa ditolak lebih dulu.
 */
export async function deleteCourseRequest(id: string): Promise<RequestResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat menghapus pengajuan." };
  }

  const req = await getRequest(id);
  if (!req) return { ok: false, error: "Pengajuan tidak ditemukan." };

  if (req.status === "pending") {
    return {
      ok: false,
      error: "Pengajuan ini belum diputuskan. Setujui atau tolak dulu sebelum menghapusnya.",
    };
  }

  await requestRef(id).delete();

  revalidatePath("/admin");
  revalidatePath("/admin/course-requests");
  revalidatePath("/educator/courses");

  return { ok: true, message: "Pengajuan dihapus." };
}

/** Membersihkan semua pengajuan yang sudah diputuskan sekaligus. */
export async function clearDecidedCourseRequests(): Promise<RequestResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat menghapus pengajuan." };
  }

  const db = adminDb();
  const snap = await db.collection(COURSE_REQUESTS).get();
  const diputuskan = snap.docs.filter((d) => d.data().status !== "pending");

  if (diputuskan.length === 0) {
    return { ok: false, error: "Tidak ada pengajuan yang bisa dibersihkan." };
  }

  // Dipotong per 450: batas Firestore 500 operasi per batch. Tidak akan
  // tersentuh sekarang, tapi tetap ditulis supaya tidak diam-diam gagal kalau
  // pengajuannya suatu saat membludak — sama seperti clearDecidedApplications.
  for (let i = 0; i < diputuskan.length; i += 450) {
    const batch = db.batch();
    for (const doc of diputuskan.slice(i, i + 450)) batch.delete(doc.ref);
    await batch.commit();
  }

  revalidatePath("/admin");
  revalidatePath("/admin/course-requests");
  revalidatePath("/educator/courses");

  return { ok: true, message: `${diputuskan.length} pengajuan dibersihkan.` };
}

export async function decideCourseRequest(
  id: string,
  decision: "approve" | "reject",
  noteRaw: string,
): Promise<RequestResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat memutuskan pengajuan." };
  }

  const req = await getRequest(id);
  if (!req) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (req.status !== "pending") return { ok: false, error: "Pengajuan ini sudah diputuskan." };

  const note = cleanReason(noteRaw);
  if (decision === "reject" && note.length < MIN_REASON) {
    return { ok: false, error: `Tuliskan alasan penolakan, minimal ${MIN_REASON} karakter.` };
  }

  const db = adminDb();
  const courseRef = db.collection("courses").doc(req.courseSlug);

  if (decision === "approve") {
    const snap = await courseRef.get();
    if (!snap.exists) {
      return { ok: false, error: "Kursusnya sudah tidak ada. Pengajuan ini tidak bisa diterapkan." };
    }
    const data = snap.data() ?? {};

    if (req.type === "publish" || req.type === "unpublish") {
      await courseRef.update({ visibility: req.type === "publish" ? "public" : "private" });
    }

    if (req.type === "edit" && req.after) {
      const before = attachmentPaths((data.sections ?? []) as Section[]);

      await courseRef.update({
        title: req.after.title,
        shortDesc: req.after.shortDesc,
        longDesc: req.after.longDesc,
        level: req.after.level,
        levelColor: req.after.levelColor,
        category: req.after.category,
        duration: req.after.duration,
        price: req.after.price,
        thumbnail: req.after.thumbnail,
        whatYouLearn: req.after.whatYouLearn,
        requirements: req.after.requirements,
        sections: req.after.sections,
        lastUpdated: new Date().toISOString(),
      });

      // Berkas yang tidak lagi dirujuk ikut dibuang, sama seperti jalur
      // penyuntingan langsung milik admin.
      const keep = attachmentPaths(req.after.sections);
      const keepSet = new Set(keep);
      await deleteObjects(before.filter((p) => !keepSet.has(p)));
      await pruneAttachmentFolders([...before, ...keep], keep);

      const oldThumb = data.thumbnail;
      if (
        typeof oldThumb === "string" &&
        oldThumb.startsWith("course-thumbnails/") &&
        oldThumb !== req.after.thumbnail
      ) {
        await deleteObjects([oldThumb]);
      }
    }

    if (req.type === "delete") {
      const files = courseFilePaths({
        sections: data.sections as Section[] | undefined,
        thumbnail: data.thumbnail,
      });
      await db.recursiveDelete(courseRef);
      await deleteObjects(files);
      await pruneAttachmentFolders(files, []);
    }
  }

  await requestRef(id).update({
    status: decision === "approve" ? "approved" : "rejected",
    decidedAt: new Date().toISOString(),
    decidedByUid: admin.uid,
    decidedByName: admin.name,
    decisionNote: note || null,
  });

  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath(`/courses/${req.courseSlug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/course-requests");
  revalidatePath("/educator/courses");

  return {
    ok: true,
    message: decision === "approve" ? "Pengajuan disetujui dan diterapkan." : "Pengajuan ditolak.",
  };
}

/**
 * Admin menyembunyikan kursus seketika, tanpa antrean.
 *
 * Jaring pengaman yang sengaja disediakan: karena penarikan kursus pun kini
 * harus lewat persetujuan, kursus bermasalah bisa tetap tayang sampai ada
 * yang sempat menyetujui penarikannya. Admin harus punya rem darurat.
 */
export async function adminSetVisibility(
  slug: string,
  visibility: "public" | "private",
): Promise<RequestResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat mengubah ini langsung." };
  }

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  await adminDb().collection("courses").doc(slug).update({ visibility });

  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin/course-requests");

  return {
    ok: true,
    message: visibility === "private" ? "Kursus disembunyikan." : "Kursus ditayangkan.",
  };
}
