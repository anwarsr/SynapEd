"use client";
import { ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import { COURSE_ASSETS, COURSE_THUMBNAILS } from "@/lib/storagePaths";
import type { UploadedDoc } from "@/lib/courseActions";

export const MAX_DOC_BYTES = 20 * 1024 * 1024;

/**
 * Hanya PDF.
 *
 * Word sempat didukung, tetapi tampilannya di halaman tidak pernah setia:
 * pengurai .docx mana pun harus menerka ulang tata letak Word, dan gambar
 * latar sehalaman penuh selalu jadi korbannya. PDF dirender peramban itu
 * sendiri, jadi hasilnya persis seperti yang disusun educator.
 */
export const DOC_ACCEPT = "application/pdf,.pdf";

export function validateDoc(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) return "Format harus PDF.";
  if (file.size > MAX_DOC_BYTES) return "Ukuran berkas maksimal 20 MB.";
  if (file.size === 0) return "Berkas kosong.";

  return null;
}

/** Nama berkas dibersihkan supaya path-nya aman dan mudah dibaca. */
function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

/**
 * Mengunggah satu dokumen kursus.
 *
 * `draftId` mengelompokkan berkas satu kursus sebelum slug-nya ditentukan
 * server. Path selalu diawali uid pemiliknya — itulah yang diperiksa ulang
 * oleh server action dan storage.rules.
 */
export async function uploadCourseDoc(
  uid: string,
  draftId: string,
  kind: string,
  file: File,
): Promise<UploadedDoc> {
  const path = `${COURSE_ASSETS}/${uid}/${draftId}/${kind}-${safeName(file.name)}`;

  await uploadBytes(ref(firebaseStorage(), path), file, { contentType: "application/pdf" });

  return { name: file.name, path, size: file.size, mime: "application/pdf" };
}

// ── Gambar latar kursus ─────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/*";

/** Sama seperti validateDoc: penjaga sebenarnya ada di storage.rules. */
export function validateImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Berkas harus berupa gambar (JPG, PNG, atau WebP).";
  if (file.size > MAX_IMAGE_BYTES) return "Ukuran gambar maksimal 5 MB.";
  if (file.size === 0) return "Berkas kosong.";
  return null;
}

/**
 * Mengunggah gambar latar kursus dan mengembalikan PATH-nya, bukan URL.
 *
 * Path yang disimpan, karena itulah yang bisa diperiksa ulang server: cukup
 * memastikan awalannya folder milik pengunggah. URL penuh jauh lebih mudah
 * dipalsukan dan lebih rapuh saat diurai.
 */
export async function uploadCourseImage(
  uid: string,
  prefix: string,
  file: File,
): Promise<string> {
  const path = `${COURSE_THUMBNAILS}/${uid}/${prefix}-${Date.now()}-${safeName(file.name)}`;
  await uploadBytes(ref(firebaseStorage(), path), file, { contentType: file.type });
  return path;
}
