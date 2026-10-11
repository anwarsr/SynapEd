import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { toRole, type Role } from "@/lib/roles";
import { adminAuth } from "./admin";

export const SESSION_COOKIE = "synaped_session";

/** Berlaku 5 hari — batas maksimum yang diizinkan createSessionCookie. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type { Role } from "@/lib/roles";

export interface SessionUser {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  photoURL: string | null;
  role: Role;
}

/**
 * Siapa yang sedang masuk, dibaca di Server Component.
 *
 * Firebase Auth sendiri hidup di sisi klien, jadi pola resmi untuk SSR adalah
 * menukar ID token menjadi session cookie httpOnly (lihat app/api/auth/session).
 * Dengan begitu pengalihan halaman terproteksi terjadi SEBELUM render — tidak
 * ada kedipan konten seperti kalau status login baru dicek di browser.
 *
 * `role` datang dari custom claim yang tertanam di dalam cookie, jadi tidak
 * ada pembacaan database tambahan — dan tidak bisa dipalsukan dari browser.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: true membuat "keluar dari semua perangkat" benar-benar
    // berlaku seketika, bukan menunggu token kedaluwarsa sendiri. Ini juga
    // yang membuat perubahan role langsung memutus sesi lama.
    const claims = await adminAuth().verifySessionCookie(cookie, true);

    return {
      uid: claims.uid,
      name: (claims.name as string | undefined) ?? claims.email?.split("@")[0] ?? "Pengguna",
      email: claims.email ?? "",
      emailVerified: Boolean(claims.email_verified),
      photoURL: (claims.picture as string | undefined) ?? null,
      role: toRole(claims.role),
    };
  } catch {
    // Cookie kedaluwarsa atau sudah dicabut — perlakukan sebagai belum masuk.
    return null;
  }
}

/** Halaman yang wajib login. Mengalihkan ke /login bila belum. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/**
 * Halaman khusus admin.
 *
 * Pengguna biasa dialihkan ke /dashboard, bukan /login — mereka sudah masuk,
 * jadi menyodorkan halaman login lagi hanya membingungkan.
 */
export async function requireAdmin(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.role !== "admin") redirect("/profil");
  return user;
}

/**
 * Halaman khusus educator.
 *
 * Yang belum educator diantar ke /educator — di sana ada penjelasannya
 * beserta tombol pengajuan, jadi mereka tahu apa yang harus dilakukan
 * alih-alih sekadar ditolak.
 */
export async function requireEducator(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  // Admin ikut lolos: ia boleh membuat kursus & kelas seperti educator (ditambah fitur admin).
  if (user.role !== "educator" && user.role !== "admin") redirect("/educator");
  return user;
}
