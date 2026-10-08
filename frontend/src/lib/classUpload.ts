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

/**
 * Pesan untuk unggahan yang gagal, menurut kode galat Firebase Storage.
 *
 * Dulu semua kegagalan dijawab "periksa koneksi" — padahal penyebab yang
 * paling sering justru storage.rules yang belum di-deploy (`storage/unauthorized`),
 * dan pengguna dengan sinyal bagus dibuat menebak-nebak. Galat aslinya juga
 * dicatat ke konsol supaya bisa ditelusuri.
 */
export function pesanGagalUnggah(e: unknown): string {
  console.error("[unggah kelas]", e);
  const kode = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";

  if (kode === "storage/unauthorized" || kode === "storage/unauthenticated") {
    return "Server menolak unggahan (izin penyimpanan). Muat ulang halaman; kalau masih gagal, hubungi admin.";
  }
  if (kode === "storage/quota-exceeded") return "Kuota penyimpanan habis. Hubungi admin.";
  if (kode === "storage/retry-limit-exceeded") return "Unggahan terputus. Periksa koneksi lalu coba lagi.";
  if (kode === "storage/canceled") return "Unggahan dibatalkan.";
  return "Unggahan gagal. Coba lagi.";
}

/** Lampiran pengajar: `class-files/{uid}/{classId}/…`. */
export function unggahLampiranKelas(uid: string, classId: string, files: readonly File[]) {
  return Promise.all(files.map((f) => unggah(`${CLASS_FILES}/${uid}/${classId}`, f)));
}

/**
 * Berkas konteks koreksi AI (soal/kunci jawaban): `class-files/{uid}/{classId}/ai-{postId}/…`.
 * Folder yang sama dengan lampiran (rules-nya sudah ada), tetapi TIDAK pernah
 * tercatat sebagai lampiran postingan — route lampiran tidak bisa menyajikannya.
 */
export function unggahKonteksAi(uid: string, classId: string, postId: string, files: readonly File[]) {
  return Promise.all(files.map((f) => unggah(`${CLASS_FILES}/${uid}/${classId}/ai-${postId}`, f)));
}

/** Jawaban siswa: `class-submissions/{uid}/{classId}/{postId}/…`. */
export function unggahJawabanKelas(uid: string, classId: string, postId: string, files: readonly File[]) {
  return Promise.all(files.map((f) => unggah(`${CLASS_SUBMISSION_FILES}/${uid}/${classId}/${postId}`, f)));
}
