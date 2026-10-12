"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminAuth, adminStorage } from "@/lib/firebase/admin";
import { pruneAvatarFolder } from "@/lib/storageCleanup";
import { AVATARS } from "@/lib/storagePaths";
import { getCurrentUser } from "@/lib/firebase/session";
import { ensureUsername } from "@/lib/usernames";
import { toRole, type Role } from "@/lib/roles";

export type AkunHasil =
  | { ok: true; message: string; /** Kata sandi acak - hanya dikembalikan SEKALI, tak bisa dilihat lagi. */ sandi?: string; uid?: string }
  | { ok: false; error: string };

const ROLES: readonly Role[] = ["user", "educator", "admin"];
const MIN_SANDI = 6;
const MAX_SANDI = 128;

/**
 * Server Action bisa dipanggil lewat POST langsung, jadi SETIAP fungsi di sini
 * memeriksa sendiri bahwa pemanggilnya admin (sesi, bukan argumen).
 *
 * KATA SANDI TIDAK BISA DILIHAT. Firebase Auth hanya menyimpan hash satu arah;
 * tak ada API yang mengembalikan sandi asli siapa pun, dan itu memang sengaja
 * (admin pun tidak seharusnya tahu sandi orang lain). Yang tersedia: MENGGANTI
 * sandi - boleh dengan sandi acak yang ditampilkan sekali agar admin bisa
 * menyampaikannya.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/** 12 karakter acak tanpa huruf yang mudah tertukar (0/O, 1/l/I). */
function sandiAcak(): string {
  const abjad = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => abjad[b % abjad.length]).join("");
}

function galat(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? "";
  if (code === "auth/email-already-exists") return "Email itu sudah dipakai akun lain.";
  if (code === "auth/invalid-email") return "Format email tidak valid.";
  if (code === "auth/invalid-password") return `Kata sandi minimal ${MIN_SANDI} karakter.`;
  if (code === "auth/user-not-found") return "Akun tidak ditemukan.";
  return "Permintaan gagal. Coba lagi.";
}

function bersih(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

const MAX_NAMA = 60;
/** Foto pengganti dari admin: JPEG persegi hasil kompres browser (±100 KB); batas longgar 600 KB. */
const MAX_FOTO_BYTES = 600 * 1024;

/**
 * MODERASI PROFIL: admin boleh mengganti nama dan foto akun mana pun (mencegah nama/foto
 * yang tak pantas). Nama & foto hidup di Firebase Auth, jadi komentar, kelas, dan mini-profil
 * ikut berubah otomatis. Foto pengganti ditulis SERVER (Admin SDK) ke folder avatar akun itu
 * - storage.rules hanya mengizinkan pemilik menulis di sana, jadi admin tak bisa mengunggah dari browser.
 */
export async function setUserName(uid: string, nameRaw: string): Promise<AkunHasil> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengubah nama." };

  const name = bersih(nameRaw, MAX_NAMA + 1).replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Nama minimal 2 karakter." };
  if (name.length > MAX_NAMA) return { ok: false, error: `Nama maksimal ${MAX_NAMA} karakter.` };

  try {
    await adminAuth().updateUser(uid, { displayName: name });
  } catch (e) {
    return { ok: false, error: galat(e) };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/users/${uid}`);
  return { ok: true, message: "Nama diperbarui." };
}

/** Menghapus foto profil akun (kembali ke inisial) dan membuang berkasnya dari Storage. */
export async function removeUserPhoto(uid: string): Promise<AkunHasil> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengubah foto." };

  try {
    await adminAuth().updateUser(uid, { photoURL: null });
  } catch (e) {
    return { ok: false, error: galat(e) };
  }
  // keep terisi = banner & foto kelas milik akun itu TIDAK ikut terhapus.
  await pruneAvatarFolder(uid, "__tidak-ada__");
  revalidatePath("/admin");
  revalidatePath(`/admin/users/${uid}`);
  return { ok: true, message: "Foto dihapus." };
}

/** Mengganti foto profil akun dengan gambar JPEG (data URL) dari admin. */
export async function replaceUserPhoto(uid: string, dataUrl: string): Promise<AkunHasil> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengubah foto." };

  const m = typeof dataUrl === "string" ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) return { ok: false, error: "Foto tidak valid." };
  const bytes = Buffer.from(m[1], "base64");
  // Tanda tangan JPEG (FF D8 FF): jangan percaya awalan data URL saja.
  if (bytes.length < 100 || bytes.length > MAX_FOTO_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, error: "Foto harus JPEG dan tidak lebih dari 600 KB." };
  }

  const target = await adminAuth().getUser(uid).catch(() => null);
  if (!target) return { ok: false, error: "Akun tidak ditemukan." };

  const path = `${AVATARS}/${uid}/admin-${randomBytes(8).toString("hex")}.jpg`;
  const token = randomUUID();
  const bucket = adminStorage().bucket();
  try {
    await bucket.file(path).save(bytes, {
      contentType: "image/jpeg",
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    await adminAuth().updateUser(uid, { photoURL: url });
  } catch {
    return { ok: false, error: "Foto gagal disimpan. Coba lagi." };
  }
  await pruneAvatarFolder(uid, path);
  revalidatePath("/admin");
  revalidatePath(`/admin/users/${uid}`);
  return { ok: true, message: "Foto diganti." };
}

/** Mengubah role. Pengguna targetnya dikeluarkan (token dicabut) supaya role baru berlaku. */
export async function changeUserRole(uid: string, roleRaw: string): Promise<AkunHasil> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengubah role." };

  if (!ROLES.includes(roleRaw as Role)) return { ok: false, error: "Role tidak dikenal." };
  const role = roleRaw as Role;

  // Mencegah admin mengunci dirinya (dan satu-satunya admin) di luar panel.
  if (uid === admin.uid) return { ok: false, error: "Role akun Anda sendiri tidak bisa diubah dari sini." };

  const target = await adminAuth().getUser(uid).catch(() => null);
  if (!target) return { ok: false, error: "Akun tidak ditemukan." };
  if (toRole(target.customClaims?.role) === role) return { ok: false, error: "Akun ini sudah berperan demikian." };

  await adminAuth().setCustomUserClaims(uid, { ...target.customClaims, role });
  await adminAuth().revokeRefreshTokens(uid);

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${uid}`);
  return { ok: true, message: "Role diubah. Pengguna perlu masuk ulang agar berlaku." };
}

/** Mengganti kata sandi akun lain. `acak` = buat sandi acak dan kembalikan sekali. */
export async function setUserPassword(uid: string, sandiRaw: string, acak: boolean): Promise<AkunHasil> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat mengganti kata sandi." };

  const sandi = acak ? sandiAcak() : typeof sandiRaw === "string" ? sandiRaw : "";
  if (sandi.length < MIN_SANDI || sandi.length > MAX_SANDI) {
    return { ok: false, error: `Kata sandi ${MIN_SANDI}-${MAX_SANDI} karakter.` };
  }

  try {
    await adminAuth().updateUser(uid, { password: sandi });
    await adminAuth().revokeRefreshTokens(uid);
  } catch (e) {
    return { ok: false, error: galat(e) };
  }

  revalidatePath(`/admin/users/${uid}`);
  return {
    ok: true,
    message: "Kata sandi diganti. Sesi lama akun itu dicabut.",
    sandi: acak ? sandi : undefined,
  };
}

/** Membuat akun baru (email + kata sandi) dengan role tertentu. */
export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
  acak: boolean;
  role: string;
}): Promise<AkunHasil> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Hanya admin yang dapat membuat akun." };

  const name = bersih(input?.name, 80);
  const email = bersih(input?.email, 254).toLowerCase();
  if (!name) return { ok: false, error: "Nama wajib diisi." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Format email tidak valid." };
  if (!ROLES.includes(input?.role as Role)) return { ok: false, error: "Role tidak dikenal." };
  const role = input.role as Role;

  const sandi = input.acak ? sandiAcak() : typeof input.password === "string" ? input.password : "";
  if (sandi.length < MIN_SANDI || sandi.length > MAX_SANDI) {
    return { ok: false, error: `Kata sandi ${MIN_SANDI}-${MAX_SANDI} karakter.` };
  }

  try {
    const akun = await adminAuth().createUser({ email, password: sandi, displayName: name });
    if (role !== "user") await adminAuth().setCustomUserClaims(akun.uid, { role });
    // Sama seperti rute sesi: setiap akun punya username (gagal = tak fatal, dibuat saat masuk).
    await ensureUsername(akun.uid).catch(() => undefined);

    revalidatePath("/admin");
    return {
      ok: true,
      message: "Akun dibuat.",
      uid: akun.uid,
      sandi: input.acak ? sandi : undefined,
    };
  } catch (e) {
    return { ok: false, error: galat(e) };
  }
}
