"use client";
import { ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import type { UploadedDoc } from "@/lib/courseActions";

export const MAX_DOC_BYTES = 20 * 1024 * 1024;

const DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Sebagian browser mengirim MIME kosong untuk .doc/.docx; ekstensi jadi cadangan. */
const DOC_EXTENSIONS = [".pdf", ".doc", ".docx"];

export const DOC_ACCEPT = ".pdf,.doc,.docx";

/**
 * Pemeriksaan di sini hanya agar pesannya cepat dan jelas. Penjaganya yang
 * sebenarnya ada di storage.rules — form bisa dilewati, aturan Storage tidak.
 */
export function validateDoc(file: File): string | null {
  const named = DOC_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

  if (!named && !DOC_MIMES.includes(file.type)) {
    return "Format harus PDF atau Word (.pdf, .doc, .docx).";
  }
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
  kind: "modul" | "tugas",
  file: File,
): Promise<UploadedDoc> {
  const path = `course-assets/${uid}/${draftId}/${kind}-${safeName(file.name)}`;
  const storageRef = ref(firebaseStorage(), path);

  // contentType disetel eksplisit: berkas .docx dari beberapa browser datang
  // tanpa MIME, dan storage.rules menolak apa pun di luar daftar yang sah.
  const contentType = DOC_MIMES.includes(file.type) ? file.type : mimeFromName(file.name);

  await uploadBytes(storageRef, file, { contentType });

  return { name: file.name, path, size: file.size, mime: contentType };
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/msword";
}
