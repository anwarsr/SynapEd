/**
 * Isi kartu mini-profil yang muncul saat foto/nama penulis komentar dipencet.
 * Modul netral (tanpa server-only) - dipakai server action dan komponen klien.
 */

export interface MiniKursusDiikuti {
  slug: string;
  title: string;
  level: string;
  done: number;
  total: number;
  percent: number;
}

export interface MiniKursusDibuat {
  slug: string;
  title: string;
  students: number;
}

export interface MiniProfile {
  name: string;
  photoURL: string | null;
  bannerURL: string | null;
  role: "user" | "educator" | "admin";
  /** Kosong untuk admin: akun admin tidak membuka apa pun di sini. */
  followed: MiniKursusDiikuti[];
  /** Hanya terisi untuk educator; tanpa kemajuan. */
  created: MiniKursusDibuat[];
}
