import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import {
  getCourse,
  type CourseDetail,
  type CourseSummary,
  type CourseVisibility,
  type Section,
} from "@/lib/courses";
import type { SessionUser } from "@/lib/firebase/session";

export const COURSE_ASSETS = "course-assets";

/** Ukuran maksimum berkas — sama dengan batas di storage.rules. */
export const MAX_DOC_BYTES = 20 * 1024 * 1024;

export const DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const LEVELS = [
  { value: "Pemula", color: "green" },
  { value: "Menengah", color: "yellow" },
  { value: "Lanjutan", color: "red" },
] as const;

/**
 * Kategori TIDAK lagi hidup di sini.
 *
 * Dulu konstanta, sehingga menambah kategori berarti mengubah kode. Sekarang
 * dikelola admin lewat panel dan disimpan di koleksi `categories` — lihat
 * lib/categories.ts. Tetap bukan kolom bebas: educator memilih dari daftar,
 * jadi katalog tidak terpecah oleh salah ketik.
 */

export const ICONS = ["brain", "wave", "headset", "chart", "reading"] as const;

const TINTS: Record<string, string> = {
  brain: "bg-blue-50",
  wave: "bg-amber-100",
  headset: "bg-blue-50",
  chart: "bg-amber-100",
  reading: "bg-blue-50",
};

export interface EducatorCourseRow extends CourseSummary {
  createdAt: string | null;
  /**
   * Jumlah peserta. Ada di sini, meski bukan bagian dari CourseSummary, karena
   * inilah angka pertama yang dicari educator tentang kursusnya sendiri — dan
   * membacanya terpisah berarti satu kueri per kursus hanya untuk satu angka
   * yang sudah ada di dokumen yang sama.
   */
  enrolledStudents: number;
}

/** Judul -> slug yang aman dipakai sebagai document ID. */
export function toSlug(title: string): string {
  return (
    title
      .toLowerCase()
      // NFD memisahkan huruf beraksen menjadi huruf + tanda; tandanya dibuang
      // lebih dulu supaya "é" menjadi "e", bukan "e-".
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
  );
}

/**
 * Slug yang belum dipakai.
 *
 * Slug adalah document ID sekaligus URL, jadi tabrakan berarti satu kursus
 * menimpa kursus lain. Akhiran angka ditambahkan sampai bebas.
 */
export async function uniqueSlug(base: string): Promise<string> {
  const courses = adminDb().collection("courses");

  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await courses.doc(slug).get()).exists) return slug;
  }
  throw new Error("Tidak dapat membuat alamat kursus yang unik.");
}

/**
 * Nomor urut berikutnya.
 *
 * `listCourses` mengurutkan dengan `orderBy('order')`, dan Firestore
 * MENGABAIKAN dokumen yang tidak punya field itu. Jadi setiap kursus baru
 * wajib membawanya — kalau tidak, kursusnya menghilang dari katalog tanpa
 * pesan galat apa pun.
 */
export async function nextOrder(): Promise<number> {
  const snap = await adminDb().collection("courses").orderBy("order", "desc").limit(1).get();
  const highest = snap.docs[0]?.data().order as number | undefined;
  return (highest ?? 0) + 1;
}

export function tintFor(icon: string): string {
  return TINTS[icon] ?? "bg-blue-50";
}

/** Kursus milik seorang educator, terbaru di atas. */
export async function listOwnedCourses(uid: string): Promise<EducatorCourseRow[]> {
  const snap = await adminDb().collection("courses").where("ownerUid", "==", uid).get();

  return snap.docs
    .map((d) => {
      const data = d.data();
      const sections = (data.sections ?? []) as Section[];

      return {
        slug: d.id,
        title: data.title as string,
        shortDesc: (data.shortDesc as string) ?? "",
        level: (data.level as string) ?? "",
        levelColor: (data.levelColor as string) ?? "green",
        category: (data.category as string) ?? "",
        icon: (data.icon as string) ?? "reading",
        tint: (data.tint as string) ?? "bg-blue-50",
        duration: (data.duration as string) ?? "",
        rating: (data.rating as number) ?? 0,
        reviews: (data.reviews as number) ?? 0,
        lessonsCount: sections.reduce((n, s) => n + s.lessons.length, 0),
        thumbnail: (data.thumbnail as string | null | undefined) ?? null,
        instructorName: (data.instructorName as string | undefined) ?? "",
        ownerUid: (data.ownerUid as string | undefined) ?? null,
        // Daftar ini selalu milik SATU educator yang fotonya sudah tampil di
        // kepala halaman profilnya, jadi tidak perlu dibaca ulang per kursus.
        instructorPhoto: null,
        price: (data.price as number | undefined) ?? 0,
        visibility: (data.visibility === "private" ? "private" : "public") as CourseVisibility,
        createdAt: (data.createdAt as string | undefined) ?? null,
        enrolledStudents: (data.enrolledStudents as number | undefined) ?? 0,
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/**
 * Keberadaan dan pemilik sebuah kursus.
 *
 * Keduanya dikembalikan terpisah karena kursus bawaan (hasil migrasi) TIDAK
 * punya `ownerUid`. Menyamakan "tanpa pemilik" dengan "tidak ada" membuat
 * pesannya salah — kursusnya ada, hanya bukan milik siapa pun di aplikasi.
 */
export async function courseOwnership(
  slug: string,
): Promise<{ exists: boolean; ownerUid: string | null }> {
  const doc = await adminDb().collection("courses").doc(slug).get();

  return {
    exists: doc.exists,
    ownerUid: (doc.data()?.ownerUid as string | undefined) ?? null,
  };
}

/** `ownerUid` ada di data Firestore tapi sengaja tidak dideklarasikan di CourseDetail — lihat courseActions.ts. */
export type OwnedCourse = CourseDetail & { ownerUid?: string };

export function ownerUidOf(course: CourseDetail): string | undefined {
  return (course as OwnedCourse).ownerUid;
}

/**
 * Kursus untuk disunting — hanya pemilik atau admin.
 *
 * Satu pembacaan (lewat getCourse), bukan dua: courseOwnership() dan
 * getCourse() sama-sama membaca dokumen yang sama, jadi memanggil keduanya
 * di sini akan memboroskan satu baca Firestore untuk tiap kunjungan halaman
 * sunting.
 */
export async function requireOwnedCourse(user: SessionUser, slug: string): Promise<CourseDetail | null> {
  if (user.role !== "admin" && user.role !== "educator") return null;

  const course = await getCourse(slug);
  if (!course) return null;

  // Kursus bawaan (hasil migrasi) tidak punya ownerUid — hanya admin yang
  // boleh menyuntingnya, tidak ada educator yang "memiliki" kursus itu.
  if (user.role !== "admin" && ownerUidOf(course) !== user.uid) return null;

  return course;
}
