import "server-only";
import { adminAuth } from "@/lib/firebase/admin";

export interface Instructor {
  uid: string;
  name: string;
  photoURL: string | null;
}

/**
 * Nama dan foto penyedia kursus, dibaca sekaligus untuk banyak uid.
 *
 * Fotonya TIDAK disalin ke dokumen kursus seperti `instructorName`. Nama
 * jarang berubah, foto sering — dan foto basi lebih terasa salah daripada
 * nama basi, karena wajah orang yang tampil di katalog bukan lagi wajah yang
 * ia pilih.
 *
 * Karena itu dibaca dari Firebase Auth, tapi SEKALI untuk seluruh halaman
 * lewat getUsers() — bukan satu panggilan per kartu. Katalog dengan 30 kursus
 * tetap menghasilkan satu permintaan, bukan tiga puluh.
 */
export async function getInstructors(uids: readonly string[]): Promise<Map<string, Instructor>> {
  const unik = Array.from(new Set(uids.filter(Boolean)));
  const hasil = new Map<string, Instructor>();
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
      // pemanggilnya jatuh ke `instructorName` yang tersimpan di kursus.
      // Kegagalan seluruh panggilan pun tidak boleh mematikan katalog: lebih
      // baik kartu tanpa foto daripada halaman yang tidak terbuka.
    }
  }

  return hasil;
}
