import "server-only";
import { adminDb } from "@/lib/firebase/admin";

export const CATEGORIES_COLLECTION = "categories";

export interface CourseCategory {
  /** Document ID sekaligus nilai yang tersimpan di `courses.category`. */
  slug: string;
  label: string;
  order: number;
  createdAt: string | null;
}

/**
 * Kategori kursus — dulu konstanta di dalam kode, sekarang dikelola admin.
 *
 * Disimpan sebagai koleksi tersendiri, bukan diturunkan dari kursus yang ada,
 * supaya admin bisa menyiapkan kategori SEBELUM ada kursusnya. Kalau
 * diturunkan, kategori baru mustahil dipilih educator karena belum ada satu
 * pun kursus yang memakainya.
 */
export async function listCategories(): Promise<CourseCategory[]> {
  const snap = await adminDb().collection(CATEGORIES_COLLECTION).get();

  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        slug: d.id,
        label: (data.label as string | undefined) ?? d.id,
        order: (data.order as number | undefined) ?? 0,
        createdAt: (data.createdAt as string | undefined) ?? null,
      };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export async function categoryExists(slug: string): Promise<boolean> {
  return (await adminDb().collection(CATEGORIES_COLLECTION).doc(slug).get()).exists;
}

/** Berapa kursus yang memakai sebuah kategori — penjaga sebelum menghapus. */
export async function countCoursesInCategory(slug: string): Promise<number> {
  const snap = await adminDb()
    .collection("courses")
    .where("category", "==", slug)
    .count()
    .get();
  return snap.data().count;
}
