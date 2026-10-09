import Link from "next/link";
import CourseAuthor from "@/components/ui/CourseAuthor";
import CourseCover from "@/components/courses/CourseCover";
import { formatPrice, levelTone } from "@/lib/courseUi";
import type { CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";

const CARD_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 650,
  letterSpacing: "-0.022em",
};

const STAR =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784 0-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z";

/** Warna teks tingkat kesulitan - teks polos, tanpa kotak atau garis. */
const LEVEL_TEKS = {
  blue: "text-blue-300",
  amber: "text-warn-text",
  rust: "text-error-text",
} as const;

/** Lima bintang dengan isian PRESISI (4,3 → bintang kelima terisi 30%). */
function Bintang({ nilai }: { nilai: number }) {
  const baris = (warna: string) => (
    <span className={cn("flex gap-[3px]", warna)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className="h-[15px] w-[15px] shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );

  return (
    <span className="relative inline-block" aria-hidden="true">
      {baris("text-white/15")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.min(100, Math.max(0, (nilai / 5) * 100))}%` }}>
        {baris("text-amber-500")}
      </span>
    </span>
  );
}

/**
 * Kartu kursus untuk katalog (beranda & /courses).
 *
 * Kotak persegi tanpa garis tepi; hover mengangkat 4px dan menerangkan latar.
 * Gambar sampul bisa dibalik (CourseCover). Tingkat kesulitan = teks polos di
 * pojok kanan, tepat di bawah gambar. Seluruh kartu dapat diklik lewat tautan
 * "Lihat Detail" yang diperluas (after:absolute) - sampulnya `z-10` agar tetap
 * bisa ditekan sendiri.
 */
export default function CourseCard({ course, nomor }: { course: CourseSummary; nomor: number }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden bg-paper-card transition-[transform,background-color] duration-500 ease-warm hover:-translate-y-1 hover:bg-card-hover">
      <CourseCover course={course} nomor={nomor} />

      <div className="flex flex-1 flex-col px-6 pb-6 pt-3">
        {/* Tingkat kesulitan: kanan, di bawah gambar */}
        <p className="mb-3 text-right">
          <span className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", LEVEL_TEKS[levelTone(course.levelColor)])}>
            {course.level}
          </span>
        </p>

        <CourseAuthor name={course.instructorName} uid={course.ownerUid} photoURL={course.instructorPhoto} className="mb-4" />

        <h3 className="mb-3 line-clamp-2 text-[1.3rem] leading-[1.28] text-white transition-colors duration-300 group-hover:text-blue-300" style={CARD_TITLE}>
          {course.title}
        </h3>

        <p className="mb-7 line-clamp-2 text-[13.5px] font-normal leading-[1.8] tracking-[0.005em] text-ink-muted">{course.shortDesc}</p>

        {/* Modul & estimasi selesai - angka besar, label kecil */}
        <dl className="mb-5 flex items-end gap-9">
          <div>
            <dd className="text-[1.65rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-white">
              {course.lessonsCount}
            </dd>
            <dt className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Modul</dt>
          </div>
          <div>
            <dd className="text-[1.65rem] font-extrabold leading-none tracking-[-0.03em] text-white">{course.duration}</dd>
            <dt className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Estimasi selesai</dt>
          </div>
        </dl>

        {/* Rating: bintang presisi + nilai + jumlah pemberi rating */}
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Bintang nilai={course.rating} />
          <span className="text-base font-bold tabular-nums text-white">{Number(course.rating).toFixed(1)}</span>
          <span className="text-[13px] text-ink-muted">{course.reviews} ulasan</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="text-lg text-white" style={{ fontFamily: "var(--font-sans)", fontWeight: 700, letterSpacing: "-0.025em" }}>
            {course.price > 0 ? formatPrice(course.price) : "Gratis"}
          </span>

          <Link
            href={`/courses/${course.slug}`}
            className="inline-flex items-center gap-1.5 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 after:absolute after:inset-0 after:content-['']"
          >
            Lihat Detail
          </Link>
        </div>
      </div>
    </article>
  );
}
