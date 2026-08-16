"use server";
import { getCurrentUser } from "@/lib/firebase/session";
import { AVATARS, COURSE_ASSETS, COURSE_THUMBNAILS } from "@/lib/storagePaths";
import { deleteObjects, pruneAvatarFolder } from "@/lib/storageCleanup";

/**
 * Pembersihan yang dipicu dari browser, saat berkasnya belum tercatat di mana pun.
 *
 * Unggahan terjadi seketika ketika berkas dipilih, jauh sebelum tombol simpan
 * ditekan. Jadi mengganti pilihan berulang kali — atau menutup form begitu
 * saja — meninggalkan berkas yang tidak pernah masuk Firestore, sehingga tidak
 * ada pembandingan lama-vs-baru yang bisa menemukannya nanti. Satu-satunya
 * pihak yang tahu berkas itu baru saja dibuang adalah halaman yang membuangnya.
 *
 * Menghapus dari klien langsung bukan pilihan: storage.rules memeriksa
 * `request.resource.size` dan `contentType`, dan keduanya null pada operasi
 * hapus, sehingga aturannya selalu menolak. Karena itu jalurnya lewat sini.
 */

/** Path yang boleh dibuang seseorang: hanya yang berada di foldernya sendiri. */
function ownedByUser(path: string, uid: string): boolean {
  return (
    path.startsWith(`${COURSE_ASSETS}/${uid}/`) ||
    path.startsWith(`${COURSE_THUMBNAILS}/${uid}/`)
  );
}

/**
 * Membuang satu berkas yang baru saja diunggah lalu dibatalkan.
 *
 * Path datang dari browser, jadi diperiksa terhadap uid SESI — bukan uid yang
 * ikut dikirim. Tanpa itu, Server Action ini bisa dipanggil langsung lewat
 * POST untuk menghapus berkas milik akun mana pun.
 *
 * Kalau path-nya milik orang lain, permintaannya diabaikan tanpa keluhan:
 * ini pembersihan latar belakang, dan satu-satunya cara hal itu terjadi secara
 * wajar adalah admin menyunting kursus educator lain — di sana pembandingan
 * lama-vs-baru saat menyimpan yang akan mengurusnya.
 */
export async function discardUpload(path: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  if (typeof path !== "string" || !ownedByUser(path, user.uid)) return;

  await deleteObjects([path]);
}

/** Menyisakan foto profil yang baru saja diunggah, membuang versi sebelumnya. */
export async function syncAvatarFiles(keepPath: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  // Berkas yang dipertahankan wajib berada di folder pemanggilnya sendiri.
  // Kalau tidak, `keep` yang asing membuat foto miliknya sendiri yang terhapus.
  if (typeof keepPath !== "string" || !keepPath.startsWith(`${AVATARS}/${user.uid}/`)) return;

  await pruneAvatarFolder(user.uid, keepPath);
}

/** Mengosongkan folder foto profil — dipakai tepat sebelum akun dihapus. */
export async function purgeAvatarFiles(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await pruneAvatarFolder(user.uid);
}
