"use client";

import { useState } from "react";
import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import type { Category, CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";
import CourseCard from "@/components/courses/CourseCard";

interface Props {
  courses: CourseSummary[];
  categories: Category[];
}

/* =========================================================
   COMPONENT
========================================================= */

const CARD_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
};

export default function Courses({ courses, categories }: Props) {
  const [filter, setFilter] = useState("semua");

  const filtered =
    filter === "semua"
      ? courses
      : courses.filter((c) => c.category === filter);

  return (
    <section
      id="courses"
      className="relative overflow-hidden bg-ivory py-28"
    >
      {/* =====================================================
          PAPER TEXTURE
      ===================================================== */}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #4C8DFF 0.65px, transparent 0.65px)",
            backgroundSize: "18px 18px",
          }}
        />
      </div>

      <div className="container-page relative z-10">
        {/* =====================================================
            HEADING
        ===================================================== */}

        <div className="flex flex-col items-center">
          <Reveal>
            <SectionTitle title="Courses" />
          </Reveal>
        </div>

        {/* =====================================================
            FILTER
        ===================================================== */}

        {categories.length > 1 && (
          <Reveal delay={180}>
            <div className="mt-10 flex justify-center">
              <div className="inline-flex max-w-full flex-wrap justify-center bg-paper-card">
              {categories.map((cat) => {
                const active = filter === cat.slug;

                return (
                  <button
                    key={cat.slug}
                    onClick={() => setFilter(cat.slug)}
                    aria-pressed={active}
                    className={cn(
                      "px-6 py-3 text-sm transition-colors duration-300 ease-out-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
                      active
                        ? "bg-blue-600 text-white"
                        : "text-ink-muted hover:bg-white/5 hover:text-white",
                    )}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
              </div>
            </div>
          </Reveal>
        )}

        {/* =====================================================
            EMPTY STATE
        ===================================================== */}

        {filtered.length === 0 ? (
          <Reveal className="mt-12">
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-paper-card px-8 py-20 text-center">
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
                {/* Garis tipis penanda, menggantikan ikon */}
                <span aria-hidden="true" className="courses-glitch-icon mx-auto mb-9 block h-px w-14 bg-white/35" />

                {/* =================================================
                    TITLE
                ================================================= */}

                <div className="relative mx-auto inline-block">
                  {/* Glitch layer 1 */}
                  <p
                    aria-hidden="true"
                    className="courses-glitch-title-1 pointer-events-none absolute inset-0 text-[clamp(1.75rem,4vw,2.6rem)] text-[#ff2e63]"
                    style={CARD_TITLE}
                  >
                    Belum ada materi di sini.
                  </p>

                  {/* Glitch layer 2 */}
                  <p
                    aria-hidden="true"
                    className="courses-glitch-title-2 pointer-events-none absolute inset-0 text-[clamp(1.75rem,4vw,2.6rem)] text-[#08f7fe]"
                    style={CARD_TITLE}
                  >
                    Belum ada materi di sini.
                  </p>

                  {/* Main */}
                  <p
                    className="courses-glitch-title relative mb-4 text-[clamp(1.75rem,4vw,2.6rem)] text-white"
                    style={CARD_TITLE}
                  >
                    Belum ada materi di sini.
                  </p>
                </div>

                {/* =================================================
                    DESCRIPTION
                ================================================= */}

                <p className="courses-glitch-description t-body mx-auto max-w-md text-sm text-ink-muted">
                  Materi untuk kategori ini sedang disiapkan - coba lihat
                  kategori lain, atau kembali lagi sebentar.
                </p>

                {/* =================================================
                    STATUS
                ================================================= */}

                <div className="courses-glitch-indicator mx-auto mt-7 flex items-center justify-center gap-2">
                  <span className="h-1.5 w-1.5 bg-white/40" />
                  <span className="h-1.5 w-6 bg-white/15" />
                  <span className="h-1.5 w-3 bg-white/25" />
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
                      #fff 4px
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
                  background: rgba(255, 255, 255, 0.08);
                  animation: coursesBarOne 2.4s steps(1) infinite;
                }

                .courses-glitch-bar-2 {
                  top: 52%;
                  height: 1px;
                  background: rgba(255, 255, 255, 0.1);
                  animation: coursesBarTwo 1.8s steps(1) infinite;
                }

                .courses-glitch-bar-3 {
                  top: 73%;
                  height: 2px;
                  background: rgba(255, 255, 255, 0.06);
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
                  background: rgba(255, 255, 255, 0.06);
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
                <CourseCard course={course} nomor={index + 1} />
              </Reveal>
            ))}
          </div>
        )}

        {/* Pintu ke katalog lengkap: seluruh kursus + pencarian + filter */}
        <div className="mt-14 flex justify-center">
          <Link
            href="/courses"
            className="group inline-flex items-center gap-2.5 bg-white/10 px-8 py-4 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-600"
          >
            Lihat semua kursus
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   ERROR ICON
========================================================= */
