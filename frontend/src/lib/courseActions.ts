"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { CATEGORIES, COURSE_ASSETS, ICONS, LEVELS, courseOwnership, nextOrder, tintFor, toSlug, uniqueSlug } from "@/lib/educatorCourses";
import { normalizeSections, type SectionInput } from "@/lib/curriculum";

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
  icon: string;
  duration: string;
  price: number;
  videoUrl: string;
  modul: UploadedDoc;
  tugas: UploadedDoc;
}

/**
 * Server Action bisa dipanggil lewat POST langsung, bukan hanya lewat form.
 * Jadi role diperiksa di sini, bukan mengandalkan halaman pemanggilnya.
 */
async function requireEducator() {
  const user = await getCurrentUser();
  return user?.role === "educator" ? user : null;
}

/**
 * Berkas diunggah dari browser, jadi path-nya datang dari klien dan TIDAK
 * boleh dipercaya. Tanpa pemeriksaan ini, seorang educator bisa menunjuk
 * berkas milik akun lain lalu menerbitkannya sebagai miliknya.
 */
function ownsPath(path: string, uid: string): boolean {
  return path.startsWith(`${COURSE_ASSETS}/${uid}/`);
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

  const category = CATEGORIES.find((c) => c.value === input.category);
  if (!category) return { ok: false, error: "Kategori tidak valid." };

  const icon = ICONS.includes(input.icon as (typeof ICONS)[number]) ? input.icon : "reading";

  for (const [label, doc] of [
    ["Modul materi", input.modul],
    ["Penugasan akhir", input.tugas],
  ] as const) {
    if (!doc?.path || !doc.name) return { ok: false, error: `${label} belum diunggah.` };
    if (!ownsPath(doc.path, user.uid)) {
      return { ok: false, error: `Berkas ${label.toLowerCase()} tidak sah.` };
    }
  }

  // Bentuk awalnya cuma template starter — satu section, tiga pelajaran —
  // tapi divalidasi lewat validator YANG SAMA dengan editor kurikulum
  // (normalizeSections), supaya tidak ada dua aturan yang bisa melenceng.
  // Tautan video ikut divalidasi di sana lewat toEmbedUrl().
  const draft: SectionInput[] = [
    {
      title: "Materi Kursus",
      lessons: [
        {
          title: "Modul Materi",
          type: "reading",
          duration: "Bacaan",
          free: true,
          attachments: [input.modul],
        },
        {
          title: "Video Pembelajaran",
          type: "video",
          duration: "Video",
          free: true,
          videoUrl: input.videoUrl,
        },
        {
          title: "Penugasan Akhir",
          type: "quiz",
          duration: "Tugas",
          free: true,
          attachments: [input.tugas],
        },
      ],
    },
  ];

  const normalized = normalizeSections(draft, [user.uid]);
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
      category: category.value,
      icon,
      tint: tintFor(icon),
      duration,
      rating: 0,
      reviews: 0,
      price,
      thumbnail: null,
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
