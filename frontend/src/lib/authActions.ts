"use client";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";

/**
 * Menukar ID token Firebase menjadi session cookie httpOnly di server.
 * Wajib dipanggil setelah setiap masuk/daftar — tanpa ini, Server Component
 * tidak akan mengenali sesi dan halaman terproteksi tetap mengalihkan ke /login.
 */
export async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) throw new Error("Sesi gagal dibuat. Silakan coba lagi.");
}

/**
 * Role dibaca dari custom claim di dalam ID token.
 *
 * `true` memaksa token diambil ulang dari server — penting karena token yang
 * ter-cache bisa saja diterbitkan sebelum role-nya diubah, sehingga admin baru
 * akan terbaca sebagai pengguna biasa.
 */
export async function readRole(user: User): Promise<"admin" | "user"> {
  const token = await user.getIdTokenResult(true);
  return token.claims.role === "admin" ? "admin" : "user";
}

/** Kode galat Firebase diterjemahkan ke pesan yang berguna bagi pengguna. */
export function authErrorMessage(err: unknown): string {
  if (!(err instanceof FirebaseError)) {
    if (err instanceof Error && err.message) return err.message;
    return "Terjadi kesalahan. Silakan coba lagi.";
  }

  switch (err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // Pesan sengaja disamakan agar tidak bisa dipakai menebak
      // email mana yang terdaftar.
      return "Email atau kata sandi salah.";
    case "auth/email-already-in-use":
      return "Email ini sudah terdaftar.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/weak-password":
      return "Kata sandi minimal 6 karakter.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat.";
    case "auth/requires-recent-login":
      return "Demi keamanan, silakan keluar lalu masuk kembali sebelum melakukan ini.";
    case "auth/network-request-failed":
      return "Tidak dapat terhubung. Periksa koneksi internet Anda.";
    default:
      return "Terjadi kesalahan. Silakan coba lagi.";
  }
}
