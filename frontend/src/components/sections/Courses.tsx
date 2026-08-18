"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import Tag from "@/components/ui/Tag";
import type { Category, CourseSummary } from "@/lib/courses";
import { levelTone } from "@/lib/courseUi";
import CourseThumb from "@/components/ui/CourseThumb";
import CourseAuthor from "@/components/ui/CourseAuthor";
import { cn } from "@/lib/cn";

interface Props {
  courses: CourseSummary[];
  categories: Category[];
}

/* =========================================================
   TYPOGRAPHY
========================================================= */

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
  fontWeight: 800,
  lineHeight: 1.03,
  letterSpacing: "-0.055em",
};

const CARD_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
};

/* =========================================================
   COMPONENT
========================================================= */

export default function Courses({ courses, categories }: Props) {
  const [filter, setFilter] = useState("semua");

  const filtered =
    filter === "semua" ? courses : courses.filter((c) => c.category === filter);

  return (
    <section id="courses" className="relative overflow-hidden bg-paper py-28">
      {/* =====================================================
          SUBTLE PAPER TEXTURE
      ===================================================== */}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #2563eb 0.65px, transparent 0.65px)",
            backgroundSize: "18px 18px",
          }}
        />
      </div>

      <div className="container-page relative z-10">
        {/* =====================================================
            HEADING
        ===================================================== */}

        <div className="flex flex-col md:items-end">
          <Reveal className="wrap-break-word md:text-right">
            <h2 className="max-w-5xl text-blue-600" style={HEADING}>
              Materi Pembelajaran
            </h2>
          </Reveal>

          {/* subtitle hitam */}
          <Reveal delay={110} className="mt-6 md:max-w-md">
            <p className="t-body text-ink/80 md:text-right">
              Berbagai modul terstruktur dari level dasar hingga lanjutan,
              dirancang untuk pengalaman belajar yang optimal.
            </p>
          </Reveal>
        </div>

        {/* =====================================================
            FILTER
        ===================================================== */}

        {categories.length > 1 && (
          <Reveal delay={180}>
            <div className="mt-10 flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = filter === cat.slug;

                return (
                  <button
                    key={cat.slug}
                    onClick={() => setFilter(cat.slug)}
                    aria-pressed={active}
                    className={cn(
                      "group relative overflow-hidden rounded-full border px-5 py-2.5 text-sm",
                      "transition-all duration-300 ease-out-soft",
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-[0_8px_25px_rgba(37,99,235,0.18)]"
                        : "border-blue-200 bg-white/75 text-blue-600 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-white hover:text-blue-700",
                    )}
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {/* animated shine */}
                    <span
                      className={cn(
                        "absolute inset-y-0 -left-[70%] w-[45%] rotate-12",
                        "bg-white/25 blur-md",
                        "transition-transform duration-700",
                        active
                          ? "translate-x-[400%]"
                          : "group-hover:translate-x-[400%]",
                      )}
                    />

                    <span className="relative z-10">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* =====================================================
            EMPTY STATE
        ===================================================== */}

        {filtered.length === 0 ? (
          <Reveal
            className="
              mt-12 rounded-3xl
              border border-blue-100
              bg-white/75
              px-8 py-20
              text-center
              shadow-[0_20px_60px_rgba(37,99,235,0.06)]
              backdrop-blur-sm
            "
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 9h8M8 12h5"
                />
              </svg>
            </div>

            <p className="mb-3 text-2xl text-blue-600" style={CARD_TITLE}>
              Belum ada materi di sini.
            </p>

            <p className="t-body mx-auto max-w-md text-sm text-ink/75">
              Materi untuk kategori ini sedang disiapkan — coba lihat kategori
              lain, atau kembali lagi sebentar lagi.
            </p>
          </Reveal>
        ) : (
          /* =====================================================
             COURSE GRID
          ===================================================== */

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course, index) => (
              <Reveal
                key={course.slug}
                delay={(index % 3) * 90}
                className="h-full"
              >
                <article
                  className="
                    group relative flex h-full flex-col overflow-hidden
                    rounded-[1.5rem]
                    border border-blue-100
                    bg-white
                    shadow-[0_8px_30px_rgba(37,99,235,0.045)]
                    transition-all duration-500 ease-warm
                    hover:-translate-y-2
                    hover:border-blue-300
                    hover:shadow-[0_24px_60px_rgba(37,99,235,0.12)]
                  "
                >
                  {/* =================================================
                      CARD GLOW
                  ================================================= */}

                  <div
                    className="
                      pointer-events-none absolute -inset-px z-20
                      rounded-[1.5rem]
                      opacity-0
                      transition-opacity duration-500
                      group-hover:opacity-100
                    "
                    style={{
                      background:
                        "linear-gradient(120deg, transparent 20%, rgba(37,99,235,0.10), transparent 80%)",
                    }}
                  />

                  {/* =================================================
                      THUMBNAIL
                  ================================================= */}

                  <div
                    className={cn(
                      "relative h-48 overflow-hidden",
                      "border-b border-blue-100",
                      course.tint || "bg-blue-50",
                    )}
                  >
                    {/* soft inner gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-blue-200/20" />

                    <CourseThumb
                      thumbnail={course.thumbnail}
                      className="
                        absolute inset-0 h-full w-full
                        transition-transform duration-700 ease-warm
                        group-hover:scale-[1.045]
                        group-hover:-translate-y-1
                      "
                      fallback={
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://api.dicebear.com/8.x/notionists/svg?seed=${encodeURIComponent(
                            course.title,
                          )}&size=200&backgroundColor=transparent`}
                          className="
                            absolute inset-0 h-full w-full
                            object-contain p-6
                            transition-transform duration-700 ease-warm
                            group-hover:scale-110
                            group-hover:-rotate-1
                          "
                          alt=""
                        />
                      }
                    />

                    {/* =================================================
                        SHINE
                    ================================================= */}

                    <div
                      className="
                        pointer-events-none absolute inset-y-0 -left-1/2
                        w-1/3 rotate-12
                        bg-white/30 blur-xl
                        transition-transform duration-1000
                        group-hover:translate-x-[430%]
                      "
                    />

                    {/* =================================================
                        CARD NUMBER
                    ================================================= */}

                    <span
                      className="
                        absolute left-4 top-4
                        flex h-9 w-9 items-center justify-center
                        rounded-full
                        border border-white/80
                        bg-white/90
                        text-[11px] text-blue-600
                        shadow-[0_4px_15px_rgba(37,99,235,0.10)]
                        backdrop-blur-sm
                        transition-all duration-500
                        group-hover:scale-110
                        group-hover:-rotate-6
                        group-hover:bg-blue-600
                        group-hover:text-white
                      "
                      style={{
                        fontFamily: "var(--font-inter)",
                        fontWeight: 800,
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {/* =================================================
                        LEVEL
                    ================================================= */}

                    <span className="absolute bottom-4 right-4">
                      <Tag tone={levelTone(course.levelColor)}>
                        {course.level}
                      </Tag>
                    </span>
                  </div>

                  {/* =================================================
                      BODY
                  ================================================= */}

                  <div className="flex flex-1 flex-col p-6">
                    <CourseAuthor
                      name={course.instructorName}
                      className="mb-4"
                    />

                    {/* card title */}
                    <h3
                      className="
                        mb-2
                        text-xl leading-tight text-blue-600
                        transition-colors duration-300
                        group-hover:text-blue-700
                      "
                      style={CARD_TITLE}
                    >
                      {course.title}
                    </h3>

                    {/* card description */}
                    <p className="t-body mb-7 line-clamp-2 text-sm text-ink/80">
                      {course.shortDesc}
                    </p>

                    {/* =================================================
                        META
                    ================================================= */}

                    <div className="mb-5 flex items-center gap-4 text-[13px] text-ink-muted">
                      <span>
                        <span className="font-semibold text-ink">
                          {course.lessonsCount}
                        </span>{" "}
                        modul
                      </span>

                      <span
                        aria-hidden="true"
                        className="h-3 w-px bg-blue-100"
                      />

                      <span>
                        <span className="font-semibold text-ink">
                          {course.duration}
                        </span>
                      </span>
                    </div>

                    {/* =================================================
                        RATING
                    ================================================= */}

                    <div className="mb-5 flex items-center gap-1.5 border-b border-blue-100 pb-5">
                      <span className="text-sm font-semibold text-ink">
                        {course.rating}
                      </span>

                      <div className="flex gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg
                            key={s}
                            className={cn(
                              "h-3.5 w-3.5 transition-transform duration-300",
                              s <= Math.round(course.rating)
                                ? "text-amber-500 group-hover:scale-110"
                                : "text-blue-100",
                            )}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        ))}
                      </div>

                      <span className="text-xs text-ink-muted">
                        ({course.reviews})
                      </span>
                    </div>

                    {/* =================================================
                        BUTTONS
                    ================================================= */}

                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <Button
                        href={`/courses/${course.slug}`}
                        variant="outline"
                        size="sm"
                      >
                        Detail
                      </Button>

                      <Button href="/register" variant="primary" size="sm">
                        Beli
                      </Button>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
