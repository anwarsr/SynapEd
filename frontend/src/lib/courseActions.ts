"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { LEVELS, courseOwnership, nextOrder, tintFor, toSlug, uniqueSlug } from "@/lib/educatorCourses";
import { categoryExists } from "@/lib/categories";
import { normalizeSections, type SectionInput } from "@/lib/curriculum";
import { resolveThumbnail } from "@/lib/courseThumbnail";

export type CourseResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; error: string };

export interface UploadedDoc {
  name: string;
  path: string;
  size: number;
  mime: string;
}

export interface NewCourseInput {
  title: string;
  shortDesc: string;
  longDesc: string;
  level: string;
  category: string;
  duration: string;
  price: number;
  /** Path gambar latar di Storage. Kosong berarti memakai latar bawaan. */
  thumbnail: string | null;
  /** Kurikulum bebas: berapa pun bagian & pelajarannya, dalam urutan mana pun. */
  sections: SectionInput[];
}


/**
 * Server Action bisa dipanggil lewat POST langsung, bukan hanya lewat form.
 * Jadi role diperiksa di sini, bukan mengandalkan halaman pemanggilnya.
 */
async function requireEducator() {
  const user = await getCurrentUser();
  return user?.role === "educator" ? user : null;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function createCourse(input: NewCourseInput): Promise<CourseResult> {
  const user = await requireEducator();
  if (!user) return { ok: false, error: "Hanya educator yang dapat membuat kursus." };

  const title = clean(input.title, 120);
  const shortDesc = clean(input.shortDesc, 200);
  const longDesc = clean(input.longDesc, 4000) || shortDesc;
  const duration = clean(input.duration, 40) || "—";
  const price = Number.isFinite(input.price) && input.price >= 0 ? Math.round(input.price) : 0;

  if (title.length < 4) return { ok: false, error: "Judul kursus minimal 4 karakter." };
  if (shortDesc.length < 10) return { ok: false, error: "Deskripsi singkat minimal 10 karakter." };

  const level = LEVELS.find((l) => l.value === input.level);
  if (!level) return { ok: false, error: "Tingkat kesulitan tidak valid." };

  const category = clean(input.category, 60);
  if (!(await categoryExists(category))) return { ok: false, error: "Kategori tidak valid." };

  const thumbnail = resolveThumbnail(input.thumbnail, user.uid);
  if (!thumbnail.ok) return { ok: false, error: thumbnail.error };

  // Kurikulum datang apa adanya dari form dan divalidasi lewat validator YANG
  // SAMA dengan editor sunting (normalizeSections), supaya tidak ada dua aturan
  // yang bisa melenceng. Di sanalah tautan video diperiksa lewat toEmbedUrl()
  // dan path setiap lampiran dipastikan berada di folder milik pengunggahnya —
  // path datang dari browser, jadi tidak boleh dipercaya begitu saja.
  const normalized = normalizeSections(input.sections ?? [], [user.uid]);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const slug = await uniqueSlug(toSlug(title) || "kursus");
  const order = await nextOrder();
  const now = new Date().toISOString();

  await adminDb()
    .collection("courses")
    .doc(slug)
    .set({
      slug,
      title,
      shortDesc,
      longDesc,
      level: level.value,
      levelColor: level.color,
      category,

      // icon & tint tidak lagi dipilih educator — keduanya hanya dipakai
      // sebagai latar cadangan saat kursus belum punya gambar, dan kursus
      // hasil migrasi masih memakainya.
      icon: "reading",
      tint: tintFor("reading"),

      duration,
      rating: 0,
      reviews: 0,
      price,
      thumbnail: thumbnail.value,
      enrolledStudents: 0,
      lastUpdated: now,
      instructorName: user.name,
      instructorBio: "",
      whatYouLearn: [],
      requirements: [],
      sections: normalized.sections,
      order,

      // Penanda kepemilikan: dipakai untuk menampilkan "Kursus Saya" dan
      // untuk memastikan educator hanya bisa menghapus buatannya sendiri.
      ownerUid: user.uid,
      ownerName: user.name,
      createdAt: now,
    });

  revalidatePath("/courses");
  revalidatePath("/educator/courses");

  return { ok: true, slug, message: "Kursus berhasil dibuat." };
}

/** Menghapus kursus — hanya buatan sendiri. */
export async function deleteCourse(slug: string): Promise<CourseResult> {
  const user = await requireEducator();
  if (!user) return { ok: false, error: "Hanya educator yang dapat menghapus kursus." };

  const { exists, ownerUid } = await courseOwnership(slug);
  if (!exists) return { ok: false, error: "Kursus tidak ditemukan." };

  // Kursus bawaan tidak punya ownerUid — itu berarti bukan milik educator
  // mana pun, jadi tidak seorang pun boleh menghapusnya dari sini.
  if (ownerUid !== user.uid) return { ok: false, error: "Ini bukan kursus Anda." };

  const db = adminDb();
  // recursiveDelete, bukan .delete() biasa: begitu kuis (Fase 5) menambahkan
  // subcollection courses/{slug}/quizzes/*, .delete() biasa hanya menghapus
  // dokumen induknya dan meninggalkan subcollection itu yatim — dokumen tak
  // terjangkau yang tetap ditagih selamanya.
  await db.recursiveDelete(db.collection("courses").doc(slug));

  revalidatePath("/courses");
  revalidatePath("/educator/courses");

  return { ok: true, slug, message: "Kursus dihapus." };
}
