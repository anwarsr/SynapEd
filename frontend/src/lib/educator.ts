import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getUserCards } from "@/lib/userCards";

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

/**
 * Nama & foto dibaca HIDUP dari Auth, bukan dari salinan di dokumen lamaran.
 *
 * Salinan itu dibuat sekali saat mengajukan dan tak pernah ikut berubah: admin
 * (atau pemilik akun) yang mengganti nama membuat daftar pengajuan tetap
 * memajang nama lama. Akun yang sudah dihapus tidak punya kartu, jadi salinannya
 * dipertahankan. Nama admin pemutus (`decidedByName`) diperlakukan sama.
 */
async function denganIdentitasHidup(daftar: EducatorApplication[]): Promise<EducatorApplication[]> {
  if (daftar.length === 0) return daftar;
  const uids = new Set<string>();
  for (const a of daftar) {
    uids.add(a.uid);
    if (a.decidedByUid) uids.add(a.decidedByUid);
  }
  const kartu = await getUserCards([...uids]);

  return daftar.map((a) => {
    const diri = kartu.get(a.uid);
    const pemutus = a.decidedByUid ? kartu.get(a.decidedByUid) : undefined;
    return {
      ...a,
      name: diri?.name ?? a.name,
      photoURL: diri ? diri.photoURL : a.photoURL,
      decidedByName: pemutus?.name ?? a.decidedByName,
    };
  });
}

export async function getApplication(uid: string): Promise<EducatorApplication | null> {
  const snap = await adminDb().collection(APPLICATIONS).doc(uid).get();
  const data = snap.data();
  if (!data) return null;
  return (await denganIdentitasHidup([toApplication(snap.id, data)]))[0];
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

  return (await denganIdentitasHidup(snap.docs.map((d) => toApplication(d.id, d.data()))))
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
