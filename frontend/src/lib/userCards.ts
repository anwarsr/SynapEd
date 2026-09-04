import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

export interface UserCard {
  uid: string;
  name: string;
  photoURL: string | null;
}

/**
 * Nama dan foto penyedia kursus, dibaca sekaligus untuk banyak uid.
 *
 * Keduanya dibaca dari Auth, bukan dari salinan di dokumen kursus. Salinan
 * itu dibuat sekali saat kursus dibuat dan tidak pernah ikut berubah saat
 * pemiliknya mengganti nama atau fotonya — katalog lalu menampilkan identitas
 * lama tanpa satu pun pesan galat. Nama basi sempat dianggap dapat diterima
 * di sini; ternyata tidak: educator yang berganti nama melihat kartunya
 * tampil dengan foto baru bersama nama lama sekaligus.
 *
 * Dibaca dari Firebase Auth, tapi SEKALI untuk seluruh halaman
 * lewat getUsers() — bukan satu panggilan per kartu. Katalog dengan 30 kursus
 * tetap menghasilkan satu permintaan, bukan tiga puluh.
 */
export async function getUserCards(uids: readonly string[]): Promise<Map<string, UserCard>> {
  const unik = Array.from(new Set(uids.filter(Boolean)));
  const hasil = new Map<string, UserCard>();
  if (unik.length === 0) return hasil;

  // Batas getUsers: 100 identifier per panggilan. Kursus belum sebanyak itu,
  // tapi pemotongannya tetap ditulis supaya tidak gagal diam-diam nanti.
  for (let i = 0; i < unik.length; i += 100) {
    const potong = unik.slice(i, i + 100);

    try {
      const { users } = await adminAuth().getUsers(potong.map((uid) => ({ uid })));
      for (const u of users) {
        hasil.set(u.uid, {
          uid: u.uid,
          name: u.displayName?.trim() || u.email?.split("@")[0] || "Educator",
          photoURL: u.photoURL ?? null,
        });
      }
    } catch {
      // Akun yang sudah dihapus tidak muncul di hasil, dan itu memang benar —
      // pemanggilnya jatuh ke nama & foto yang tersimpan di dokumen kursus.
      // Kegagalan seluruh panggilan pun tidak boleh mematikan katalog: lebih
      // baik kartu tanpa foto daripada halaman yang tidak terbuka.
    }
  }

  return hasil;
}
