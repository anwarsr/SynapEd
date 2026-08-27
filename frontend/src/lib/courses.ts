import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getUserCards } from "@/lib/userCards";
import { listCategories } from "@/lib/categories";

/** Sengaja di sini, bukan diimpor dari submissions.ts: modul itu mengimpor
 *  courses.ts, dan saling-impor membuat salah satunya undefined saat dimuat. */
export const DEFAULT_PASSING_GRADE = 70;

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
  type: "video" | "reading" | "assignment" | "quiz" | string;
  duration: string;
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
  /**
   * Pemilik kursus — dipakai menautkan namanya ke halaman profilnya.
   *
   * Kursus hasil migrasi TIDAK punya ini, jadi selalu boleh-kosong. Yang
   * kosong tetap menampilkan nama penyedia, hanya tidak bisa diklik: lebih
   * baik daripada tautan yang berakhir di 404.
   */
  ownerUid: string | null;
  /**
   * Foto penyedia kursus, dibaca dari Firebase Auth saat halaman dirender.
   *
   * TIDAK disalin ke dokumen kursus seperti `instructorName`: foto lebih
   * sering berganti daripada nama, dan foto basi lebih terasa salah karena
   * wajah yang tampil di katalog bukan lagi wajah yang dipilih orangnya.
   */
  instructorPhoto: string | null;
  /**
   * Harga dalam rupiah penuh; 0 berarti gratis.
   *
   * Ada di ringkasan, bukan hanya di detail, karena kartu katalog perlu
   * menampilkannya. Tanpa itu pengunjung baru tahu harga setelah membuka
   * kursusnya satu per satu — padahal justru itu yang dibandingkan saat
   * memilih.
   */
  price: number;
  /**
   * Terlihat publik atau disembunyikan sementara.
   *
   * Kursus hasil migrasi dan yang dibuat sebelum fitur ini TIDAK punya field
   * ini. Ketiadaannya dibaca sebagai "public" — kalau dibaca sebaliknya,
   * seluruh katalog akan lenyap begitu kode ini terpasang.
   */
  visibility: CourseVisibility;
}

export type CourseVisibility = "public" | "private";

export interface CourseDetail extends CourseSummary {
  longDesc: string;
  /**
   * Nilai minimum kelulusan penugasan & kuis, 0..100.
   *
   * Kursus yang dibuat sebelum penilaian ada tidak punya field ini.
   * Ketiadaannya dibaca sebagai 70 oleh passingGradeOf(), bukan 0 — nol
   * berarti apa pun lulus, dan itu diam-diam mencabut syaratnya.
   */
  passingGrade: number;
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
    ownerUid: (doc as { ownerUid?: string }).ownerUid ?? null,
    // Diisi belakangan oleh withInstructorPhotos — satu panggilan Auth untuk
    // seluruh halaman, bukan satu per kartu.
    instructorPhoto: null,
    price: doc.price ?? 0,
    visibility: doc.visibility === "private" ? "private" : "public",
  };
}

/**
 * Melengkapi daftar kursus dengan foto penyedianya.
 *
 * Dipanggil di lapisan data, bukan di tiap halaman: katalog, beranda, dan
 * halaman detail semuanya butuh foto yang sama, dan menyerahkannya ke masing-
 * masing pemanggil berarti cepat atau lambat ada satu yang lupa — kartunya
 * lalu tampil berinisial sementara yang lain berfoto.
 */
async function withInstructorPhotos<T extends CourseSummary>(rows: T[]): Promise<T[]> {
  const uids = rows.map((r) => r.ownerUid).filter((u): u is string => Boolean(u));
  if (uids.length === 0) return rows;

  const instructors = await getUserCards(uids);

  return rows.map((r) => {
    const found = r.ownerUid ? instructors.get(r.ownerUid) : undefined;
    return found ? { ...r, instructorPhoto: found.photoURL } : r;
  });
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

  const rows = snapshot.docs
    .map((d) => d.data() as CourseDoc)
    // Dokumen "hantu" (hanya wadah subcollection) tidak punya slug/judul.
    .filter((doc) => doc && doc.slug && doc.title)
    // Kursus yang disembunyikan tidak pernah masuk katalog publik.
    // Disaring di sini, bukan lewat where(): dokumen tanpa field `visibility`
    // (seluruh kursus lama) akan DIABAIKAN Firestore pada kueri kesamaan,
    // sehingga katalognya ikut kosong tanpa satu pun pesan galat.
    .filter((doc) => doc.visibility !== "private")
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map(toSummary);

  return withInstructorPhotos(rows);
}

/** Satu pembacaan dokumen — section & lesson tertanam di dalamnya. */
export async function getCourse(slug: string): Promise<CourseDetail | null> {
  const doc = await adminDb().collection("courses").doc(slug).get();
  if (!doc.exists) return null;

  const data = doc.data() as CourseDoc;
  const sections = sortSections(data.sections ?? []);

  const ownerUid = (data as { ownerUid?: string }).ownerUid ?? null;

  // Satu kursus, jadi satu uid — tapi lewat helper yang sama agar aturan
  // "foto dibaca dari Auth, bukan dari dokumen" hanya ditulis di satu tempat.
  const instructors = ownerUid ? await getUserCards([ownerUid]) : null;

  return {
    ...data,
    sections,
    lessonsCount: countLessons(sections),
    ownerUid,
    passingGrade:
      typeof data.passingGrade === "number" ? data.passingGrade : DEFAULT_PASSING_GRADE,
    instructorPhoto: (ownerUid && instructors?.get(ownerUid)?.photoURL) || null,

    // WAJIB dinormalkan di sini, bukan hanya di toSummary.
    //
    // Cast `as CourseDoc` di atas membuat TypeScript percaya `visibility`
    // selalu ada, padahal seluruh kursus yang dibuat sebelum fitur ini tidak
    // punya field itu sama sekali. Nilai `undefined` lalu lolos ke UI dan
    // jatuh ke cabang `else` di setiap perbandingan — sehingga satu halaman
    // bisa menulis "Tersembunyi" dan "muncul di katalog" sekaligus.
    //
    // Ketiadaan field dibaca sebagai "public": itu keadaan kursus-kursus lama
    // sebelum visibility ada, dan membacanya terbalik akan menyembunyikan
    // seluruh katalog.
    visibility: data.visibility === "private" ? "private" : "public",
  };
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
