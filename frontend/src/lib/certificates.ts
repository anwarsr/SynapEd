import "server-only";
import { randomBytes } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { flattenLessons, type CourseDetail } from "@/lib/courses";
import { enrollmentRef, type Enrollment } from "@/lib/enrollments";
import type { SessionUser } from "@/lib/firebase/session";

export interface Certificate {
  id: string;
  uid: string;
  holderName: string;
  courseSlug: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string;
  lessonsTotal: number;
  revokedAt: string | null;
}

// Alfabet Crockford base32 — tanpa I, L, O, U supaya tidak tertukar saat
// dibaca manusia (mis. diketik ulang dari sertifikat cetak).
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * ID sertifikat: acak, TIDAK diturunkan dari uid+slug.
 *
 * Beda sengaja dari enrollmentId (yang deterministik): halaman verifikasi
 * bersifat publik tanpa login, dan ID yang bisa dihitung dari uid+slug akan
 * membiarkan siapa pun memastikan apakah orang tertentu menyelesaikan kursus
 * tertentu — kebocoran enumerasi enrollment yang menyamar sebagai fitur.
 */
function randomCertificateId(): string {
  const bytes = randomBytes(10);
  let code = "";
  // 256 % 32 === 0, jadi byte % 32 tidak bias ke simbol tertentu.
  for (const b of bytes) code += CROCKFORD[b % 32];
  return `SYN-${code}`;
}

export function certificateRef(id: string) {
  return adminDb().collection("certificates").doc(id);
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  const doc = await certificateRef(id).get();
  return doc.exists ? (doc.data() as Certificate) : null;
}

/**
 * Menerbitkan sertifikat begitu SEMUA pelajaran di kurikulum yang sedang
 * berlaku sudah tercatat selesai — dipanggil dari markLessonComplete dan
 * submitQuiz (setelah lulus), tidak pernah langsung dari klien.
 *
 * `finalCompletedLessons` dihitung di pemanggil (completedLessons lama +
 * slug yang baru saja selesai) alih-alih membaca ulang Firestore — arrayUnion
 * sudah pasti berhasil di titik pemanggilan ini, jadi hasilnya aman
 * disimulasikan di memori tanpa pembacaan tambahan.
 *
 * Irisan dengan kurikulum yang HIDUP (bukan enrollment.lessonsTotal yang
 * bisa basi) — alasannya sama dengan progressOf(): begitu educator menghapus
 * pelajaran lewat editor kurikulum, jumlah pelajaran yang tersimpan di
 * snapshot enrollment bisa melenceng dari kurikulum sebenarnya.
 *
 * Mengembalikan id sertifikat HANYA kalau panggilan inilah yang baru
 * menerbitkannya — `null` di setiap kondisi lain (sudah tersertifikasi
 * sebelumnya, belum lengkap, atau kalah race dengan tab/permintaan lain).
 * Pemanggil memakai ini sebagai sinyal sekali-pakai ("tampilkan perayaan
 * sekarang"), BUKAN sebagai cara memeriksa status sertifikat — untuk itu baca
 * enrollment.certificateId langsung, supaya kunjungan ulang ke kursus yang
 * sudah selesai tidak memicu ulang layar perayaan.
 */
export async function issueCertificateIfComplete(
  user: SessionUser,
  course: CourseDetail,
  enrollment: Enrollment,
  finalCompletedLessons: string[],
): Promise<string | null> {
  if (enrollment.certificateId) return null; // sudah terbit — tidak perlu diperiksa lagi

  const allSlugs = flattenLessons(course).map((l) => l.slug);
  if (allSlugs.length === 0) return null;

  const done = new Set(finalCompletedLessons);
  if (!allSlugs.every((s) => done.has(s))) return null;

  const id = randomCertificateId();
  const now = new Date().toISOString();
  const eRef = enrollmentRef(user.uid, course.slug);

  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(eRef);
    const current = snap.data() as Enrollment | undefined;
    // Race dengan panggilan lain (mis. tab ganda) sudah menerbitkannya —
    // idempoten, bukan dianggap galat.
    if (!current || current.certificateId) return null;

    tx.set(certificateRef(id), {
      id,
      uid: user.uid,
      holderName: user.name,
      courseSlug: course.slug,
      courseTitle: course.title,
      instructorName: course.instructorName,
      issuedAt: now,
      lessonsTotal: allSlugs.length,
      revokedAt: null,
    });
    tx.update(eRef, { certificateId: id, status: "completed", completedAt: now });
    return id;
  });
}
