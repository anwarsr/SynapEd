"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { CATEGORIES, ICONS, LEVELS, ownerUidOf, requireOwnedCourse, tintFor } from "@/lib/educatorCourses";
import { normalizeSections, type SectionInput } from "@/lib/curriculum";

export type CurriculumResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Menyimpan kurikulum — penggantian penuh, bukan patch per pelajaran.
 *
 * Server Action bisa dipanggil lewat POST langsung, jadi kepemilikan
 * diperiksa ulang di sini lewat requireOwnedCourse — bukan mengandalkan
 * halaman sunting yang memanggilnya.
 */
export async function saveCurriculum(slug: string, input: SectionInput[]): Promise<CurriculumResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await requireOwnedCourse(user, slug);
  if (!course) return { ok: false, error: "Anda tidak berhak menyunting kursus ini." };

  // Lampiran yang sudah ada boleh berasal dari folder pemilik ASLI kursus
  // (educator yang membuatnya); lampiran baru yang baru saja diunggah lewat
  // browser berasal dari folder PENYUNTING (bisa admin yang berbeda orang).
  // storage.rules hanya mengizinkan educator menulis ke foldernya sendiri,
  // jadi kedua uid ini memang bisa berbeda dan keduanya sah.
  const ownerUids = [user.uid, ownerUidOf(course)].filter((v): v is string => Boolean(v));

  const normalized = normalizeSections(input, ownerUids);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  await adminDb().collection("courses").doc(slug).update({ sections: normalized.sections });

  revalidatePath(`/courses/${slug}`);
  revalidatePath(`/courses/${slug}/learn`);
  revalidatePath("/educator/courses");

  return { ok: true, message: "Kurikulum tersimpan." };
}

export interface CourseMetaInput {
  title: string;
  shortDesc: string;
  longDesc: string;
  level: string;
  category: string;
  icon: string;
  duration: string;
  price: number;
  whatYouLearn: string[];
  requirements: string[];
}

/** Menyunting judul, deskripsi, harga, dan metadata lain — bukan kurikulum. */
export async function updateCourseMeta(slug: string, input: CourseMetaInput): Promise<CurriculumResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const course = await requireOwnedCourse(user, slug);
  if (!course) return { ok: false, error: "Anda tidak berhak menyunting kursus ini." };

  const title = input.title.trim().slice(0, 120);
  const shortDesc = input.shortDesc.trim().slice(0, 200);
  const longDesc = input.longDesc.trim().slice(0, 4000) || shortDesc;

  if (title.length < 4) return { ok: false, error: "Judul kursus minimal 4 karakter." };
  if (shortDesc.length < 10) return { ok: false, error: "Deskripsi singkat minimal 10 karakter." };

  const level = LEVELS.find((l) => l.value === input.level);
  if (!level) return { ok: false, error: "Tingkat kesulitan tidak valid." };

  const category = CATEGORIES.find((c) => c.value === input.category);
  if (!category) return { ok: false, error: "Kategori tidak valid." };

  const icon = ICONS.includes(input.icon as (typeof ICONS)[number]) ? input.icon : "reading";

  // Harga bisa nol (kursus gratis) tapi tidak boleh negatif atau bukan angka.
  const price = Number.isFinite(input.price) && input.price >= 0 ? Math.round(input.price) : 0;

  const whatYouLearn = input.whatYouLearn.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const requirements = input.requirements.map((s) => s.trim()).filter(Boolean).slice(0, 20);

  await adminDb()
    .collection("courses")
    .doc(slug)
    .update({
      title,
      shortDesc,
      longDesc,
      level: level.value,
      levelColor: level.color,
      category: category.value,
      icon,
      tint: tintFor(icon),
      duration: input.duration.trim().slice(0, 40) || "—",
      price,
      whatYouLearn,
      requirements,
    });

  revalidatePath(`/courses/${slug}`);
  revalidatePath("/educator/courses");

  return { ok: true, message: "Info kursus tersimpan." };
}
