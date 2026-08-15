"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { CATEGORIES_COLLECTION, categoryExists, countCoursesInCategory } from "@/lib/categories";
import { toSlug } from "@/lib/educatorCourses";

export type CategoryResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Server Action bisa dipanggil lewat POST langsung, jadi role diperiksa di
 * sini — bukan mengandalkan halaman admin yang memanggilnya.
 */
async function requireAdminUser() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

function refresh() {
  revalidatePath("/admin/categories");
  revalidatePath("/courses");
  revalidatePath("/");
}

export async function createCategory(label: string): Promise<CategoryResult> {
  if (!(await requireAdminUser())) {
    return { ok: false, error: "Hanya admin yang dapat mengelola kategori." };
  }

  const name = typeof label === "string" ? label.trim().slice(0, 60) : "";
  if (name.length < 3) return { ok: false, error: "Nama kategori minimal 3 karakter." };

  const slug = toSlug(name);
  if (!slug) return { ok: false, error: "Nama kategori harus memuat huruf atau angka." };

  if (await categoryExists(slug)) {
    return { ok: false, error: `Kategori "${name}" sudah ada.` };
  }

  // Kategori baru ditaruh di urutan terakhir; angkanya cukup dari jumlah yang
  // ada, karena urutan hanya menentukan tampilan daftar filter.
  const existing = await adminDb().collection(CATEGORIES_COLLECTION).count().get();

  await adminDb()
    .collection(CATEGORIES_COLLECTION)
    .doc(slug)
    .set({ label: name, order: existing.data().count, createdAt: new Date().toISOString() });

  refresh();
  return { ok: true, message: `Kategori "${name}" ditambahkan.` };
}

/**
 * Menghapus kategori — ditolak selama masih ada kursus yang memakainya.
 *
 * Tanpa penjaga ini, kursusnya tetap menyimpan slug kategori yang sudah tidak
 * ada: filter katalog tidak lagi memunculkannya, dan educator tidak bisa
 * menyimpan suntingan apa pun karena kategorinya dianggap tidak valid.
 */
export async function deleteCategory(slug: string): Promise<CategoryResult> {
  if (!(await requireAdminUser())) {
    return { ok: false, error: "Hanya admin yang dapat mengelola kategori." };
  }

  if (!(await categoryExists(slug))) {
    return { ok: false, error: "Kategori tidak ditemukan." };
  }

  const used = await countCoursesInCategory(slug);
  if (used > 0) {
    return {
      ok: false,
      error: `Masih dipakai ${used} kursus. Pindahkan kursus itu ke kategori lain dulu.`,
    };
  }

  await adminDb().collection(CATEGORIES_COLLECTION).doc(slug).delete();

  refresh();
  return { ok: true, message: "Kategori dihapus." };
}

/** Mengganti nama tampilan tanpa mengubah slug — kursus lama tetap tertaut. */
export async function renameCategory(slug: string, label: string): Promise<CategoryResult> {
  if (!(await requireAdminUser())) {
    return { ok: false, error: "Hanya admin yang dapat mengelola kategori." };
  }

  const name = typeof label === "string" ? label.trim().slice(0, 60) : "";
  if (name.length < 3) return { ok: false, error: "Nama kategori minimal 3 karakter." };

  if (!(await categoryExists(slug))) {
    return { ok: false, error: "Kategori tidak ditemukan." };
  }

  // Slug sengaja TIDAK ikut berubah: ia tersimpan di setiap dokumen kursus,
  // jadi mengubahnya berarti memutus tautan seluruh kursus di kategori itu.
  await adminDb().collection(CATEGORIES_COLLECTION).doc(slug).update({ label: name });

  refresh();
  return { ok: true, message: "Nama kategori diperbarui." };
}
