import "server-only";
import { adminDb } from "@/lib/firebase/admin";

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
}

export interface CourseDetail extends CourseSummary {
  longDesc: string;
  price: number;
  thumbnail: string | null;
  enrolledStudents: number;
  lastUpdated: string | null;
  instructorName: string;
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
  };
}

// Label ini dulu hardcoded di CourseController Laravel.
const CATEGORY_LABELS: Record<string, string> = {
  neuroscience: "Neuroscience",
  eeg: "Teknologi EEG",
  analisis: "Analisis Data",
};

// ── API publik ──────────────────────────────────────────────────────────

export async function listCourses(category?: string): Promise<CourseSummary[]> {
  const collection = adminDb().collection("courses");

  const query =
    category && category !== "semua"
      ? collection.where("category", "==", category).orderBy("order")
      : collection.orderBy("order");

  const snapshot = await query.get();
  return snapshot.docs.map((d) => toSummary(d.data() as CourseDoc));
}

/** Satu pembacaan dokumen — section & lesson tertanam di dalamnya. */
export async function getCourse(slug: string): Promise<CourseDetail | null> {
  const doc = await adminDb().collection("courses").doc(slug).get();
  if (!doc.exists) return null;

  const data = doc.data() as CourseDoc;
  const sections = sortSections(data.sections ?? []);

  return { ...data, sections, lessonsCount: countLessons(sections) };
}

export async function listCategories(): Promise<Category[]> {
  const snapshot = await adminDb().collection("courses").orderBy("order").get();

  const seen: string[] = [];
  for (const d of snapshot.docs) {
    const { category } = d.data() as CourseDoc;
    if (category && !seen.includes(category)) seen.push(category);
  }

  return [
    { slug: "semua", label: "Semua Materi" },
    ...seen.map((slug) => ({ slug, label: CATEGORY_LABELS[slug] ?? slug })),
  ];
}

/** Meratakan kurikulum untuk navigasi halaman belajar. */
export function flattenLessons(course: CourseDetail): Lesson[] {
  return course.sections.flatMap((s) => s.lessons);
}
