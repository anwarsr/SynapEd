import Link from "next/link";
import CourseThumb from "@/components/ui/CourseThumb";
import CourseAuthor from "@/components/ui/CourseAuthor";
import { iconPaths } from "@/lib/courseUi";
import { progressFromSnapshot, type Enrollment } from "@/lib/enrollments";
import type { CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";

const CARD_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
};

/**
 * Kartu kursus yang diikuti di dashboard.
 *
 * Bahasa visualnya sama dengan kartu di katalog (`CourseCard`): kotak persegi
 * tanpa garis tepi, hover mengangkat 4px dan menerangkan latar. Isinya sengaja
 * diringkas: gambar, nama pembuat, judul, deskripsi, dan bar kemajuan - tanpa
 * harga, rating, maupun tag level, karena kursus ini sudah dimiliki.
 *
 * `course` boleh null (kursusnya sudah dihapus dari katalog); kartu tetap tampil
 * dari snapshot di dokumen enrollment, hanya tanpa pembuat dan deskripsi.
 */
export default function EnrolledCourseCard({
  enrollment,
  course,
}: {
  enrollment: Enrollment;
  course: CourseSummary | null;
}) {
  const progress = progressFromSnapshot(enrollment);
  const judul = course?.title ?? enrollment.courseTitle;
  const icon = course?.icon ?? enrollment.courseIcon;
  const tint = course?.tint ?? enrollment.courseTint;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden bg-paper-card transition-[transform,background-color] duration-500 ease-warm hover:-translate-y-1 hover:bg-card-hover">
      <div className="relative h-44 overflow-hidden bg-paper-alt">
        <CourseThumb
          thumbnail={course?.thumbnail ?? null}
          className="absolute inset-0 h-full w-full transition-transform duration-700 ease-warm group-hover:scale-[1.04]"
          fallback={
            <div className={cn("flex h-full w-full items-center justify-center", tint)}>
              <svg
                className="h-12 w-12 text-blue-600/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[icon] ?? iconPaths.reading} />
              </svg>
            </div>
          }
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        {course && (
          <CourseAuthor
            name={course.instructorName}
            uid={course.ownerUid}
            photoURL={course.instructorPhoto}
            className="mb-4"
          />
        )}

        <h3
          className="mb-2 text-xl leading-tight text-white transition-colors duration-300 group-hover:text-blue-300"
          style={CARD_TITLE}
        >
          {judul}
        </h3>

        {course?.shortDesc && <p className="t-body mb-6 line-clamp-2 text-sm text-ink-body">{course.shortDesc}</p>}

        {/* Kemajuan */}
        <div className="mt-auto pt-2">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="text-ink-muted">
              {progress.done} dari {progress.total} pelajaran
            </span>
            <span className="t-numeral tabular-nums text-white">{progress.percent}%</span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/10" role="presentation">
            <span
              className="block h-full rounded-full bg-blue-500 transition-[width] duration-500 ease-warm"
              style={{ width: `${progress.percent}%` }}
            />
          </span>
        </div>

        {/* Seluruh kartu menjadi tautan lanjut belajar */}
        <Link
          href={`/courses/${enrollment.courseSlug}/learn${enrollment.lastLessonSlug ? `/${enrollment.lastLessonSlug}` : ""}`}
          aria-label={`Lanjutkan belajar: ${judul}`}
          className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-500"
        />
      </div>
    </article>
  );
}
