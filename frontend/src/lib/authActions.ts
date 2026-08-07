"use client";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  type User,
  type UserCredential,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { toRole, type Role } from "@/lib/roles";

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
export async function readRole(user: User): Promise<Role> {
  const token = await user.getIdTokenResult(true);
  return toRole(token.claims.role);
}

/**
 * Masuk atau daftar dengan akun Google.
 *
 * Satu fungsi untuk keduanya karena Firebase memang tidak membedakannya:
 * kalau email-nya belum terdaftar, akunnya dibuat saat itu juga.
 *
 * Memakai popup, bukan redirect. signInWithRedirect menyimpan keadaan di
 * cookie pihak ketiga, dan browser yang memblokirnya membuat alur itu gagal
 * diam-diam — popup tidak punya masalah itu.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();

  // Tanpa ini Google langsung memakai akun yang terakhir dipakai, sehingga
  // pengguna dengan beberapa akun tidak punya kesempatan memilih.
  provider.setCustomParameters({ prompt: "select_account" });

  return signInWithPopup(firebaseAuth(), provider);
}

/**
 * Mengirim tautan atur ulang kata sandi.
 *
 * Juga berlaku untuk akun yang saat ini hanya punya Google: menyelesaikan
 * tautan itu MEMASANG kata sandi pada akun tersebut, sehingga metode masuk
 * lama kembali tersedia. Itulah jalan keluar bagi akun yang kata sandinya
 * terlepas saat pertama kali masuk lewat Google.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email);
}

/**
 * Menambahkan Google sebagai cara masuk pada akun yang SEDANG terbuka.
 *
 * Ini jalur yang benar bagi pemilik akun berkata sandi yang juga ingin memakai
 * Google. Menautkan bersifat menambah: kata sandinya tetap ada. Berbeda dengan
 * menekan "Masuk dengan Google" dalam keadaan keluar — di sana Firebase
 * menemukan email yang sama pada akun yang emailnya belum terverifikasi, dan
 * melepas kredensial lama itu karena bisa saja dipasang orang lain.
 */
export async function linkGoogle(user: User): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  await linkWithPopup(user, provider);
}

/** Tautan verifikasi email — inilah yang menutup celah di atas. */
export async function sendVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
}

/**
 * Autentikasi ulang lewat Google, untuk akun tanpa kata sandi.
 *
 * Berbeda dengan masuk, di sini akunnya SUDAH tertentu — yang diminta hanyalah
 * bukti bahwa orangnya masih orang yang sama. Karena itu memakai `login_hint`,
 * bukan `prompt: "select_account"`: menyodorkan daftar semua akun Google
 * mengundang salah pilih, dan pilihan yang salah hanya berakhir dengan
 * auth/user-mismatch.
 */
export async function reauthWithGoogle(user: User): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  await reauthenticateWithPopup(user, provider);
}

/**
 * Pengguna menutup popup atau membuka popup lain sebelum yang pertama selesai.
 *
 * Ini keputusan pengguna, bukan kegagalan — menampilkannya sebagai galat merah
 * hanya membuat bingung.
 */
/**
 * Firebase menolak operasi sensitif kalau sesinya sudah lama.
 *
 * Dipakai untuk mencoba dulu, baru meminta konfirmasi ulang bila memang
 * diminta — bukan memaksa setiap pengguna melewati popup padahal Firebase
 * belum tentu menuntutnya.
 */
export function isRecentLoginRequired(err: unknown): boolean {
  return err instanceof FirebaseError && err.code === "auth/requires-recent-login";
}

export function isPopupDismissed(err: unknown): boolean {
  return (
    err instanceof FirebaseError &&
    (err.code === "auth/popup-closed-by-user" ||
      err.code === "auth/cancelled-popup-request" ||
      err.code === "auth/user-cancelled")
  );
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
      // Pesan sengaja disamakan agar tidak bisa dipakai menebak email mana
      // yang terdaftar. Petunjuk Google ditambahkan untuk SEMUA kegagalan,
      // bukan hanya yang memang memakai Google — kalau hanya muncul pada
      // akun Google, pesan ini justru membocorkan email mana yang ada.
      return "Email atau kata sandi salah. Kalau Anda pernah masuk lewat Google, gunakan tombol Masuk dengan Google di atas.";
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

    // ── Khusus alur Google ────────────────────────────────────────────
    case "auth/popup-blocked":
      return "Jendela Google diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.";
    case "auth/account-exists-with-different-credential":
      return "Email ini sudah terdaftar dengan kata sandi. Masuklah memakai kata sandi Anda.";
    case "auth/operation-not-allowed":
      // Terjadi kalau provider Google belum diaktifkan di Firebase Console.
      return "Masuk dengan Google belum diaktifkan untuk aplikasi ini.";
    case "auth/unauthorized-domain":
      return "Domain ini belum diizinkan untuk masuk dengan Google.";
    case "auth/user-mismatch":
      return "Akun Google yang dipilih berbeda dengan akun yang sedang dibuka. Pilih akun yang sama.";
    case "auth/provider-already-linked":
      return "Akun Google sudah tertaut ke akun ini.";
    case "auth/credential-already-in-use":
      return "Akun Google itu sudah dipakai oleh akun SynapEd yang lain.";

    default:
      return "Terjadi kesalahan. Silakan coba lagi.";
  }
}
