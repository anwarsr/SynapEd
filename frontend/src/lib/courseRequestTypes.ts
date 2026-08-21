import type { Section } from "@/lib/courses";

/**
 * Tipe dan label pengajuan perubahan kursus.
 *
 * Modul ini sengaja NETRAL — tanpa "use client" maupun "server-only" — karena
 * dipakai di kedua sisi: halaman admin merendernya di server, panel educator
 * membacanya di browser.
 *
 * Memisahkannya bukan kerapian belaka. Menaruh `requestTypeLabel` di
 * courseRequests.ts yang ber-"server-only" membuat seluruh build gagal begitu
 * satu komponen klien mengimpornya — persis seperti yang pernah terjadi pada
 * roles.ts, providerIds.ts, dan storagePaths.ts.
 */

export type RequestType = "publish" | "unpublish" | "edit" | "delete";
export type RequestStatus = "pending" | "approved" | "rejected";

/** Bagian kursus yang boleh diubah lewat pengajuan sunting. */
export interface CourseSnapshot {
  title: string;
  shortDesc: string;
  longDesc: string;
  level: string;
  levelColor: string;
  category: string;
  duration: string;
  price: number;
  thumbnail: string | null;
  whatYouLearn: string[];
  requirements: string[];
  sections: Section[];
}

export interface CourseChangeRequest {
  id: string;
  courseSlug: string;
  courseTitle: string;

  type: RequestType;
  /** Alasan yang wajib ditulis educator; ikut tampil di panel admin. */
  reason: string;

  requestedByUid: string;
  requestedByName: string;

  status: RequestStatus;

  /**
   * Keadaan kursus saat pengajuan dibuat, dan keadaan yang diusulkan.
   *
   * Keduanya hanya diisi untuk type "edit". Disimpan sebagai salinan utuh,
   * bukan selisihnya saja: kursusnya bisa berubah lagi sebelum admin
   * memutuskan, dan perbandingan yang dihitung ulang dari keadaan terkini
   * akan menyesatkan.
   */
  before: CourseSnapshot | null;
  after: CourseSnapshot | null;

  createdAt: string;
  decidedAt: string | null;
  decidedByUid: string | null;
  decidedByName: string | null;
  /** Catatan admin saat menolak — supaya educator tahu apa yang harus dibetulkan. */
  decisionNote: string | null;
}

export const requestTypeLabel: Record<RequestType, string> = {
  publish: "Menayangkan kursus",
  unpublish: "Menyembunyikan kursus",
  edit: "Menyunting kursus",
  delete: "Menghapus kursus",
};

export const requestStatusLabel: Record<RequestStatus, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};
