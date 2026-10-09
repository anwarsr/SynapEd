"use client";
import { updateProfile, type User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import { AVATARS } from "@/lib/storagePaths";
import { syncAvatarFiles } from "@/lib/uploadCleanupActions";

/** Sejalan dengan batas di storage.rules — jangan ubah salah satunya saja. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function validateAvatar(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Berkas harus berupa gambar.";
  if (file.size >= MAX_AVATAR_BYTES) return "Ukuran gambar maksimal 2 MB.";
  return null;
}

/**
 * Unggah foto profil lalu sinkronkan ke Firebase Auth.
 *
 * Nama berkasnya tetap (`avatar`) supaya unggahan baru menimpa yang lama.
 * Tapi akhirannya ikut tipe gambar, jadi mengganti foto JPG dengan PNG
 * menghasilkan `avatar.png` DI SAMPING `avatar.jpg` — yang lama tertinggal
 * tanpa ada lagi yang merujuknya. Karena itu sisa berkas di folder ini
 * dibersihkan setelah unggahan berhasil.
 *
 * Pembersihannya lewat server: storage.rules memeriksa ukuran dan tipe berkas,
 * dan keduanya null pada operasi hapus, sehingga klien tidak akan pernah
 * diizinkan menghapus berkasnya sendiri.
 */
export async function uploadAvatar(user: User, file: File): Promise<string> {
  const ext = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = `${AVATARS}/${user.uid}/avatar.${ext}`;

  const storageRef = ref(firebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });

  const url = await getDownloadURL(storageRef);
  await updateProfile(user, { photoURL: url });

  // Sengaja tidak menahan hasilnya: fotonya sudah terpasang dan itu yang
  // dilihat pengguna. Kalau pembersihan gagal, yang tertinggal hanya satu
  // berkas usang — bukan alasan untuk melaporkan unggahan sebagai gagal.
  void syncAvatarFiles(path).catch(() => undefined);

  return url;
}

/** Lebar maksimum banner setelah dikecilkan (px). */
const BANNER_MAX_WIDTH = 1600;

/**
 * Mengecilkan gambar banner di browser menjadi JPEG ≤ 1600px lebar.
 *
 * Batas tulis storage.rules untuk folder ini 2 MB, sedangkan foto ponsel bisa
 * 5–10 MB. Daripada menolak, gambarnya dikecilkan — hasilnya hampir selalu di
 * bawah 600 KB. Kalau masih ≥ 2 MB, kualitas diturunkan bertahap.
 */
export async function compressBanner(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const skala = Math.min(1, BANNER_MAX_WIDTH / bitmap.width);
  const w = Math.round(bitmap.width * skala);
  const h = Math.round(bitmap.height * skala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Peramban tidak mendukung pengolahan gambar.");
  // JPEG tak punya transparansi — alasnya hitam, sama dengan banner bawaan.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  for (const q of [0.86, 0.72, 0.58]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size < MAX_AVATAR_BYTES) return blob;
  }
  throw new Error("Gambar terlalu besar. Pilih gambar yang lebih kecil.");
}

/**
 * Unggah banner ke `avatars/{uid}/banner.jpg` (folder & aturan tulis yang sama
 * dengan foto profil) dan mengembalikan URL-nya. Nama berkas tetap, jadi
 * unggahan baru menimpa yang lama; `?v=` memutus cache peramban/CDN.
 */
export async function uploadBanner(user: User, blob: Blob): Promise<string> {
  const path = `${AVATARS}/${user.uid}/banner.jpg`;
  const storageRef = ref(firebaseStorage(), path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

  const url = await getDownloadURL(storageRef);
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}
