import Link from "next/link";
import Tag from "@/components/ui/Tag";
import CourseThumb from "@/components/ui/CourseThumb";
import CourseAuthor from "@/components/ui/CourseAuthor";
import { formatPrice, iconPaths, levelTone } from "@/lib/courseUi";
import type { CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";

const CARD_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
};

/**
 * Kartu kursus untuk katalog lengkap (/courses).
 *
 * Bahasa visualnya sama dengan kartu di beranda: kotak persegi tanpa garis tepi,
 * latar `paper-card`, hover mengangkat 4px dan menerangkan latar. Seluruh kartu
 * dapat diklik lewat tautan "Lihat Detail" yang diperluas (after:absolute).
 */
export default function CourseCard({ course, nomor }: { course: CourseSummary; nomor: number }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden bg-paper-card transition-[transform,background-color] duration-500 ease-warm hover:-translate-y-1 hover:bg-card-hover">
      <div className="relative h-44 overflow-hidden bg-paper-alt">
        <CourseThumb
          thumbnail={course.thumbnail}
          className="absolute inset-0 h-full w-full transition-transform duration-700 ease-warm group-hover:scale-[1.04]"
          fallback={
            <div className={cn("flex h-full w-full items-center justify-center", course.tint)}>
              <svg
                className="h-12 w-12 text-blue-600/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[course.icon] ?? iconPaths.reading} />
              </svg>
            </div>
          }
        />

        <span
          className="absolute left-0 top-0 flex h-9 w-11 items-center justify-center bg-black/60 text-[11px] tracking-wider text-white backdrop-blur-sm transition-colors duration-300 group-hover:bg-blue-600"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}
        >
          {String(nomor).padStart(2, "0")}
        </span>

        <span className="absolute bottom-3 right-3">
          <Tag tone={levelTone(course.levelColor)}>{course.level}</Tag>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <CourseAuthor
          name={course.instructorName}
          uid={course.ownerUid}
          photoURL={course.instructorPhoto}
          className="mb-4"
        />

        <h3 className="mb-2 text-xl leading-tight text-white transition-colors duration-300 group-hover:text-blue-300" style={CARD_TITLE}>
          {course.title}
        </h3>

        <p className="t-body mb-6 line-clamp-2 text-sm text-ink-body">{course.shortDesc}</p>

        <div className="mb-4 flex items-center gap-4 text-[13px] text-ink-muted">
          <span>
            <span className="font-semibold text-white">{course.lessonsCount}</span> modul
          </span>
          <span aria-hidden="true" className="h-3 w-px bg-white/20" />
          <span className="font-semibold text-white">{course.duration}</span>
        </div>

        <div className="mb-5 flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">{course.rating}</span>
          <div className="flex gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg
                key={s}
                className={cn("h-3.5 w-3.5", s <= Math.round(course.rating) ? "text-amber-500" : "text-white/20")}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784 0-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            ))}
          </div>
          <span className="text-xs text-ink-muted">({course.reviews})</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-lg text-white" style={{ fontFamily: "var(--font-sans)", fontWeight: 700, letterSpacing: "-0.025em" }}>
            {course.price > 0 ? formatPrice(course.price) : "Gratis"}
          </span>

          <Link
            href={`/courses/${course.slug}`}
            className="inline-flex items-center gap-1.5 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 after:absolute after:inset-0 after:content-['']"
          >
            Lihat Detail
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
