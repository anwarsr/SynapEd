"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import {
  CATEGORIES,
  COURSE_ASSETS,
  ICONS,
  LEVELS,
  courseOwnership,
  nextOrder,
  tintFor,
  toSlug,
  uniqueSlug,
} from "@/lib/educatorCourses";
import { toEmbedUrl } from "@/lib/videoEmbed";
import type { Section } from "@/lib/courses";

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

  if (title.length < 4) return { ok: false, error: "Judul kursus minimal 4 karakter." };
  if (shortDesc.length < 10) return { ok: false, error: "Deskripsi singkat minimal 10 karakter." };

  const level = LEVELS.find((l) => l.value === input.level);
  if (!level) return { ok: false, error: "Tingkat kesulitan tidak valid." };

  const category = CATEGORIES.find((c) => c.value === input.category);
  if (!category) return { ok: false, error: "Kategori tidak valid." };

  const icon = ICONS.includes(input.icon as (typeof ICONS)[number]) ? input.icon : "reading";

  // Tautan divalidasi lewat pengubah embed yang sama dengan yang dipakai
  // halaman belajar — kalau ia tidak mengenali tautannya, videonya juga tidak
  // akan tampil di sana.
  const embed = toEmbedUrl(clean(input.videoUrl, 300));
  if (!embed) {
    return { ok: false, error: "Tautan video tidak dikenali. Gunakan tautan YouTube." };
  }

  for (const [label, doc] of [
    ["Modul materi", input.modul],
    ["Penugasan akhir", input.tugas],
  ] as const) {
    if (!doc?.path || !doc.name) return { ok: false, error: `${label} belum diunggah.` };
    if (!ownsPath(doc.path, user.uid)) {
      return { ok: false, error: `Berkas ${label.toLowerCase()} tidak sah.` };
    }
  }

  const slug = await uniqueSlug(toSlug(title) || "kursus");
  const order = await nextOrder();
  const now = new Date().toISOString();

  // Satu section berisi tiga pelajaran — bentuknya sama persis dengan kursus
  // lama, jadi katalog dan halaman belajar bekerja tanpa perlakuan khusus.
  const sections: Section[] = [
    {
      title: "Materi Kursus",
      position: 1,
      lessons: [
        {
          slug: "modul-materi",
          title: "Modul Materi",
          type: "reading",
          duration: "Bacaan",
          free: true,
          position: 1,
          attachments: [input.modul],
        },
        {
          slug: "video",
          title: "Video Pembelajaran",
          type: "video",
          duration: "Video",
          free: true,
          position: 2,
          videoUrl: input.videoUrl.trim(),
        },
        {
          slug: "penugasan-akhir",
          title: "Penugasan Akhir",
          type: "quiz",
          duration: "Tugas",
          free: true,
          position: 3,
          attachments: [input.tugas],
        },
      ],
    },
  ];

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
      price: 0,
      thumbnail: null,
      enrolledStudents: 0,
      lastUpdated: now,
      instructorName: user.name,
      instructorBio: "",
      whatYouLearn: [],
      requirements: [],
      sections,
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

  await adminDb().collection("courses").doc(slug).delete();

  revalidatePath("/courses");
  revalidatePath("/educator/courses");

  return { ok: true, slug, message: "Kursus dihapus." };
}
