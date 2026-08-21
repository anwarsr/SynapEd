"use client";
import { updateProfile, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseDb, firebaseStorage } from "@/lib/firebase/client";
import { AVATARS } from "@/lib/storagePaths";
import { syncAvatarFiles } from "@/lib/uploadCleanupActions";

/** Sejalan dengan batas di storage.rules — jangan ubah salah satunya saja. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export interface UserProfile {
  phone: string | null;
}

/**
 * Nomor HP disimpan di Firestore, BUKAN di field `phoneNumber` milik Firebase
 * Auth. Field itu khusus untuk nomor yang sudah diverifikasi lewat SMS;
 * mengisinya dengan nomor yang diketik manual akan menyesatkan dan bisa
 * bentrok kalau nanti login-lewat-SMS diaktifkan.
 */
export async function fetchProfile(uid: string): Promise<UserProfile> {
  const snap = await getDoc(doc(firebaseDb(), "users", uid));
  const data = snap.data() as { phone?: string | null } | undefined;
  return { phone: data?.phone ?? null };
}

export async function savePhone(uid: string, phone: string): Promise<void> {
  const trimmed = phone.trim();

  await setDoc(
    doc(firebaseDb(), "users", uid),
    { phone: trimmed === "" ? null : trimmed, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Validasi longgar: hanya bentuk umum nomor Indonesia/internasional. */
export function validatePhone(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null; // kosong = menghapus nomor, itu sah

  if (!/^[+]?[\d\s()-]{8,20}$/.test(v)) {
    return "Nomor tidak valid. Contoh: 0812-3456-7890 atau +62 812 3456 7890.";
  }
  if (v.replace(/\D/g, "").length < 8) return "Nomor terlalu pendek.";
  return null;
}

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
