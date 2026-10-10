/**
 * Bentuk dan batas data kelas.
 *
 * Modul ini sengaja NETRAL — tanpa `server-only` dan tanpa `use client`.
 *
 * Batas panjangnya dipakai DUA sisi: formulir di browser memakainya untuk
 * `maxLength` dan penghitung sisa karakter, server memakainya untuk memangkas
 * ulang. Menaruhnya di `classes.ts` yang `server-only` menyeret firebase-admin
 * ikut ke bundel browser — dan kegagalannya bukan galat tipe, melainkan
 * halaman yang gagal dikompilasi dengan pesan tentang `node-fetch`.
 *
 * Pola yang sama sudah dipakai courseRequestTypes.ts dan profileTypes.ts.
 */

/** Batas panjang, diperiksa ulang di server — bukan hanya di formulir. */
export const MAX_CLASS_NAME = 80;
export const MAX_CLASS_DESC = 500;
export const MAX_POST_BODY = 5000;
export const MAX_REPLY_BODY = 2000;

export interface Kelas {
  id: string;
  name: string;
  description: string;
  ownerUid: string;
  /** Foto profil kelas (URL Storage, `avatars/{uid}/class-*.jpg`); null = tanpa foto, jatuh ke inisial. */
  imageURL: string | null;
  /**
   * Kode undangan. RAHASIA — setara kunci pintu.
   *
   * Jangan pernah mengirimnya ke halaman yang dibuka anggota biasa: siapa pun
   * yang memegangnya bisa mengajak orang lain masuk tanpa sepengetahuan
   * pemilik kelas.
   */
  joinCode: string;
  memberCount: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KelasMember {
  id: string;
  uid: string;
  classId: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface KelasPost {
  id: string;
  classId: string;
  authorUid: string;
  body: string;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KelasReply {
  id: string;
  postId: string;
  classId: string;
  authorUid: string;
  body: string;
  createdAt: string;
}

/**
 * Kelas TANPA kode undangannya.
 *
 * Dipakai setiap halaman yang bukan milik pemilik kelas. Bentuk terpisah,
 * bukan sekadar "jangan lupa hapus field-nya": kelalaian satu kali di satu
 * halaman membocorkan kunci kelas, dan tipe inilah yang membuat kelalaian itu
 * gagal saat dikompilasi.
 */
export type KelasPublik = Omit<Kelas, "joinCode">;

export function stripJoinCode(k: Kelas): KelasPublik {
  // Disalin lalu satu field dibuang, bukan didaftar ulang satu per satu.
  // Mendaftar ulang berarti setiap field baru harus diingat ditambahkan di
  // sini, dan yang terlupa akan hilang diam-diam dari halaman anggota.
  const sisa: Partial<Kelas> = { ...k };
  delete sisa.joinCode;
  return sisa as KelasPublik;
}
