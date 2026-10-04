import "server-only";
import { adminStorage } from "@/lib/firebase/admin";
import {
  AVATARS,
  CLASS_FILES,
  CLASS_SUBMISSION_FILES,
  COURSE_ASSETS,
  COURSE_THUMBNAILS,
  SUBMISSION_FILES,
} from "@/lib/storagePaths";
import type { Section } from "@/lib/courses";

/**
 * Membuang berkas Storage yang sudah tidak dirujuk apa pun.
 *
 * Firestore dan Storage adalah dua sistem terpisah: menghapus dokumen kursus
 * tidak menyentuh berkasnya sama sekali. Tanpa modul ini, setiap materi yang
 * diganti, setiap gambar latar yang ditukar, dan setiap kursus yang dihapus
 * meninggalkan berkas yang tidak lagi bisa dijangkau siapa pun — tak terlihat
 * di aplikasi, tetapi tetap ditagih selamanya.
 *
 * ── Aturan yang menjaga modul ini tidak menghapus hal yang salah ──
 *
 * 1. Hanya folder yang dikelola aplikasi yang boleh disentuh. `lesson-assets/`
 *    SENGAJA tidak termasuk: isinya materi kursus bawaan yang diunggah manual
 *    lewat Console, dan kursus-kursus itu tidak punya ownerUid sehingga tidak
 *    bisa dihapus lewat UI. Menghapusnya otomatis hanya menambah risiko tanpa
 *    menyelesaikan masalah apa pun.
 *
 * 2. Penghapusan selalu berdasarkan path PERSIS yang tercatat, bukan awalan
 *    nama berkas. Gambar latar bernama `{slug}-{waktu}-{nama}` dan berada di
 *    satu folder datar, jadi menghapus dengan awalan `tess-` akan ikut
 *    memakan gambar milik `tess-2`.
 *
 * 3. Kegagalan tidak pernah dilempar ke pemanggil. Pembersihan berjalan
 *    SETELAH datanya tersimpan; kalau Storage sedang bermasalah, yang pantas
 *    terjadi adalah berkasnya tertinggal — bukan educator melihat "gagal
 *    menyimpan" padahal kursusnya sudah tersimpan dengan benar.
 */

/**
 * Awalan yang boleh dihapus otomatis. Di luar ini, modul menolak.
 *
 * `submissions/` ikut karena mengumpulkan ulang mengganti berkasnya — yang
 * lama harus terbuang, kalau tidak Storage menumpuk berkas yang sudah tidak
 * dirujuk apa pun. Penambahannya ketahuan lewat pemeriksaan yang gagal:
 * penghapusannya diam-diam tidak terjadi karena awalan ini belum terdaftar.
 *
 * `payment-proofs/` SENGAJA tidak masuk: bukti bayar adalah catatan
 * transaksi yang harus bisa ditelusuri kembali, bukan berkas sementara.
 *
 * `class-files/` dan `class-submissions/` ikut karena menghapus postingan,
 * membatalkan pengiriman, atau menghapus kelas harus ikut membuang berkasnya.
 */
const MANAGED_PREFIXES = [
  `${COURSE_ASSETS}/`,
  `${COURSE_THUMBNAILS}/`,
  `${AVATARS}/`,
  `${SUBMISSION_FILES}/`,
  `${CLASS_FILES}/`,
  `${CLASS_SUBMISSION_FILES}/`,
];

export function isManagedPath(path: unknown): path is string {
  return typeof path === "string" && MANAGED_PREFIXES.some((p) => path.startsWith(p));
}

/** Semua path lampiran di dalam sebuah kurikulum. */
export function attachmentPaths(sections: Section[] | undefined): string[] {
  const out: string[] = [];
  for (const section of sections ?? []) {
    for (const lesson of section.lessons ?? []) {
      for (const attachment of lesson.attachments ?? []) {
        if (typeof attachment?.path === "string") out.push(attachment.path);
      }
    }
  }
  return out;
}

/**
 * Semua berkas milik satu kursus: lampiran + gambar latar.
 *
 * `thumbnail` disaring lewat isManagedPath karena kursus hasil migrasi
 * menyimpan URL penuh atau path di folder public/ di field yang sama.
 */
export function courseFilePaths(data: {
  sections?: Section[];
  thumbnail?: unknown;
}): string[] {
  // Awalannya diperiksa spesifik per jenis, bukan lewat isManagedPath: sebuah
  // lampiran tidak pernah sah berada di folder gambar latar, apalagi di folder
  // foto profil. Pemeriksaan yang longgar akan membiarkan nilai aneh di data
  // lama mengarahkan penghapusan ke folder yang sama sekali lain.
  const paths = attachmentPaths(data.sections).filter((p) =>
    p.startsWith(`${COURSE_ASSETS}/`),
  );

  const thumbnail = data.thumbnail;
  if (typeof thumbnail === "string" && thumbnail.startsWith(`${COURSE_THUMBNAILS}/`)) {
    paths.push(thumbnail);
  }

  return [...new Set(paths)];
}

/**
 * Menghapus berkas. Path yang bukan milik folder terkelola diabaikan diam-diam.
 *
 * Mengembalikan jumlah yang benar-benar terhapus — dipakai skrip pembersih
 * untuk melaporkan hasilnya, dan berguna saat menelusuri masalah.
 */
export async function deleteObjects(paths: Iterable<string>): Promise<number> {
  const targets = [...new Set([...paths])].filter(isManagedPath);
  if (targets.length === 0) return 0;

  const bucket = adminStorage().bucket();

  const results = await Promise.allSettled(
    // ignoreNotFound: berkas yang sudah hilang bukan kegagalan. Ini kejadian
    // wajar — misalnya dua penyimpanan beruntun yang membuang path yang sama.
    targets.map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
  );

  let deleted = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") deleted++;
    else console.warn(`[storage] gagal menghapus ${targets[i]}:`, r.reason);
  });

  return deleted;
}

/**
 * Menghapus isi folder lampiran yang tidak ada dalam daftar `keep`.
 *
 * Ini yang menangkap berkas yang diunggah lalu dibatalkan SEBELUM disimpan:
 * unggahan terjadi seketika saat berkas dipilih, jadi mengganti pilihan tiga
 * kali meninggalkan dua berkas yang tidak pernah tercatat di Firestore mana
 * pun. Membandingkan isi folder dengan kurikulum yang tersimpan menemukan
 * mereka semua.
 *
 * Folder-nya diturunkan dari path lampiran itu sendiri
 * (`course-assets/{uid}/{prefix}/`), yang unik per kursus: `{prefix}` adalah
 * id draft acak saat membuat, atau slug kursus saat menyunting. Garis miring
 * penutup itu penting — tanpanya, folder `tess/` juga akan mencakup `tess-2/`.
 */
export async function pruneAttachmentFolders(
  knownPaths: Iterable<string>,
  keep: Iterable<string>,
): Promise<number> {
  const keepSet = new Set(keep);

  const folders = new Set<string>();
  for (const path of knownPaths) {
    if (!path.startsWith(`${COURSE_ASSETS}/`)) continue;
    const segments = path.split("/");
    // course-assets / uid / prefix / berkas -> minimal empat bagian.
    if (segments.length < 4) continue;
    folders.add(`${segments[0]}/${segments[1]}/${segments[2]}/`);
  }
  if (folders.size === 0) return 0;

  const bucket = adminStorage().bucket();
  const stale: string[] = [];

  for (const prefix of folders) {
    try {
      const [files] = await bucket.getFiles({ prefix });
      for (const file of files) {
        if (!keepSet.has(file.name)) stale.push(file.name);
      }
    } catch (e) {
      console.warn(`[storage] gagal membaca folder ${prefix}:`, e);
    }
  }

  return deleteObjects(stale);
}

/**
 * Menyisakan satu berkas di folder foto profil seorang pengguna.
 *
 * Nama berkasnya mengikuti tipe gambar (`avatar.jpg`, `avatar.png`, …), jadi
 * mengganti foto JPG dengan PNG TIDAK menimpa yang lama — keduanya tinggal,
 * dan yang lama tidak lagi dirujuk siapa pun. Beri `keep` kosong untuk
 * mengosongkan folder sepenuhnya, misalnya saat akunnya dihapus.
 *
 * Selalu dibatasi ke folder milik satu uid; uid-nya berasal dari sesi, bukan
 * dari browser.
 */
export async function pruneAvatarFolder(uid: string, keep?: string): Promise<number> {
  if (!uid) return 0;

  const bucket = adminStorage().bucket();
  const prefix = `${AVATARS}/${uid}/`;

  try {
    const [files] = await bucket.getFiles({ prefix });
    const stale = files.map((f) => f.name).filter((name) => name !== keep);
    return await deleteObjects(stale);
  } catch (e) {
    console.warn(`[storage] gagal membaca folder ${prefix}:`, e);
    return 0;
  }
}
