import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getBannerURLs } from "@/lib/banner";

export const REVIEWS = "reviews";

/**
 * Ulasan kursus dari peserta yang sudah menyelesaikannya.
 *
 * Menggantikan testimoni yang dulu ditulis tangan di data/landing.ts. Karena
 * sekarang isinya nyata, ada satu aturan yang tidak boleh longgar: hanya
 * pemilik enrollment berstatus "completed" yang boleh menulis. Penjaganya ada
 * di reviewActions.ts, bukan di sini — modul ini hanya membaca.
 *
 * Nama, foto, judul kursus, dan gambarnya disalin ke dalam dokumen ulasan,
 * BUKAN diambil lewat join saat dibaca. Alasannya sama dengan courseSnapshot
 * di enrollments.ts: beranda menampilkan belasan ulasan dari kursus yang
 * berbeda-beda, dan tanpa salinan itu setiap ulasan berarti dua pembacaan
 * tambahan — satu ke kursus, satu ke akun penulisnya.
 *
 * Tertutup rapat dari klien lewat firestore.rules, sama seperti enrollments
 * dan courseChangeRequests: seluruh penulisannya lewat Server Action.
 */
export interface Review {
  /** = id dokumen, `{uid}_{courseSlug}`. */
  id: string;

  courseSlug: string;
  /** Salinan tampilan — lihat catatan di atas. */
  courseTitle: string;
  courseThumbnail: string | null;

  uid: string;
  name: string;
  photoURL: string | null;
  /**
   * Banner profil penulis — TIDAK disalin ke dokumen ulasan (beda dengan nama &
   * foto): diambil dari `users/{uid}` saat dibaca, jadi ganti banner langsung
   * tampil di semua komentar lamanya. Hanya diisi oleh listFeaturedReviews.
   */
  bannerURL: string | null;

  /** Bilangan bulat 1..5. */
  rating: number;
  comment: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Satu ulasan per orang per kursus, dan id-nya bisa dihitung tanpa query.
 *
 * Deterministik dengan alasan yang persis sama seperti enrollmentId(): menulis
 * ulang ulasan menjadi penimpaan, bukan penggandaan. Dengan auto-ID, satu
 * klik ganda di tombol kirim sudah cukup untuk membuat dua ulasan dari orang
 * yang sama, dan rata-rata bintangnya ikut terhitung dua kali.
 */
export function reviewId(uid: string, courseSlug: string): string {
  return `${uid}_${courseSlug}`;
}

export function reviewRef(id: string) {
  return adminDb().collection(REVIEWS).doc(id);
}

function toReview(id: string, d: FirebaseFirestore.DocumentData): Review {
  return {
    id,
    courseSlug: (d.courseSlug as string | undefined) ?? "",
    courseTitle: (d.courseTitle as string | undefined) ?? "",
    courseThumbnail: (d.courseThumbnail as string | null | undefined) ?? null,
    uid: (d.uid as string | undefined) ?? "",
    name: (d.name as string | undefined) ?? "Peserta",
    photoURL: (d.photoURL as string | null | undefined) ?? null,
    bannerURL: null,
    rating: typeof d.rating === "number" ? d.rating : 0,
    comment: (d.comment as string | undefined) ?? "",
    createdAt: (d.createdAt as string | undefined) ?? "",
    updatedAt: (d.updatedAt as string | undefined) ?? "",
  };
}

export async function getReview(uid: string, courseSlug: string): Promise<Review | null> {
  const snap = await reviewRef(reviewId(uid, courseSlug)).get();
  const data = snap.data();
  return data ? toReview(snap.id, data) : null;
}

const terbaruDiAtas = (a: Review, b: Review) => b.createdAt.localeCompare(a.createdAt);

/** Ulasan sebuah kursus, terbaru di atas. Dipakai halaman detail kursus. */
export async function listCourseReviews(courseSlug: string): Promise<Review[]> {
  const snap = await adminDb().collection(REVIEWS).where("courseSlug", "==", courseSlug).get();
  return snap.docs.map((d) => toReview(d.id, d.data())).sort(terbaruDiAtas);
}

/** Seluruh ulasan, terbaru di atas. Dipakai panel admin. */
export async function listAllReviews(): Promise<Review[]> {
  const snap = await adminDb().collection(REVIEWS).get();
  return snap.docs.map((d) => toReview(d.id, d.data())).sort(terbaruDiAtas);
}

/** Batas bawah bintang yang boleh tampil di beranda. */
export const FEATURED_MIN_RATING = 4;

/**
 * Ulasan untuk bagian "Apa Kata Mereka" di beranda.
 *
 * Hanya bintang 4 ke atas — beranda itu etalase. Yang bernilai rendah tidak
 * disembunyikan dari siapa pun: semuanya tetap tampil utuh di halaman detail
 * kursusnya, tempat calon peserta benar-benar menimbang.
 *
 * Disaring dan diurutkan di memori, bukan lewat where + orderBy, supaya tidak
 * perlu composite index untuk koleksi sekecil ini — sama seperti listRequests
 * dan listApplications.
 */
export async function listFeaturedReviews(max = 12): Promise<Review[]> {
  const snap = await adminDb().collection(REVIEWS).get();

  const terpilih = snap.docs
    .map((d) => toReview(d.id, d.data()))
    .filter((r) => r.rating >= FEATURED_MIN_RATING && r.comment.trim() !== "")
    .sort(terbaruDiAtas)
    .slice(0, max);

  const banner = await getBannerURLs(terpilih.map((r) => r.uid)).catch(() => ({}) as Record<string, string | null>);
  return terpilih.map((r) => ({ ...r, bannerURL: banner[r.uid] ?? null }));
}
