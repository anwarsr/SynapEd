"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { canonicalDuration } from "@/lib/duration";
import { purgeCourseReviews } from "@/lib/reviewActions";
import { LEVELS, nextOrder, tintFor, toSlug, uniqueSlug } from "@/lib/educatorCourses";
import { categoryExists } from "@/lib/categories";
import { contributorFields, resolveContributors } from "@/lib/courseContributors";
import { normalizeSections, type SectionInput } from "@/lib/curriculum";
import { resolveThumbnail } from "@/lib/courseThumbnail";
import { attachmentPaths, courseFilePaths, deleteObjects, pruneAttachmentFolders } from "@/lib/storageCleanup";
import { DEFAULT_PASSING_GRADE } from "@/lib/courses";
import type { Section } from "@/lib/courses";

export type CourseResult =
  | {
      ok: true;
      slug: string;
      message: string;
      /**
       * Slug tiap pelajaran hasil normalizeSections, paralel posisinya dengan
       * `sections`/`lessons` yang dikirim di NewCourseInput (lessonSlugs[si][li]).
       * Hanya diisi oleh createCourse — dipakai CourseForm.tsx untuk menyimpan
       * draft soal kuis (saveQuiz) langsung setelah kursus dibuat, tanpa
       * educator harus mampir ke halaman sunting dulu. Kosong/undefined di
       * hasil fungsi lain di berkas ini (mis. deleteCourse) yang tidak relevan.
       */
      lessonSlugs?: string[][];
    }
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
  passingGrade: number;
  /** Path gambar latar di Storage. Kosong berarti memakai latar bawaan. */
  thumbnail: string | null;
  /** Poin "Yang Akan Anda Pelajari", satu baris satu poin. */
  whatYouLearn: string[];
  /** Poin "Persyaratan", satu baris satu poin. */
  requirements: string[];
  /** Kurikulum bebas: berapa pun bagian & pelajarannya, dalam urutan mana pun. */
  sections: SectionInput[];
  /** Kontributor SELAIN pembuat; jatah pembuat dihitung server sebagai sisa. */
  contributors?: { uid: string; share: number }[];
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

/**
 * Nilai minimum kelulusan, dijepit 0..100.
 *
 * Diperiksa di server karena Server Action bisa dipanggil lewat POST
 * langsung: batas 200 membuat sertifikat mustahil terbit, batas negatif
 * membuatnya selalu terbit — dan keduanya tanpa satu pun pesan galat.
 */
function clampGrade(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_PASSING_GRADE;
  return Math.min(100, Math.max(0, n));
}

/**
 * Membersihkan daftar poin bebas (whatYouLearn / requirements).
 *
 * Batas 20 dan pemangkasan spasinya disamakan dengan jalur pengajuan
 * perubahan. Kalau kedua jalur berbeda, kursus yang sama bisa lolos saat
 * dibuat lalu ditolak saat disunting — atau sebaliknya.
 */
function cleanPoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function createCourse(input: NewCourseInput): Promise<CourseResult> {
  const user = await requireEducator();
  if (!user) return { ok: false, error: "Hanya educator yang dapat membuat kursus." };

  const title = clean(input.title, 120);
  const shortDesc = clean(input.shortDesc, 200);
  const longDesc = clean(input.longDesc, 4000) || shortDesc;
  // Bentuknya dibakukan DI SINI, bukan hanya di form.
  //
  // Formnya memang sudah angka + dropdown, tapi Server Action bisa dipanggil
  // lewat POST langsung — persis alasan harga selalu dibaca ulang dari server.
  // Tanpa ini, satu panggilan mentah cukup untuk mengembalikan "Tugas" atau
  // "1 Tahun" ke basis data dan membatalkan konversi yang sudah dijalankan.
  const duration = canonicalDuration(input.duration, "course") || "—";
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

  // Kursus baru lahir tersembunyi, jadi pembagian ini belum bisa menghasilkan
  // uang sampai admin menyetujui penayangannya — dan di sanalah ia ditinjau.
  const contributors = await resolveContributors(user.uid, input.contributors ?? []);
  if (!contributors.ok) return { ok: false, error: contributors.error };

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
      passingGrade: clampGrade(input.passingGrade),
      thumbnail: thumbnail.value,
      enrolledStudents: 0,

      // Kursus baru TIDAK langsung tayang. Educator menyusunnya dengan tenang
      // dalam keadaan tersembunyi, lalu mengajukan tayang saat siap — supaya
      // admin meninjau kursus yang sudah utuh, bukan yang setengah jadi.
      visibility: "private",
      lastUpdated: now,
      instructorName: user.name,
      instructorBio: "",
      whatYouLearn: cleanPoints(input.whatYouLearn),
      requirements: cleanPoints(input.requirements),
      sections: normalized.sections,
      order,

      // Penanda kepemilikan: dipakai untuk menampilkan "Kursus Saya" dan
      // untuk memastikan educator hanya bisa menghapus buatannya sendiri.
      ownerUid: user.uid,
      ownerName: user.name,
      ...contributorFields(contributors.contributors),
      createdAt: now,
    });

  // Berkas yang diunggah selama mengisi form lalu diganti sebelum tombol
  // simpan ditekan tidak pernah tercatat di Firestore, jadi tidak akan
  // ditemukan pembandingan lama-vs-baru mana pun nanti. Folder draft-nya
  // dibandingkan dengan kurikulum yang benar-benar tersimpan, sekarang juga —
  // setelah ini, id draft-nya hilang bersama halaman formnya.
  const keep = attachmentPaths(normalized.sections);
  await pruneAttachmentFolders(keep, keep);

  revalidatePath("/courses");
  revalidatePath("/educator/courses");

  const lessonSlugs = normalized.sections.map((s) => s.lessons.map((l) => l.slug));
  return { ok: true, slug, message: "Kursus berhasil dibuat.", lessonSlugs };
}

/**
 * Menghapus kursus seketika — kini KHUSUS ADMIN.
 *
 * Educator tidak lagi menghapus langsung; ia mengajukan lewat
 * requestCourseDeletion() dan admin yang memutuskan. Fungsi ini tetap ada
 * sebagai jalur admin, sekaligus yang dipanggil saat sebuah pengajuan
 * penghapusan disetujui.
 */
export async function deleteCourse(slug: string): Promise<CourseResult> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return {
      ok: false,
      error: "Penghapusan kursus perlu persetujuan admin. Ajukan dari halaman sunting.",
    };
  }

  const db = adminDb();

  // Dokumennya dibaca utuh, bukan lewat courseOwnership: begitu dokumen ini
  // terhapus, tidak ada lagi cara mengetahui berkas mana yang miliknya. Daftar
  // path harus diambil SEBELUM penghapusan, dan sekalian dipakai untuk
  // memeriksa kepemilikan supaya tetap satu pembacaan.
  const snap = await db.collection("courses").doc(slug).get();
  if (!snap.exists) return { ok: false, error: "Kursus tidak ditemukan." };

  const data = snap.data() ?? {};

  // Tidak ada lagi pemeriksaan kepemilikan di sini.
  //
  // Dulu fungsi ini dipakai educator, jadi ia wajib memastikan yang dihapus
  // memang kursus si pemanggil. Sekarang hanya admin yang sampai ke titik ini,
  // dan admin memang berwenang atas kursus siapa pun — termasuk kursus bawaan
  // yang tidak punya ownerUid sama sekali.
  const files = courseFilePaths({
    sections: data.sections as Section[] | undefined,
    thumbnail: data.thumbnail,
  });
  // recursiveDelete, bukan .delete() biasa: begitu kuis (Fase 5) menambahkan
  // subcollection courses/{slug}/quizzes/*, .delete() biasa hanya menghapus
  // dokumen induknya dan meninggalkan subcollection itu yatim — dokumen tak
  // terjangkau yang tetap ditagih selamanya.
  await db.recursiveDelete(db.collection("courses").doc(slug));

  // Ulasan hidup di koleksi terpisah, jadi recursiveDelete tidak menjangkaunya.
  // Tanpa baris ini ulasannya tetap tampil di beranda sambil menunjuk kursus
  // yang tautannya sudah 404.
  await purgeCourseReviews(slug);

  // Materi dan gambar latarnya ikut dibuang. Firestore dan Storage terpisah:
  // tanpa baris ini, seluruh berkas kursus tetap ada di bucket selamanya,
  // tidak terjangkau dari aplikasi mana pun tapi tetap ditagih.
  //
  // pruneAttachmentFolders menyapu folder-nya sekalian (keep kosong), supaya
  // berkas yang pernah diunggah lalu dilepas dari kurikulum — sehingga tidak
  // ada di `files` — ikut terangkut.
  await deleteObjects(files);
  await pruneAttachmentFolders(files, []);

  revalidatePath("/courses");
  revalidatePath("/educator/courses");

  return { ok: true, slug, message: "Kursus dihapus." };
}
