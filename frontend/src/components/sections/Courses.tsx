"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import Tag from "@/components/ui/Tag";
import type { Category, CourseSummary } from "@/lib/courses";
import { formatPrice, levelTone } from "@/lib/courseUi";
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
    filter === "semua"
      ? courses
      : courses.filter((c) => c.category === filter);

  return (
    <section
      id="courses"
      className="relative overflow-hidden bg-paper py-28"
    >
      {/* =====================================================
          PAPER TEXTURE
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
                      "group relative overflow-hidden rounded-full px-5 py-2.5 text-sm",
                      "transition-all duration-300 ease-out-soft",
                      active
                        ? "bg-blue-600 text-white shadow-[0_8px_25px_rgba(37,99,235,0.18)]"
                        : "bg-white/75 text-blue-600 hover:-translate-y-0.5 hover:bg-white hover:text-blue-700",
                    )}
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
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
          <Reveal className="mt-12">
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[2rem] bg-white/70 px-8 py-20 text-center">
              {/* =================================================
                  AUTOMATIC GLITCH BACKGROUND
              ================================================= */}

              <div className="pointer-events-none absolute inset-0">
                {/* Scanlines */}
                <div className="courses-glitch-scanlines absolute inset-0" />

                {/* Horizontal bars */}
                <span className="courses-glitch-bar courses-glitch-bar-1" />
                <span className="courses-glitch-bar courses-glitch-bar-2" />
                <span className="courses-glitch-bar courses-glitch-bar-3" />

                {/* Small fragments */}
                <span className="courses-glitch-fragment courses-glitch-fragment-1" />
                <span className="courses-glitch-fragment courses-glitch-fragment-2" />
                <span className="courses-glitch-fragment courses-glitch-fragment-3" />
              </div>

              {/* =================================================
                  CONTENT
              ================================================= */}

              <div className="courses-glitch-content relative z-10">
                {/* =================================================
                    ICON
                ================================================= */}

                <div className="courses-glitch-icon relative mx-auto mb-6 h-16 w-16">
                  {/* Ghost */}
                  <div className="courses-glitch-icon-ghost absolute inset-0 flex items-center justify-center rounded-2xl bg-black/[0.025]">
                    <ErrorIcon />
                  </div>

                  {/* Main */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/[0.035]">
                    <ErrorIcon />
                  </div>
                </div>

                {/* =================================================
                    TITLE
                ================================================= */}

                <div className="relative mx-auto inline-block">
                  {/* Glitch layer 1 */}
                  <p
                    aria-hidden="true"
                    className="courses-glitch-title-1 pointer-events-none absolute inset-0 text-2xl text-black"
                    style={CARD_TITLE}
                  >
                    Belum ada materi di sini.
                  </p>

                  {/* Glitch layer 2 */}
                  <p
                    aria-hidden="true"
                    className="courses-glitch-title-2 pointer-events-none absolute inset-0 text-2xl text-black"
                    style={CARD_TITLE}
                  >
                    Belum ada materi di sini.
                  </p>

                  {/* Main */}
                  <p
                    className="courses-glitch-title relative mb-3 text-2xl text-black"
                    style={CARD_TITLE}
                  >
                    Belum ada materi di sini.
                  </p>
                </div>

                {/* =================================================
                    DESCRIPTION
                ================================================= */}

                <p className="courses-glitch-description t-body mx-auto max-w-md text-sm text-ink/65">
                  Materi untuk kategori ini sedang disiapkan — coba lihat
                  kategori lain, atau kembali lagi sebentar.
                </p>

                {/* =================================================
                    STATUS
                ================================================= */}

                <div className="courses-glitch-indicator mx-auto mt-7 flex items-center justify-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black/30" />
                  <span className="h-1.5 w-6 rounded-full bg-black/10" />
                  <span className="h-1.5 w-3 rounded-full bg-black/20" />
                </div>
              </div>

              {/* =================================================
                  GLITCH CSS
              ================================================= */}

              <style>{`
                /* -----------------------------------------------
                   CONTENT
                ------------------------------------------------ */

                .courses-glitch-content {
                  animation: coursesContentGlitch 3s infinite;
                }

                @keyframes coursesContentGlitch {
                  0%,
                  78%,
                  100% {
                    transform: translate3d(0, 0, 0);
                    filter: none;
                  }

                  79% {
                    transform: translate3d(-2px, 1px, 0);
                  }

                  80% {
                    transform: translate3d(3px, -1px, 0);
                  }

                  81% {
                    transform: translate3d(-1px, 1px, 0);
                  }

                  82% {
                    transform: translate3d(0, 0, 0);
                    filter: contrast(1.15);
                  }
                }

                /* -----------------------------------------------
                   ICON
                ------------------------------------------------ */

                .courses-glitch-icon {
                  animation: coursesIcon 2.2s infinite;
                }

                @keyframes coursesIcon {
                  0%,
                  70%,
                  100% {
                    transform: translate3d(0, 0, 0);
                    clip-path: inset(0);
                  }

                  71% {
                    transform: translate3d(-3px, 1px, 0);
                    clip-path: inset(15% 0 65% 0);
                  }

                  72% {
                    transform: translate3d(4px, -1px, 0);
                    clip-path: inset(60% 0 20% 0);
                  }

                  73% {
                    transform: translate3d(-2px, 0, 0);
                    clip-path: inset(35% 0 40% 0);
                  }

                  74% {
                    transform: translate3d(0, 0, 0);
                    clip-path: inset(0);
                  }
                }

                .courses-glitch-icon-ghost {
                  animation: coursesIconGhost 2.2s infinite;
                }

                @keyframes coursesIconGhost {
                  0%,
                  62%,
                  100% {
                    opacity: 0;
                    transform: translate3d(0, 0, 0);
                  }

                  63% {
                    opacity: 0.5;
                    transform: translate3d(-4px, 0, 0);
                  }

                  64% {
                    opacity: 0;
                    transform: translate3d(4px, 1px, 0);
                  }
                }

                /* -----------------------------------------------
                   TITLE
                ------------------------------------------------ */

                .courses-glitch-title {
                  animation: coursesTitle 2.4s infinite;
                }

                @keyframes coursesTitle {
                  0%,
                  74%,
                  100% {
                    transform: translate3d(0, 0, 0);
                    clip-path: inset(0);
                  }

                  75% {
                    transform: translate3d(-3px, 0, 0);
                    clip-path: inset(10% 0 72% 0);
                  }

                  76% {
                    transform: translate3d(3px, 0, 0);
                    clip-path: inset(65% 0 15% 0);
                  }

                  77% {
                    transform: translate3d(-2px, 1px, 0);
                    clip-path: inset(40% 0 40% 0);
                  }

                  78% {
                    transform: translate3d(0, 0, 0);
                    clip-path: inset(0);
                  }

                  88% {
                    transform: translate3d(2px, 0, 0);
                    clip-path: inset(70% 0 8% 0);
                  }

                  89% {
                    transform: translate3d(0, 0, 0);
                    clip-path: inset(0);
                  }
                }

                .courses-glitch-title-1 {
                  animation: coursesTitleGhostOne 2s infinite;
                }

                @keyframes coursesTitleGhostOne {
                  0%,
                  58%,
                  100% {
                    opacity: 0;
                    transform: translate3d(0, 0, 0);
                  }

                  59% {
                    opacity: 0.45;
                    transform: translate3d(-4px, 0, 0);
                    clip-path: inset(15% 0 65% 0);
                  }

                  60% {
                    opacity: 0;
                    transform: translate3d(3px, 0, 0);
                    clip-path: inset(65% 0 15% 0);
                  }
                }

                .courses-glitch-title-2 {
                  animation: coursesTitleGhostTwo 2.6s infinite;
                }

                @keyframes coursesTitleGhostTwo {
                  0%,
                  82%,
                  100% {
                    opacity: 0;
                    transform: translate3d(0, 0, 0);
                  }

                  83% {
                    opacity: 0.4;
                    transform: translate3d(4px, 0, 0);
                    clip-path: inset(55% 0 25% 0);
                  }

                  84% {
                    opacity: 0;
                    transform: translate3d(-3px, 0, 0);
                  }
                }

                /* -----------------------------------------------
                   DESCRIPTION
                ------------------------------------------------ */

                .courses-glitch-description {
                  animation: coursesDescription 3.1s infinite;
                }

                @keyframes coursesDescription {
                  0%,
                  80%,
                  100% {
                    transform: translate3d(0, 0, 0);
                    opacity: 1;
                    clip-path: inset(0);
                  }

                  81% {
                    transform: translate3d(-2px, 0, 0);
                    opacity: 0.65;
                    clip-path: inset(20% 0 60% 0);
                  }

                  82% {
                    transform: translate3d(2px, 0, 0);
                    opacity: 0.9;
                    clip-path: inset(60% 0 20% 0);
                  }

                  83% {
                    transform: translate3d(-1px, 0, 0);
                    opacity: 0.7;
                    clip-path: inset(40% 0 35% 0);
                  }

                  84% {
                    transform: translate3d(0, 0, 0);
                    opacity: 1;
                    clip-path: inset(0);
                  }
                }

                /* -----------------------------------------------
                   INDICATOR
                ------------------------------------------------ */

                .courses-glitch-indicator {
                  animation: coursesIndicator 1.7s infinite;
                }

                @keyframes coursesIndicator {
                  0%,
                  64%,
                  100% {
                    transform: translate3d(0, 0, 0);
                    opacity: 1;
                  }

                  65% {
                    transform: translate3d(-4px, 0, 0);
                    opacity: 0.45;
                  }

                  66% {
                    transform: translate3d(5px, 0, 0);
                    opacity: 0.8;
                  }

                  67% {
                    transform: translate3d(-2px, 0, 0);
                    opacity: 0.4;
                  }

                  68% {
                    transform: translate3d(0, 0, 0);
                    opacity: 1;
                  }
                }

                /* -----------------------------------------------
                   SCANLINES
                ------------------------------------------------ */

                .courses-glitch-scanlines {
                  opacity: 0.035;
                  background-image:
                    repeating-linear-gradient(
                      0deg,
                      transparent 0px,
                      transparent 3px,
                      #000 4px
                    );
                  animation: coursesScanlines 0.12s steps(2) infinite;
                }

                @keyframes coursesScanlines {
                  0% {
                    transform: translateY(-4px);
                  }

                  50% {
                    transform: translateY(4px);
                  }

                  100% {
                    transform: translateY(-4px);
                  }
                }

                /* -----------------------------------------------
                   GLITCH BARS
                ------------------------------------------------ */

                .courses-glitch-bar {
                  position: absolute;
                  left: 0;
                  width: 100%;
                  opacity: 0;
                }

                .courses-glitch-bar-1 {
                  top: 27%;
                  height: 2px;
                  background: rgba(0, 0, 0, 0.08);
                  animation: coursesBarOne 2.4s steps(1) infinite;
                }

                .courses-glitch-bar-2 {
                  top: 52%;
                  height: 1px;
                  background: rgba(0, 0, 0, 0.1);
                  animation: coursesBarTwo 1.8s steps(1) infinite;
                }

                .courses-glitch-bar-3 {
                  top: 73%;
                  height: 2px;
                  background: rgba(0, 0, 0, 0.06);
                  animation: coursesBarThree 2.9s steps(1) infinite;
                }

                @keyframes coursesBarOne {
                  0%,
                  82%,
                  100% {
                    opacity: 0;
                    transform: translateX(0) scaleX(0);
                  }

                  83% {
                    opacity: 1;
                    transform: translateX(-8%) scaleX(0.65);
                  }

                  84% {
                    opacity: 0;
                    transform: translateX(18%) scaleX(0.4);
                  }
                }

                @keyframes coursesBarTwo {
                  0%,
                  62%,
                  100% {
                    opacity: 0;
                    transform: translateX(0) scaleX(0);
                  }

                  63% {
                    opacity: 1;
                    transform: translateX(12%) scaleX(0.55);
                  }

                  64% {
                    opacity: 0;
                    transform: translateX(-15%) scaleX(0.8);
                  }
                }

                @keyframes coursesBarThree {
                  0%,
                  73%,
                  100% {
                    opacity: 0;
                    transform: translateX(0) scaleX(0);
                  }

                  74% {
                    opacity: 1;
                    transform: translateX(-5%) scaleX(0.6);
                  }

                  75% {
                    opacity: 0;
                    transform: translateX(20%) scaleX(0.3);
                  }
                }

                /* -----------------------------------------------
                   FRAGMENTS
                ------------------------------------------------ */

                .courses-glitch-fragment {
                  position: absolute;
                  height: 3px;
                  opacity: 0;
                  background: rgba(0, 0, 0, 0.06);
                }

                .courses-glitch-fragment-1 {
                  left: 10%;
                  top: 35%;
                  width: 80px;
                  animation: coursesFragmentOne 1.7s steps(1) infinite;
                }

                .courses-glitch-fragment-2 {
                  right: 12%;
                  top: 62%;
                  width: 110px;
                  animation: coursesFragmentTwo 2.3s steps(1) infinite;
                }

                .courses-glitch-fragment-3 {
                  left: 35%;
                  top: 82%;
                  width: 48px;
                  animation: coursesFragmentThree 1.4s steps(1) infinite;
                }

                @keyframes coursesFragmentOne {
                  0%,
                  70%,
                  100% {
                    opacity: 0;
                    transform: translateX(0);
                  }

                  71% {
                    opacity: 1;
                    transform: translateX(35px);
                  }

                  72% {
                    opacity: 0;
                    transform: translateX(-20px);
                  }
                }

                @keyframes coursesFragmentTwo {
                  0%,
                  55%,
                  100% {
                    opacity: 0;
                    transform: translateX(0);
                  }

                  56% {
                    opacity: 1;
                    transform: translateX(-45px);
                  }

                  57% {
                    opacity: 0;
                    transform: translateX(20px);
                  }
                }

                @keyframes coursesFragmentThree {
                  0%,
                  38%,
                  100% {
                    opacity: 0;
                    transform: translateX(0);
                  }

                  39% {
                    opacity: 1;
                    transform: translateX(25px);
                  }

                  40% {
                    opacity: 0;
                    transform: translateX(-15px);
                  }
                }

                /* -----------------------------------------------
                   REDUCED MOTION
                ------------------------------------------------ */

                @media (prefers-reduced-motion: reduce) {
                  .courses-glitch-content,
                  .courses-glitch-icon,
                  .courses-glitch-icon-ghost,
                  .courses-glitch-title,
                  .courses-glitch-title-1,
                  .courses-glitch-title-2,
                  .courses-glitch-description,
                  .courses-glitch-indicator,
                  .courses-glitch-scanlines,
                  .courses-glitch-bar,
                  .courses-glitch-fragment {
                    animation: none !important;
                  }
                }
              `}</style>
            </div>
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
                    group
                    relative
                    flex
                    h-full
                    flex-col
                    overflow-hidden
                    rounded-[1.5rem]
                    bg-white
                    shadow-[0_8px_30px_rgba(37,99,235,0.045)]
                    transition-all
                    duration-500
                    ease-warm
                    hover:-translate-y-2
                    hover:shadow-[0_24px_60px_rgba(37,99,235,0.12)]
                  "
                >
                  {/* =================================================
                      THUMBNAIL
                  ================================================= */}

                  <div
                    className={cn(
                      "relative h-48 overflow-hidden",
                      course.tint || "bg-blue-50",
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-blue-200/20" />

                    <CourseThumb
                      thumbnail={course.thumbnail}
                      className="
                        absolute
                        inset-0
                        h-full
                        w-full
                        transition-transform
                        duration-700
                        ease-warm
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
                            absolute
                            inset-0
                            h-full
                            w-full
                            object-contain
                            p-6
                            transition-transform
                            duration-700
                            ease-warm
                            group-hover:scale-110
                            group-hover:-rotate-1
                          "
                          alt=""
                        />
                      }
                    />

                    {/* Shine */}
                    <div
                      className="
                        pointer-events-none
                        absolute
                        inset-y-0
                        -left-1/2
                        w-1/3
                        rotate-12
                        bg-white/30
                        blur-xl
                        transition-transform
                        duration-1000
                        group-hover:translate-x-[430%]
                      "
                    />

                    {/* Number */}
                    <span
                      className="
                        absolute
                        left-4
                        top-4
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-full
                        bg-white/90
                        text-[11px]
                        text-blue-600
                        shadow-[0_4px_15px_rgba(37,99,235,0.10)]
                        backdrop-blur-sm
                        transition-all
                        duration-500
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

                    {/* Level */}
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
                      uid={course.ownerUid}
                      photoURL={course.instructorPhoto}
                      className="mb-4"
                    />

                    {/* Title */}
                    <h3
                      className="
                        mb-2
                        text-xl
                        leading-tight
                        text-black
                        transition-colors
                        duration-300
                        group-hover:text-blue-700
                      "
                      style={CARD_TITLE}
                    >
                      {course.title}
                    </h3>

                    {/* Description */}
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

                    <div className="mb-5 flex items-center gap-1.5 pb-5">
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
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784 0-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        ))}
                      </div>

                      <span className="text-xs text-ink-muted">
                        ({course.reviews})
                      </span>
                    </div>

                    {/* =================================================
                        PRICE + ACTION
                    ================================================= */}

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <span
                        className="text-lg text-ink"
                        style={{
                          fontFamily: "var(--font-inter)",
                          fontWeight: 700,
                          letterSpacing: "-0.025em",
                        }}
                      >
                        {course.price > 0
                          ? formatPrice(course.price)
                          : "Gratis"}
                      </span>

                      <Button
                        href={`/courses/${course.slug}`}
                        variant="primary"
                        size="sm"
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        Lihat Detail
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

/* =========================================================
   ERROR ICON
========================================================= */

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-black"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5 21 19H3L12 3.5Z"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.5h.01"
      />
    </svg>
  );
}