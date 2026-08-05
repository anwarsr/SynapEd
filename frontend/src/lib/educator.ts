import "server-only";
import { adminDb } from "@/lib/firebase/admin";

export const APPLICATIONS = "educatorApplications";

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export interface EducatorApplication {
  /** Sama dengan document ID: satu akun, satu lamaran. */
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  status: ApplicationStatus;
  /** ISO — disimpan sebagai string supaya aman melintasi batas server->klien. */
  createdAt: string;
  decidedAt: string | null;
  decidedByUid: string | null;
  decidedByName: string | null;
}

/** Bentuk mentah Firestore -> bentuk yang dipakai UI. */
function toApplication(id: string, data: FirebaseFirestore.DocumentData): EducatorApplication {
  return {
    uid: id,
    name: (data.name as string | undefined) ?? "Pengguna",
    email: (data.email as string | undefined) ?? "",
    photoURL: (data.photoURL as string | null | undefined) ?? null,
    status: (data.status as ApplicationStatus | undefined) ?? "pending",
    createdAt: (data.createdAt as string | undefined) ?? "",
    decidedAt: (data.decidedAt as string | null | undefined) ?? null,
    decidedByUid: (data.decidedByUid as string | null | undefined) ?? null,
    decidedByName: (data.decidedByName as string | null | undefined) ?? null,
  };
}

export async function getApplication(uid: string): Promise<EducatorApplication | null> {
  const snap = await adminDb().collection(APPLICATIONS).doc(uid).get();
  const data = snap.data();
  return data ? toApplication(snap.id, data) : null;
}

/**
 * Seluruh lamaran, yang menunggu keputusan di atas lalu yang terbaru.
 *
 * Penyaringan dan pengurutan dilakukan di memori, bukan lewat query, supaya
 * tidak perlu composite index untuk (status, createdAt). Jumlah lamaran jauh
 * lebih kecil daripada jumlah akun, jadi ini tidak jadi masalah.
 */
export async function listApplications(): Promise<EducatorApplication[]> {
  const snap = await adminDb().collection(APPLICATIONS).get();

  return snap.docs
    .map((d) => toApplication(d.id, d.data()))
    .sort((a, b) => {
      if ((a.status === "pending") !== (b.status === "pending")) {
        return a.status === "pending" ? -1 : 1;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
}

/** Jumlah lamaran yang menunggu keputusan — untuk lencana di navigasi admin. */
export async function pendingApplicationCount(): Promise<number> {
  const snap = await adminDb()
    .collection(APPLICATIONS)
    .where("status", "==", "pending")
    .count()
    .get();
  return snap.data().count;
}

export const statusLabel: Record<ApplicationStatus, string> = {
  pending: "Menunggu",
  accepted: "Diterima",
  rejected: "Ditolak",
};
