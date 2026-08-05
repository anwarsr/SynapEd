import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "./admin";

export const SESSION_COOKIE = "synaped_session";

/** Berlaku 5 hari — batas maksimum yang diizinkan createSessionCookie. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Siapa yang sedang masuk, dibaca di Server Component.
 *
 * Firebase Auth sendiri hidup di sisi klien, jadi pola resmi untuk SSR adalah
 * menukar ID token menjadi session cookie httpOnly (lihat app/api/auth/session).
 * Dengan begitu pengalihan halaman terproteksi terjadi SEBELUM render — tidak
 * ada kedipan konten seperti kalau status login baru dicek di browser.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: true membuat "keluar dari semua perangkat" benar-benar
    // berlaku seketika, bukan menunggu token kedaluwarsa sendiri.
    const claims = await adminAuth().verifySessionCookie(cookie, true);

    return {
      uid: claims.uid,
      name: (claims.name as string | undefined) ?? claims.email?.split("@")[0] ?? "Pengguna",
      email: claims.email ?? "",
      emailVerified: Boolean(claims.email_verified),
    };
  } catch {
    // Cookie kedaluwarsa atau sudah dicabut — perlakukan sebagai belum masuk.
    return null;
  }
}
