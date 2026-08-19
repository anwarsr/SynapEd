/**
 * Memindahkan katalog kursus ke Firestore.
 *
 * Sumbernya scripts/data/lms-data.json — hasil ekstraksi langsung dari
 * LmsData.php Laravel. Sengaja BUKAN dari data frontend, karena konversi
 * frontend terdahulu diam-diam kehilangan 14 lesson dan 6 section.
 *
 * Section & lesson DITANAM di dalam dokumen kursus. Dokumen terbesar hanya
 * ~3,3 KB (0,31% dari batas 1 MiB Firestore), jadi tidak perlu subcollection —
 * yang berarti tidak ada masalah cascade delete dan membaca satu kursus
 * cukup satu operasi.
 *
 * Jalankan terhadap emulator:
 *   set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *   npx tsx scripts/migrate-to-firestore.ts
 *
 * Jalankan terhadap proyek asli:
 *   set FIREBASE_SERVICE_ACCOUNT=<isi JSON service account>
 *   npx tsx scripts/migrate-to-firestore.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initAdmin, targetLabel } from "./project";
import { getFirestore } from "firebase-admin/firestore";

// Angka acuan dari sumber Laravel. Kalau meleset, migrasi HARUS gagal.
const EXPECTED = { courses: 4, sections: 19, lessons: 52 };

interface RawLesson {
  slug: string;
  title: string;
  type: string;
  duration: string;
}
interface RawSection {
  title: string;
  lessons: RawLesson[];
}
interface RawCourse {
  slug: string;
  title: string;
  short_desc: string;
  long_desc: string;
  level: string;
  level_color: string;
  category: string;
  icon: string;
  duration: string;
  rating: number;
  reviews: number;
  instructor: string;
  instructor_bio: string;
  what_you_learn: string[];
  requirements: string[];
  sections: RawSection[];
}

/** Metadata yang hanya ada di LmsData::decorateCourse(), plus tint desain. */
const meta: Record<
  string,
  { price: number; thumbnail: string; lastUpdated: string; enrolledStudents: number; tint: string }
> = {
  "dasar-neuroscience": {
    price: 500_000,
    thumbnail: "https://rsa.ugm.ac.id/wp-content/uploads/sites/60/eeg_40_channel_rsa_ugm_2.jpg",
    lastUpdated: "12 Mei 2026",
    enrolledStudents: 1840,
    tint: "bg-blue-50",
  },
  "pengenalan-eeg": {
    price: 450_000,
    thumbnail: "images/course-thumbnails/pengenalan-eeg.svg",
    lastUpdated: "08 Mei 2026",
    enrolledStudents: 1320,
    tint: "bg-paper-alt",
  },
  "implementasi-eeg-muse": {
    price: 650_000,
    thumbnail: "images/course-thumbnails/implementasi-eeg-muse.svg",
    lastUpdated: "10 Mei 2026",
    enrolledStudents: 860,
    tint: "bg-amber-100",
  },
  "analisis-data-eeg": {
    price: 800_000,
    thumbnail: "images/course-thumbnails/analisis-data-eeg.svg",
    lastUpdated: "14 Mei 2026",
    enrolledStudents: 540,
    tint: "bg-blue-100",
  },
};

async function main() {
  const source = resolve(__dirname, "./data/lms-data.json");
  const courses = JSON.parse(readFileSync(source, "utf8")) as RawCourse[];

  const target = targetLabel();
  console.log(`Menulis ${courses.length} kursus ke ${target}…\n`);

  const db = getFirestore(initAdmin());
  const batch = db.batch();

  let sectionTotal = 0;
  let lessonTotal = 0;

  courses.forEach((c, index) => {
    const m = meta[c.slug];
    if (!m) throw new Error(`Metadata tambahan tidak ada untuk slug "${c.slug}"`);

    const sections = c.sections.map((s, si) => {
      sectionTotal++;
      return {
        title: s.title,
        position: si,
        lessons: s.lessons.map((l, li) => {
          lessonTotal++;
          return {
            slug: l.slug,
            title: l.title,
            type: l.type,
            duration: l.duration,
            position: li,
            // Diisi belakangan lewat Firebase Console:
            //   videoUrl    -> tautan embed YouTube/Vimeo
            //   attachments -> berkas PDF/DOCX di Storage
          };
        }),
      };
    });

    batch.set(db.collection("courses").doc(c.slug), {
      slug: c.slug,
      title: c.title,
      shortDesc: c.short_desc,
      longDesc: c.long_desc,
      level: c.level,
      levelColor: c.level_color,
      category: c.category,
      icon: c.icon,
      tint: m.tint,
      duration: c.duration,
      rating: c.rating,
      reviews: c.reviews,
      price: m.price,
      thumbnail: m.thumbnail,
      enrolledStudents: m.enrolledStudents,
      lastUpdated: m.lastUpdated,
      // Merek sudah berganti dari NeuroAcademy ke SynapEd
      instructorName: c.instructor.replace(/NeuroAcademy/g, "SynapEd"),
      instructorBio: c.instructor_bio,
      whatYouLearn: c.what_you_learn,
      requirements: c.requirements,
      order: index,
      sections,
    });

    console.log(
      `  ${c.slug.padEnd(24)} ${sections.length} section, ` +
        `${sections.reduce((a, s) => a + s.lessons.length, 0)} lesson`,
    );
  });

  // Pengaman: gagalkan SEBELUM menulis kalau jumlahnya meleset.
  const actual = { courses: courses.length, sections: sectionTotal, lessons: lessonTotal };
  const mismatch = (Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]).filter(
    (k) => actual[k] !== EXPECTED[k],
  );

  if (mismatch.length) {
    throw new Error(
      `Jumlah tidak cocok pada: ${mismatch.join(", ")}.\n` +
        `  diharapkan ${JSON.stringify(EXPECTED)}\n` +
        `  ditemukan  ${JSON.stringify(actual)}\n` +
        `Migrasi dibatalkan — tidak ada yang ditulis.`,
    );
  }

  await batch.commit();

  const check = await db.collection("courses").get();
  console.log(`\nSelesai. Firestore kini berisi ${check.size} kursus.`);
  console.log(`Total: ${actual.sections} section, ${actual.lessons} lesson.`);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
