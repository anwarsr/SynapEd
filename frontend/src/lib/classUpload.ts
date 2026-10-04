"use client";
import { ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import { CLASS_FILES, CLASS_SUBMISSION_FILES } from "@/lib/storagePaths";
import { mimeOfName } from "@/lib/classAssignmentRules";

/** Yang dikirim ke Server Action. Ukuran & MIME sengaja tidak — server membacanya sendiri. */
export interface BerkasTerunggah {
  path: string;
  name: string;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

/**
 * Unggahan terjadi saat formulir DIKIRIM, bukan saat berkas dipilih: memilih
 * lalu membuang berkas tidak meninggalkan sampah di Storage, dan yang
 * tertinggal hanya unggahan dari pengiriman yang gagal.
 *
 * MIME diambil dari ekstensi (`mimeOfName`), bukan `file.type` — lihat
 * classAssignmentRules.ts. storage.rules menolak MIME di luar daftar itu.
 */
async function unggah(folder: string, file: File): Promise<BerkasTerunggah> {
  const mime = mimeOfName(file.name);
  if (!mime) throw new Error(`Format "${file.name}" tidak didukung.`);

  // Stempel waktu + urutan acak pendek: dua berkas bernama sama dalam satu
  // pengiriman tidak saling menimpa.
  const acak = Math.random().toString(36).slice(2, 7);
  const path = `${folder}/${Date.now()}-${acak}-${safeName(file.name)}`;
  await uploadBytes(ref(firebaseStorage(), path), file, { contentType: mime });
  return { path, name: file.name };
}

/** Lampiran pengajar: `class-files/{uid}/{classId}/…`. */
export function unggahLampiranKelas(uid: string, classId: string, files: readonly File[]) {
  return Promise.all(files.map((f) => unggah(`${CLASS_FILES}/${uid}/${classId}`, f)));
}

/** Jawaban siswa: `class-submissions/{uid}/{classId}/{postId}/…`. */
export function unggahJawabanKelas(uid: string, classId: string, postId: string, files: readonly File[]) {
  return Promise.all(files.map((f) => unggah(`${CLASS_SUBMISSION_FILES}/${uid}/${classId}/${postId}`, f)));
}
