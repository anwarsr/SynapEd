import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getUserCards } from "@/lib/userCards";

export const COURSE_REQUESTS = "courseChangeRequests";

/**
 * Pengajuan perubahan kursus yang menunggu persetujuan admin.
 *
 * Sebelumnya educator menyunting dan langsung berlaku. Sekarang setiap
 * perubahan yang terlihat publik — menayangkan, menyembunyikan, menyunting,
 * menghapus — menjadi usulan lebih dulu.
 *
 * Yang menyimpan usulan adalah koleksi ini, BUKAN dokumen kursusnya. Kursus
 * yang sedang ditinjau tetap tayang apa adanya, sehingga peserta yang sudah
 * membeli tidak pernah melihat setengah perubahan yang belum disetujui.
 *
 * Tertutup rapat dari klien, sama seperti `educatorApplications`: seluruh
 * alurnya lewat Server Action dengan Admin SDK.
 */

export * from "@/lib/courseRequestTypes";

import type {
  CourseChangeRequest,
  CourseSnapshot,
  RequestStatus,
  RequestType,
} from "@/lib/courseRequestTypes";

function toRequest(id: string, d: FirebaseFirestore.DocumentData): CourseChangeRequest {
  return {
    id,
    courseSlug: (d.courseSlug as string | undefined) ?? "",
    courseTitle: (d.courseTitle as string | undefined) ?? "",
    type: (d.type as RequestType | undefined) ?? "edit",
    reason: (d.reason as string | undefined) ?? "",
    requestedByUid: (d.requestedByUid as string | undefined) ?? "",
    requestedByName: (d.requestedByName as string | undefined) ?? "Educator",
    status: (d.status as RequestStatus | undefined) ?? "pending",
    before: (d.before as CourseSnapshot | null | undefined) ?? null,
    after: (d.after as CourseSnapshot | null | undefined) ?? null,
    createdAt: (d.createdAt as string | undefined) ?? "",
    decidedAt: (d.decidedAt as string | null | undefined) ?? null,
    decidedByUid: (d.decidedByUid as string | null | undefined) ?? null,
    decidedByName: (d.decidedByName as string | null | undefined) ?? null,
    decisionNote: (d.decisionNote as string | null | undefined) ?? null,
  };
}

/**
 * Nama pengaju & pemutus dibaca HIDUP dari Auth (salinan di dokumen tak ikut
 * berubah saat nama akun diganti). Akun yang sudah dihapus memakai salinannya.
 */
async function denganNamaHidup(daftar: CourseChangeRequest[]): Promise<CourseChangeRequest[]> {
  if (daftar.length === 0) return daftar;
  const uids = new Set<string>();
  for (const r of daftar) {
    if (r.requestedByUid) uids.add(r.requestedByUid);
    if (r.decidedByUid) uids.add(r.decidedByUid);
  }
  const kartu = await getUserCards([...uids]);
  return daftar.map((r) => ({
    ...r,
    requestedByName: kartu.get(r.requestedByUid)?.name ?? r.requestedByName,
    decidedByName: (r.decidedByUid ? kartu.get(r.decidedByUid)?.name : undefined) ?? r.decidedByName,
  }));
}

export function requestRef(id: string) {
  return adminDb().collection(COURSE_REQUESTS).doc(id);
}

export async function getRequest(id: string): Promise<CourseChangeRequest | null> {
  const snap = await requestRef(id).get();
  const data = snap.data();
  return data ? toRequest(snap.id, data) : null;
}

/**
 * Pengajuan yang masih menunggu untuk satu kursus.
 *
 * Hanya SATU yang boleh menggantung per kursus. Tanpa aturan itu, dua usulan
 * sunting yang bertumpuk akan saling menimpa saat disetujui berurutan — yang
 * kedua menulis salinan yang dibuat sebelum yang pertama berlaku, jadi
 * persetujuan pertama diam-diam terhapus.
 */
export async function pendingRequestFor(courseSlug: string): Promise<CourseChangeRequest | null> {
  const snap = await adminDb()
    .collection(COURSE_REQUESTS)
    .where("courseSlug", "==", courseSlug)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  const doc = snap.docs[0];
  return doc ? toRequest(doc.id, doc.data()) : null;
}

/**
 * Seluruh pengajuan, yang menunggu di atas lalu yang terbaru.
 *
 * Diurutkan di memori dengan alasan yang sama seperti listApplications:
 * menghindari composite index untuk (status, createdAt) pada koleksi yang
 * jumlahnya kecil.
 */
export async function listRequests(): Promise<CourseChangeRequest[]> {
  const snap = await adminDb().collection(COURSE_REQUESTS).get();

  return (await denganNamaHidup(snap.docs.map((d) => toRequest(d.id, d.data()))))
    .sort((a, b) => {
      if ((a.status === "pending") !== (b.status === "pending")) {
        return a.status === "pending" ? -1 : 1;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
}

/** Pengajuan milik seorang educator, terbaru di atas. */
export async function listRequestsByEducator(uid: string): Promise<CourseChangeRequest[]> {
  const snap = await adminDb()
    .collection(COURSE_REQUESTS)
    .where("requestedByUid", "==", uid)
    .get();

  return (await denganNamaHidup(snap.docs.map((d) => toRequest(d.id, d.data()))))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pendingRequestCount(): Promise<number> {
  const snap = await adminDb()
    .collection(COURSE_REQUESTS)
    .where("status", "==", "pending")
    .count()
    .get();
  return snap.data().count;
}
