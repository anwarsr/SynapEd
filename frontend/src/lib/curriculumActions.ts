"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { LEVELS, ownerUidOf, requireOwnedCourse } from "@/lib/educatorCourses";
import { categoryExists } from "@/lib/categories";
import { resolveThumbnail } from "@/lib/courseThumbnail";
import { normalizeSections, type SectionInput } from "@/lib/curriculum";
import { attachmentPaths, deleteObjects, pruneAttachmentFolders } from "@/lib/storageCleanup";
import { COURSE_THUMBNAILS } from "@/lib/storagePaths";

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

  // Daftar lampiran LAMA diambil sebelum ditimpa. Penyimpanan kurikulum
  // mengganti `sections` seluruhnya, jadi setiap berkas yang tadi dirujuk dan
  // sekarang tidak lagi — materi yang diganti, pelajaran yang dihapus — mulai
  // detik ini tidak terjangkau siapa pun.
  const before = attachmentPaths(course.sections);

  await adminDb().collection("courses").doc(slug).update({ sections: normalized.sections });

  const keep = attachmentPaths(normalized.sections);
  const keepSet = new Set(keep);

  await deleteObjects(before.filter((path) => !keepSet.has(path)));

  // Menyapu foldernya sekalian menangkap berkas yang diunggah lalu dibatalkan
  // di tengah penyuntingan: berkas itu tidak pernah masuk `before` maupun
  // `keep`, sehingga pembandingan di atas tidak akan pernah melihatnya.
  await pruneAttachmentFolders([...before, ...keep], keep);

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
  duration: string;
  price: number;
  /**
   * Diisi HANYA kalau gambar latarnya diubah:
   *   undefined -> biarkan seperti apa adanya
   *   null      -> hapus gambarnya
   *   string    -> path baru di Storage
   */
  thumbnail?: string | null;
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

  const category = input.category.trim().slice(0, 60);
  if (!(await categoryExists(category))) return { ok: false, error: "Kategori tidak valid." };

  // Harga bisa nol (kursus gratis) tapi tidak boleh negatif atau bukan angka.
  const price = Number.isFinite(input.price) && input.price >= 0 ? Math.round(input.price) : 0;

  const whatYouLearn = input.whatYouLearn.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const requirements = input.requirements.map((s) => s.trim()).filter(Boolean).slice(0, 20);

  const patch: Record<string, unknown> = {
    title,
    shortDesc,
    longDesc,
    level: level.value,
    levelColor: level.color,
    category,
    duration: input.duration.trim().slice(0, 40) || "—",
    price,
    whatYouLearn,
    requirements,
  };

  // `thumbnail` hanya ikut ditulis kalau memang diubah.
  //
  // Kursus hasil migrasi menyimpan URL penuh atau path di folder public/,
  // yang tidak akan lolos resolveThumbnail. Kalau field ini selalu dikirim
  // ulang, menyimpan perubahan judul saja akan gagal pada kursus-kursus itu —
  // atau lebih buruk, diam-diam menghapus gambarnya.
  if (input.thumbnail !== undefined) {
    const thumbnail = resolveThumbnail(input.thumbnail, user.uid);
    if (!thumbnail.ok) return { ok: false, error: thumbnail.error };
    patch.thumbnail = thumbnail.value;
  }

  await adminDb().collection("courses").doc(slug).update(patch);

  // Gambar latar yang tergantikan dibuang. Nama berkasnya mengandung cap waktu
  // supaya peramban tidak menampilkan gambar lama dari cache, jadi setiap
  // penggantian SELALU membuat berkas baru dan meninggalkan yang lama.
  //
  // Hanya path lama yang benar-benar tercatat yang dihapus, bukan berdasarkan
  // awalan nama: gambar tersimpan datar sebagai `{slug}-{waktu}-{nama}`,
  // sehingga menyapu awalan `tess-` akan ikut memakan gambar milik `tess-2`.
  if (patch.thumbnail !== undefined) {
    const previous = course.thumbnail;
    if (
      typeof previous === "string" &&
      previous.startsWith(`${COURSE_THUMBNAILS}/`) &&
      previous !== patch.thumbnail
    ) {
      await deleteObjects([previous]);
    }
  }

  revalidatePath(`/courses/${slug}`);
  revalidatePath("/educator/courses");

  return { ok: true, message: "Info kursus tersimpan." };
}
