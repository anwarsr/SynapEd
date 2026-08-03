import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Bentuk yang dikirim ke frontend — camelCase, siap pakai. */
export interface CourseSummary {
  id: number;
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

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  shortDesc: true,
  level: true,
  levelColor: true,
  category: true,
  icon: true,
  tint: true,
  durationLabel: true,
  rating: true,
  reviews: true,
} as const;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `lessonsCount` selalu dihitung dari relasi, tidak pernah disimpan
   * sebagai kolom. Di Laravel angka ini kolom terpisah dan sudah sempat
   * meleset dari isi sebenarnya — dihitung begini, tidak bisa lagi.
   */
  private countLessons(sections: { lessons: unknown[] }[]): number {
    return sections.reduce((total, s) => total + s.lessons.length, 0);
  }

  async findAll(category?: string): Promise<CourseSummary[]> {
    const rows = await this.prisma.course.findMany({
      where: category && category !== 'semua' ? { category } : undefined,
      orderBy: { id: 'asc' },
      select: {
        ...summarySelect,
        sections: { select: { lessons: { select: { id: true } } } },
      },
    });

    return rows.map(({ sections, durationLabel, ...rest }) => ({
      ...rest,
      duration: durationLabel,
      lessonsCount: this.countLessons(sections),
    }));
  }

  async findBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: { lessons: { orderBy: { position: 'asc' } } },
        },
      },
    });

    if (!course) throw new NotFoundException(`Kursus "${slug}" tidak ditemukan.`);

    const { durationLabel, whatYouLearn, requirements, sections, ...rest } = course;

    return {
      ...rest,
      duration: durationLabel,
      whatYouLearn: JSON.parse(whatYouLearn) as string[],
      requirements: JSON.parse(requirements) as string[],
      lessonsCount: this.countLessons(sections),
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        lessons: s.lessons.map((l) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          type: l.type,
          duration: l.duration,
          free: l.free,
        })),
      })),
    };
  }

  /** Satu lesson + tetangga sebelum/sesudahnya, menggantikan LessonController. */
  async findLesson(courseSlug: string, lessonSlug: string) {
    const course = await this.findBySlug(courseSlug);

    const flat = course.sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionTitle: s.title })),
    );

    const index = flat.findIndex((l) => l.slug === lessonSlug);
    if (index === -1) {
      throw new NotFoundException(`Pelajaran "${lessonSlug}" tidak ada di kursus ini.`);
    }

    return {
      course: { slug: course.slug, title: course.title },
      lesson: flat[index],
      prev: index > 0 ? flat[index - 1] : null,
      next: index < flat.length - 1 ? flat[index + 1] : null,
      position: index + 1,
      total: flat.length,
    };
  }

  async categories(): Promise<{ slug: string; label: string }[]> {
    // Label ini tadinya hardcoded di CourseController Laravel.
    const labels: Record<string, string> = {
      neuroscience: 'Neuroscience',
      eeg: 'Teknologi EEG',
      analisis: 'Analisis Data',
    };

    const rows = await this.prisma.course.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { id: 'asc' },
    });

    return [
      { slug: 'semua', label: 'Semua Materi' },
      ...rows.map((r) => ({ slug: r.category, label: labels[r.category] ?? r.category })),
    ];
  }
}
