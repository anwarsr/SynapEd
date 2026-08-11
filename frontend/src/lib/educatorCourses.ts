import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { CourseSummary, Section } from "@/lib/courses";

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
 * Kategori dibatasi ke yang sudah ada, bukan kolom bebas.
 *
 * Katalog menyaring dengan `where('category') + orderBy('order')`, dan tiap
 * kategori baru berarti kombinasi indeks baru. Membatasinya juga menjaga
 * daftar filter tetap terbaca alih-alih terpecah oleh salah ketik.
 */
export const CATEGORIES = [
  { value: "neuroscience", label: "Neuroscience" },
  { value: "eeg", label: "Teknologi EEG" },
  { value: "analisis", label: "Analisis Data" },
] as const;

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
        createdAt: (data.createdAt as string | undefined) ?? null,
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
