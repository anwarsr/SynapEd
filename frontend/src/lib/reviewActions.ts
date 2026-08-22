"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { getCourse } from "@/lib/courses";
import { getEnrollment } from "@/lib/enrollments";
import { REVIEWS, getReview, reviewId, reviewRef } from "@/lib/reviews";

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

const MIN_COMMENT = 10;
const MAX_COMMENT = 1000;

/**
 * Menulis dan menghapus ulasan kursus.
 *
 * Satu aturan yang menopang seluruh gunanya fitur ini: yang boleh menulis
 * hanyalah orang yang enrollment-nya BERSTATUS SELESAI untuk kursus itu.
 * Diperiksa di server, bukan dengan menyembunyikan formulirnya — Server Action
 * bisa dipanggil lewat POST langsung tanpa membuka halamannya sama sekali,
 * dan tanpa penjaga ini siapa pun bisa mengarang bintang lima untuk kursus
 * yang tidak pernah ia sentuh.
 *
 * Rata-rata bintang disimpan di dokumen kursus (`rating`, `reviews`,
 * `ratingSum`) dan diperbarui dalam transaksi yang sama, bukan dihitung ulang
 * dengan membaca semua ulasan setiap kali kartu katalog dirender.
 */

function cleanComment(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, MAX_COMMENT) : "";
}

/**
 * Menerapkan selisih ke ringkasan bintang di dokumen kursus.
 *
 * `ratingSum` ikut disimpan supaya rata-ratanya bisa diperbarui dengan
 * penjumlahan, bukan pembagian ulang dari nol. Tanpa itu, satu ulasan yang
 * disunting mengharuskan seluruh ulasan kursus dibaca ulang di dalam
 * transaksi — dan transaksi Firestore membatasi apa yang boleh dibaca.
 *
 * Kursus lama tidak punya `ratingSum`; dianggap 0, dan nilainya jadi benar
 * sendiri sejak ulasan pertama karena semuanya bermula dari nol juga.
 */
function ringkasan(reviewsLama: number, sumLama: number, delta: { jumlah: number; sum: number }) {
  const reviews = Math.max(0, reviewsLama + delta.jumlah);
  const ratingSum = Math.max(0, sumLama + delta.sum);

  // Satu angka di belakang koma — itu yang dirender kartu katalog dan halaman
  // detail. Nol ulasan berarti nol, bukan NaN.
  const rating = reviews === 0 ? 0 : Math.round((ratingSum / reviews) * 10) / 10;

  return { reviews, ratingSum, rating };
}

export async function submitReview(
  slug: string,
  ratingRaw: number,
  commentRaw: string,
): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const rating = Math.round(Number(ratingRaw));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Beri bintang antara 1 sampai 5." };
  }

  const comment = cleanComment(commentRaw);
  if (comment.length < MIN_COMMENT) {
    return { ok: false, error: `Tuliskan ulasan Anda, minimal ${MIN_COMMENT} karakter.` };
  }

  const course = await getCourse(slug);
  if (!course) return { ok: false, error: "Kursus tidak ditemukan." };

  // Inti aturannya. Educator pemilik dan admin pun tidak lolos di sini: mereka
  // membuka kursus lewat hak akses, bukan lewat enrollment, jadi tidak punya
  // dokumen yang bisa berstatus selesai.
  const enrollment = await getEnrollment(user.uid, slug);
  if (!enrollment) {
    return { ok: false, error: "Hanya peserta kursus ini yang dapat memberi ulasan." };
  }
  if (enrollment.status !== "completed") {
    return {
      ok: false,
      error: "Selesaikan dulu seluruh pelajaran di kursus ini sebelum memberi ulasan.",
    };
  }

  const id = reviewId(user.uid, slug);
  const now = new Date().toISOString();
  const db = adminDb();
  const cRef = db.collection("courses").doc(slug);
  const rRef = reviewRef(id);

  const sudahAda = await db.runTransaction(async (tx) => {
    // Kedua pembacaan harus terjadi SEBELUM penulisan pertama — aturan
    // transaksi Firestore, bukan gaya penulisan.
    const [rSnap, cSnap] = await Promise.all([tx.get(rRef), tx.get(cRef)]);

    const lama = rSnap.data();
    const c = cSnap.data() ?? {};

    const reviewsLama = typeof c.reviews === "number" ? c.reviews : 0;
    const sumLama = typeof c.ratingSum === "number" ? c.ratingSum : 0;

    const delta = lama
      ? { jumlah: 0, sum: rating - (typeof lama.rating === "number" ? lama.rating : 0) }
      : { jumlah: 1, sum: rating };

    tx.set(rRef, {
      id,
      courseSlug: slug,
      courseTitle: course.title,
      courseThumbnail: course.thumbnail ?? null,
      uid: user.uid,
      name: user.name,
      photoURL: user.photoURL ?? null,
      rating,
      comment,
      createdAt: (lama?.createdAt as string | undefined) ?? now,
      updatedAt: now,
    });

    tx.update(cRef, ringkasan(reviewsLama, sumLama, delta));

    return Boolean(lama);
  });

  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin/reviews");

  return {
    ok: true,
    message: sudahAda ? "Ulasan Anda diperbarui." : "Terima kasih, ulasan Anda tersimpan.",
  };
}

/** Mencabut ulasan sendiri. */
export async function deleteMyReview(slug: string): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const review = await getReview(user.uid, slug);
  if (!review) return { ok: false, error: "Anda belum menulis ulasan untuk kursus ini." };

  await hapus(review.id, review.courseSlug, review.rating);

  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin/reviews");

  return { ok: true, message: "Ulasan Anda dihapus." };
}

/**
 * Penghapusan oleh admin.
 *
 * Ulasan tampil di halaman depan tanpa persetujuan siapa pun, jadi harus ada
 * jalan membuang yang kasar atau spam. Tidak ada penyuntingan isi: mengubah
 * kata-kata orang lain lalu tetap menampilkannya atas namanya jauh lebih buruk
 * daripada menghapusnya.
 */
export async function deleteReview(id: string): Promise<ReviewResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat menghapus ulasan." };
  }

  const snap = await reviewRef(id).get();
  const data = snap.data();
  if (!data) return { ok: false, error: "Ulasan tidak ditemukan." };

  const slug = (data.courseSlug as string | undefined) ?? "";
  await hapus(id, slug, typeof data.rating === "number" ? data.rating : 0);

  revalidatePath("/");
  revalidatePath("/courses");
  if (slug) revalidatePath(`/courses/${slug}`);
  revalidatePath("/admin/reviews");

  return { ok: true, message: "Ulasan dihapus." };
}

/** Membuang satu ulasan sekaligus menarik kembali sumbangannya ke rata-rata. */
async function hapus(id: string, slug: string, rating: number): Promise<void> {
  const db = adminDb();
  const rRef = db.collection(REVIEWS).doc(id);

  if (!slug) {
    await rRef.delete();
    return;
  }

  const cRef = db.collection("courses").doc(slug);

  await db.runTransaction(async (tx) => {
    const [rSnap, cSnap] = await Promise.all([tx.get(rRef), tx.get(cRef)]);

    // Sudah hilang duluan (mis. dua tab). Idempoten, bukan galat — dan yang
    // penting, ringkasannya TIDAK dikurangi dua kali.
    if (!rSnap.exists) return;

    tx.delete(rRef);

    if (!cSnap.exists) return;
    const c = cSnap.data() ?? {};
    tx.update(
      cRef,
      ringkasan(
        typeof c.reviews === "number" ? c.reviews : 0,
        typeof c.ratingSum === "number" ? c.ratingSum : 0,
        { jumlah: -1, sum: -rating },
      ),
    );
  });
}

/**
 * Membuang ulasan sebuah kursus yang dihapus.
 *
 * Dipanggil dari jalur penghapusan kursus. Tanpa ini, ulasannya tetap hidup
 * dan terus tampil di beranda menunjuk kursus yang tautannya sudah 404.
 */
export async function purgeCourseReviews(courseSlug: string): Promise<number> {
  const db = adminDb();
  const snap = await db.collection(REVIEWS).where("courseSlug", "==", courseSlug).get();
  if (snap.empty) return 0;

  // Dokumen kursusnya ikut hilang, jadi ringkasan bintangnya tidak perlu
  // dirapikan — cukup buang ulasannya.
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 450)) batch.delete(doc.ref);
    await batch.commit();
  }

  return snap.size;
}
