import { cookies } from "next/headers";
import { API_URL, ApiError, type AuthUser } from "@/lib/api";

/**
 * Pemanggil API untuk Server Component.
 *
 * Token ada di cookie httpOnly, dan `fetch` di sisi server tidak otomatis
 * membawa cookie milik browser — jadi header Cookie diteruskan manual.
 * Inilah yang membuat halaman terproteksi bisa dirender di server tanpa
 * kedipan "loading" seperti kalau dicek di klien.
 */
export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = (await cookies()).toString();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Permintaan gagal (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.message) message = body.message;
    } catch {
      // biarkan pesan default
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Mengembalikan user yang sedang masuk, atau null bila belum. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await serverFetch<AuthUser>("/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    // Galat lain (mis. API mati) jangan disamarkan jadi "belum masuk".
    throw e;
  }
}
