import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { listMyEnrollments } from "@/lib/enrollments";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { listMyClasses } from "@/lib/classes";
import { cleanProfile, EMPTY_PROFILE, type ProfileContent } from "@/lib/profileTypes";

/**
 * Isi profil yang ditulis sendiri oleh pengguna.
 *
 * Disimpan di dokumen `users/{uid}` yang sudah ada — bersama `phone` — bukan
 * di koleksi baru. Keduanya sama-sama "keterangan tentang orang ini", dan
 * memisahkannya berarti dua pembacaan untuk merender satu halaman.
 *
 * Nama dan foto TIDAK di sini: keduanya milik Firebase Auth, dan menyalinnya
 * ke Firestore berarti dua sumber kebenaran yang pasti melenceng — persis
 * jebakan yang membuat nama di sesi dan di profil bisa berbeda.
 */
export async function getUserProfile(uid: string): Promise<ProfileContent> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const data = snap.data();
  if (!data) return { ...EMPTY_PROFILE };

  // Dibersihkan saat DIBACA, bukan hanya saat ditulis. Dokumen bisa disunting
  // langsung lewat Firebase Console, dan halaman profil tidak boleh pecah
  // hanya karena satu field bertipe tak terduga.
  return cleanProfile(data);
}

/**
 * Nomor HP pemilik akun — hanya untuk halaman pengaturannya sendiri.
 *
 * Sengaja terpisah dari `getUserProfile`, yang juga dipakai profil publik:
 * nomor telepon adalah kontak pribadi dan tidak boleh ikut terbawa ke sana.
 */
export async function getMyPhone(uid: string): Promise<string> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const phone = snap.get("phone");
  return typeof phone === "string" ? phone : "";
}

export interface ProfileStats {
  /** Peserta: kursus yang diikuti dan yang sudah selesai. */
  enrolled: number;
  completed: number;
  certificates: number;
  /** Kelas (ruang educator) yang diikuti. */
  classes: number;
  /** Educator: kursus yang dibuat dan total pesertanya. */
  courses: number;
  students: number;
  /**
   * Rata-rata ulasan seluruh kursusnya, DIBOBOT jumlah ulasan.
   *
   * Rata-rata dari rata-rata akan menyamakan kursus berulasan satu dengan
   * kursus berulasan seratus — satu ulasan bintang lima bisa mengangkat
   * angka yang mewakili ratusan orang.
   *
   * 0 berarti belum ada ulasan sama sekali, bukan nilai nol.
   */
  avgRating: number;
  /** Total pelajaran di seluruh kursus yang ia buat. */
  lessons: number;
}

/**
 * Angka ringkas di halaman profil.
 *
 * Semuanya dihitung dari data yang sudah ada — tidak ada penghitung yang
 * disimpan terpisah. Penghitung tersimpan selalu berakhir melenceng dari
 * kenyataan begitu ada satu jalur penulisan yang lupa memperbaruinya, dan
 * jumlah dokumen di sini masih jauh dari perlu dioptimalkan.
 */
export async function getProfileStats(uid: string, isEducator: boolean): Promise<ProfileStats> {
  const [enrollments, owned, kelas] = await Promise.all([
    listMyEnrollments(uid),
    isEducator ? listOwnedCourses(uid) : Promise.resolve([]),
    listMyClasses(uid),
  ]);

  const completed = enrollments.filter((e) => e.status === "completed").length;

  // Dibobot jumlah ulasannya, bukan rata-rata dari rata-rata.
  const totalUlasan = owned.reduce((n, c) => n + (c.reviews ?? 0), 0);
  const jumlahBintang = owned.reduce((n, c) => n + (c.rating ?? 0) * (c.reviews ?? 0), 0);

  return {
    enrolled: enrollments.length,
    completed,
    // Sertifikat dihitung dari enrollment, bukan dari koleksi certificates:
    // sertifikat yang dicabut tetap ada dokumennya, dan menghitungnya di sini
    // akan menjanjikan sesuatu yang sudah tidak berlaku.
    certificates: enrollments.filter((e) => Boolean(e.certificateId)).length,
    classes: kelas.length,
    courses: owned.length,
    students: owned.reduce((total, c) => total + (c.enrolledStudents ?? 0), 0),
    avgRating: totalUlasan > 0 ? jumlahBintang / totalUlasan : 0,
    lessons: owned.reduce((n, c) => n + (c.lessonsCount ?? 0), 0),
  };
}

/**
 * Bulan & tahun akun dibuat, mis. "Februari 2026".
 *
 * Hanya Firebase Auth yang menyimpannya (metadata.creationTime) — tidak ada
 * salinannya di Firestore, dan memang tidak perlu ada: nilainya tidak
 * pernah berubah, jadi menyalinnya hanya menambah satu tempat yang bisa
 * melenceng.
 *
 * Kegagalan dijawab string kosong, bukan lemparan: tanggal bergabung
 * hiasan pada halaman profil, dan halaman itu tidak boleh mati karenanya.
 */
export function joinedAtOf(creationTime: string | undefined): string {
  if (!creationTime) return "";

  const t = new Date(creationTime);
  if (Number.isNaN(t.getTime())) return "";

  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", month: "long", year: "numeric" }).format(t);
}
