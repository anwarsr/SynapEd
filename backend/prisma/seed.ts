import { PrismaClient } from '@prisma/client';
import rawCourses from './lms-data.json';

const prisma = new PrismaClient();

interface RawLesson {
  slug: string;
  title: string;
  type: string;
  duration: string;
  free: boolean;
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

/**
 * Metadata yang hanya hidup di LmsData::decorateCourse() — tidak ikut di
 * array kursus mentah, jadi dipetakan ulang di sini.
 * `tint` berasal dari sistem desain frontend ("Tinta & Kertas").
 */
const meta: Record<
  string,
  { price: number; thumbnail: string; lastUpdated: string; enrolledStudents: number; tint: string }
> = {
  'dasar-neuroscience': {
    price: 500_000,
    thumbnail: 'https://rsa.ugm.ac.id/wp-content/uploads/sites/60/eeg_40_channel_rsa_ugm_2.jpg',
    lastUpdated: '12 Mei 2026',
    enrolledStudents: 1840,
    tint: 'bg-blue-50',
  },
  'pengenalan-eeg': {
    price: 450_000,
    thumbnail: 'images/course-thumbnails/pengenalan-eeg.svg',
    lastUpdated: '08 Mei 2026',
    enrolledStudents: 1320,
    tint: 'bg-paper-alt',
  },
  'implementasi-eeg-muse': {
    price: 650_000,
    thumbnail: 'images/course-thumbnails/implementasi-eeg-muse.svg',
    lastUpdated: '10 Mei 2026',
    enrolledStudents: 860,
    tint: 'bg-amber-100',
  },
  'analisis-data-eeg': {
    price: 800_000,
    thumbnail: 'images/course-thumbnails/analisis-data-eeg.svg',
    lastUpdated: '14 Mei 2026',
    enrolledStudents: 540,
    tint: 'bg-blue-100',
  },
};

async function main() {
  const courses = rawCourses as unknown as RawCourse[];

  console.log('Seeding katalog kursus dari LmsData…');

  // Idempoten: cascade menghapus section & lesson, tidak ada baris yatim.
  await prisma.course.deleteMany();

  for (const c of courses) {
    const m = meta[c.slug];
    if (!m) throw new Error(`Metadata tambahan tidak ada untuk slug "${c.slug}"`);

    await prisma.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        shortDesc: c.short_desc,
        longDesc: c.long_desc,
        level: c.level,
        levelColor: c.level_color,
        category: c.category,
        icon: c.icon,
        tint: m.tint,
        durationLabel: c.duration,
        rating: c.rating,
        reviews: c.reviews,
        price: m.price,
        thumbnail: m.thumbnail,
        enrolledStudents: m.enrolledStudents,
        lastUpdated: m.lastUpdated,
        // Merek sudah berganti dari NeuroAcademy ke SynapEd
        instructorName: c.instructor.replace(/NeuroAcademy/g, 'SynapEd'),
        instructorBio: c.instructor_bio,
        whatYouLearn: JSON.stringify(c.what_you_learn),
        requirements: JSON.stringify(c.requirements),
        sections: {
          create: c.sections.map((s, si) => ({
            title: s.title,
            position: si,
            lessons: {
              create: s.lessons.map((l, li) => ({
                slug: l.slug,
                title: l.title,
                type: l.type,
                duration: l.duration,
                free: Boolean(l.free),
                position: li,
              })),
            },
          })),
        },
      },
    });
  }

  const [courseCount, sectionCount, lessonCount] = await Promise.all([
    prisma.course.count(),
    prisma.section.count(),
    prisma.lesson.count(),
  ]);

  console.log(`Selesai: ${courseCount} kursus, ${sectionCount} section, ${lessonCount} lesson.`);

  // Jaring pengaman: konversi frontend sebelumnya diam-diam kehilangan
  // 14 lesson. Kalau angkanya meleset lagi, seed harus gagal keras.
  const expected = courses.reduce(
    (acc, c) => acc + c.sections.reduce((a, s) => a + s.lessons.length, 0),
    0,
  );
  if (lessonCount !== expected) {
    throw new Error(`Jumlah lesson tidak cocok: DB ${lessonCount}, sumber ${expected}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
