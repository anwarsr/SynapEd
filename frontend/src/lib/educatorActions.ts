"use server";
import { revalidatePath } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { APPLICATIONS, type ApplicationStatus } from "@/lib/educator";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Server Action bisa dipanggil lewat POST langsung, bukan hanya lewat tombol
 * di halaman. Jadi setiap fungsi di berkas ini memeriksa sendiri siapa yang
 * memanggil — tidak boleh ada yang mengandalkan halaman pemanggilnya sudah
 * dijaga.
 */
async function requireRole(role: "admin" | "user") {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.role === role ? user : null;
}

/**
 * Mengajukan diri menjadi educator.
 *
 * Hanya pengguna biasa yang boleh: admin tidak perlu, dan educator sudah
 * menjadi educator. Lamaran yang ditolak boleh diajukan lagi.
 */
export async function applyAsEducator(): Promise<ActionResult> {
  const user = await requireRole("user");
  if (!user) return { ok: false, error: "Hanya pengguna biasa yang dapat mengajukan." };

  const ref = adminDb().collection(APPLICATIONS).doc(user.uid);
  const existing = (await ref.get()).data();
  const status = existing?.status as ApplicationStatus | undefined;

  if (status === "pending") {
    return { ok: false, error: "Pengajuan Anda sudah masuk dan sedang ditinjau." };
  }
  if (status === "accepted") {
    return { ok: false, error: "Pengajuan Anda sudah diterima sebelumnya." };
  }

  // Ditulis utuh, bukan merge: sisa keputusan lama tidak boleh menempel pada
  // pengajuan baru setelah penolakan.
  await ref.set({
    name: user.name,
    email: user.email,
    photoURL: user.photoURL,
    status: "pending" satisfies ApplicationStatus,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedByUid: null,
    decidedByName: null,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");

  return { ok: true, message: "Pengajuan terkirim. Admin akan meninjaunya." };
}

/**
 * Admin menerima atau menolak sebuah lamaran.
 *
 * Menerima berarti mengubah custom claim menjadi "educator" lalu mencabut
 * refresh token pelamar. Pencabutan itu memang membuat pelamar terlempar
 * keluar, tetapi tanpanya sesi lamanya masih membawa role "user" sampai
 * cookie-nya kedaluwarsa — jadi role barunya tidak akan berlaku.
 */
export async function decideApplication(
  uid: string,
  decision: "accept" | "reject",
): Promise<ActionResult> {
  const admin = await requireRole("admin");
  if (!admin) return { ok: false, error: "Hanya admin yang dapat memutuskan pengajuan." };

  const ref = adminDb().collection(APPLICATIONS).doc(uid);
  const existing = (await ref.get()).data();

  if (!existing) return { ok: false, error: "Pengajuan tidak ditemukan." };
  if (existing.status !== "pending") {
    return { ok: false, error: "Pengajuan ini sudah diputuskan sebelumnya." };
  }

  const target = await adminAuth().getUser(uid).catch(() => null);
  if (!target) return { ok: false, error: "Akun pelamar sudah tidak ada." };

  const currentRole = target.customClaims?.role;

  if (decision === "accept") {
    // Menaikkan admin menjadi educator justru menurunkan wewenangnya.
    if (currentRole === "admin") {
      return { ok: false, error: "Akun ini admin — role-nya tidak diubah." };
    }

    await adminAuth().setCustomUserClaims(uid, { ...target.customClaims, role: "educator" });
    await adminAuth().revokeRefreshTokens(uid);
  }

  await ref.update({
    status: decision === "accept" ? "accepted" : "rejected",
    decidedAt: new Date().toISOString(),
    decidedByUid: admin.uid,
    decidedByName: admin.name,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath(`/admin/users/${uid}`);

  return {
    ok: true,
    message:
      decision === "accept"
        ? "Pengajuan diterima. Pengguna harus masuk ulang agar role educator berlaku."
        : "Pengajuan ditolak.",
  };
}
