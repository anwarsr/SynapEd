import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { listCategories } from "@/lib/categories";

// ── Tipe ────────────────────────────────────────────────────────────────

export interface Attachment {
  name: string;
  /** Path di Firebase Storage, mis. "lesson-assets/eeg/modul-1.pdf" */
  path: string;
  size?: number;
  mime?: string;
}

export interface Lesson {
  slug: string;
  title: string;
  type: "video" | "reading" | "quiz" | string;
  duration: string;
  free: boolean;
  position: number;
  /** Tautan YouTube/Vimeo. Kosong berarti materi belum diunggah. */
  videoUrl?: string;
  attachments?: Attachment[];
}

export interface Section {
  title: string;
  position: number;
  lessons: Lesson[];
}

export interface CourseSummary {
  slug: string;
  title: string;
  shortDesc: string;
  level: string;
  levelColor: string;
  category: string;
  icon: string;
  tint: string;
  duration: string;
  rating: number;
  reviews: number;
  lessonsCount: number;
  /** Gambar latar kartu. Kosong berarti memakai latar bawaan (tint + ikon). */
  thumbnail: string | null;
  /**
   * Penyedia kursus — nama yang tampil sebagai pemilik di katalog.
   *
   * Ada di ringkasan, bukan hanya di detail: tanpa ini kartu katalog tidak
   * memberi tahu kursus itu milik siapa, dan pengunjung baru tahu setelah
   * membuka halamannya. Kursus hasil migrasi bisa saja kosong, jadi selalu
   * perlakukan sebagai boleh-kosong.
   */
  instructorName: string;
}

export interface CourseDetail extends CourseSummary {
  longDesc: string;
  price: number;
  enrolledStudents: number;
  lastUpdated: string | null;
  instructorBio: string;
  whatYouLearn: string[];
  requirements: string[];
  sections: Section[];
}

export interface Category {
  slug: string;
  label: string;
}

// ── Internal ────────────────────────────────────────────────────────────

interface CourseDoc extends Omit<CourseDetail, "lessonsCount"> {
  order: number;
}

/**
 * Selalu dihitung dari isi dokumen, tidak pernah disimpan sebagai kolom.
 * Data Laravel dulu menyimpannya terpisah dan sempat melenceng dari isi
 * sebenarnya — dihitung begini, tidak bisa lagi.
 */
function countLessons(sections: Section[]): number {
  return sections.reduce((total, s) => total + s.lessons.length, 0);
}

function sortSections(sections: Section[]): Section[] {
  return [...sections]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ ...s, lessons: [...s.lessons].sort((a, b) => a.position - b.position) }));
}

function toSummary(doc: CourseDoc): CourseSummary {
  return {
    slug: doc.slug,
    title: doc.title,
    shortDesc: doc.shortDesc,
    level: doc.level,
    levelColor: doc.levelColor,
    category: doc.category,
    icon: doc.icon,
    tint: doc.tint,
    duration: doc.duration,
    rating: doc.rating,
    reviews: doc.reviews,
    lessonsCount: countLessons(doc.sections ?? []),
    thumbnail: doc.thumbnail ?? null,
    instructorName: doc.instructorName ?? "",
  };
}

// ── API publik ──────────────────────────────────────────────────────────

/**
 * Diurutkan di memori, bukan lewat `orderBy('order')`.
 *
 * Firestore MENGHILANGKAN dokumen yang tidak punya field yang dipakai
 * `orderBy` — jadi kursus yang ditambahkan manual lewat Console (atau
 * yang `order`-nya belum sempat terisi) diam-diam tak pernah muncul di
 * katalog. Katalognya kecil, jadi mengambil semua lalu mengurutkan di
 * sini lebih aman daripada kehilangan baris tanpa peringatan.
 * Dokumen tanpa `order` ditaruh paling belakang.
 */
export async function listCourses(category?: string): Promise<CourseSummary[]> {
  const collection = adminDb().collection("courses");

  const query =
    category && category !== "semua"
      ? collection.where("category", "==", category)
      : collection;

  const snapshot = await query.get();

  return snapshot.docs
    .map((d) => d.data() as CourseDoc)
    // Dokumen "hantu" (hanya wadah subcollection) tidak punya slug/judul.
    .filter((doc) => doc && doc.slug && doc.title)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map(toSummary);
}

/** Satu pembacaan dokumen — section & lesson tertanam di dalamnya. */
export async function getCourse(slug: string): Promise<CourseDetail | null> {
  const doc = await adminDb().collection("courses").doc(slug).get();
  if (!doc.exists) return null;

  const data = doc.data() as CourseDoc;
  const sections = sortSections(data.sections ?? []);

  return { ...data, sections, lessonsCount: countLessons(sections) };
}

/**
 * Pilihan filter di katalog.
 *
 * Dulu diturunkan dari kategori yang kebetulan dipakai kursus, dengan label
 * hardcoded. Sekarang dibaca dari koleksi `categories` yang dikelola admin —
 * kategori yang baru dibuat langsung muncul sebagai pilihan, bahkan sebelum
 * ada kursus di dalamnya.
 */
export async function listCourseCategories(): Promise<Category[]> {
  const categories = await listCategories();

  return [
    { slug: "semua", label: "Semua Materi" },
    ...categories.map((c) => ({ slug: c.slug, label: c.label })),
  ];
}

/** Meratakan kurikulum untuk navigasi halaman belajar. */
export function flattenLessons(course: CourseDetail): Lesson[] {
  return course.sections.flatMap((s) => s.lessons);
}
