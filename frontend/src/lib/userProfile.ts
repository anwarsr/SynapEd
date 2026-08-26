import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { listMyEnrollments } from "@/lib/enrollments";
import { listOwnedCourses } from "@/lib/educatorCourses";
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

export interface ProfileStats {
  /** Peserta: kursus yang diikuti dan yang sudah selesai. */
  enrolled: number;
  completed: number;
  certificates: number;
  /** Educator: kursus yang dibuat dan total pesertanya. */
  courses: number;
  students: number;
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
  const [enrollments, owned] = await Promise.all([
    listMyEnrollments(uid),
    isEducator ? listOwnedCourses(uid) : Promise.resolve([]),
  ]);

  const completed = enrollments.filter((e) => e.status === "completed").length;

  return {
    enrolled: enrollments.length,
    completed,
    // Sertifikat dihitung dari enrollment, bukan dari koleksi certificates:
    // sertifikat yang dicabut tetap ada dokumennya, dan menghitungnya di sini
    // akan menjanjikan sesuatu yang sudah tidak berlaku.
    certificates: enrollments.filter((e) => Boolean(e.certificateId)).length,
    courses: owned.length,
    students: owned.reduce((total, c) => total + (c.enrolledStudents ?? 0), 0),
  };
}
