"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import Tag from "@/components/ui/Tag";
import type { Category, CourseSummary } from "@/lib/courses";
import { levelTone } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

interface Props {
  courses: CourseSummary[];
  categories: Category[];
}

/** Tipografi judul disamakan dengan About.tsx: Inter tebal, tracking
 *  rapat, biru identitas — bukan serif Fraunces. */
const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
  fontWeight: 800,
  lineHeight: 1.03,
  letterSpacing: "-0.04em",
};

const CARD_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 900,
  letterSpacing: "-0.025em",
};

export default function Courses({ courses, categories }: Props) {
  const [filter, setFilter] = useState("semua");

  // Katalognya kecil, jadi disaring di klien — filter terasa instan
  // tanpa perlu bolak-balik ke server.
  const filtered = filter === "semua" ? courses : courses.filter((c) => c.category === filter);

  return (
    <section id="courses" className="bg-paper py-28">
      <div className="container-page">
        <Reveal>
          <h2 className="text-blue-600 max-w-4xl" style={HEADING}>
            Materi Pembelajaran
          </h2>
        </Reveal>

        <Reveal delay={110}>
          <p className="t-body mt-6 max-w-2xl text-ink-muted">
            Berbagai modul terstruktur dari level dasar hingga lanjutan, dirancang untuk pengalaman
            belajar yang optimal.
          </p>
        </Reveal>

        {categories.length > 1 && (
          <Reveal delay={180}>
            <div className="flex flex-wrap gap-2 mt-10">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setFilter(cat.slug)}
                  aria-pressed={filter === cat.slug}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-sm border transition-all duration-200 ease-out-soft",
                    filter === cat.slug
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-paper-card border-blue-100 text-ink-body hover:border-blue-600 hover:text-blue-600",
                  )}
                  style={{ fontFamily: "var(--font-inter)", fontWeight: 600, letterSpacing: "-0.01em" }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </Reveal>
        )}

        {filtered.length === 0 ? (
          <Reveal className="mt-12 border border-blue-100 rounded-2xl bg-paper-card py-20 px-8 text-center">
            <p className="text-black text-2xl mb-3" style={CARD_TITLE}>
              Belum ada materi di sini.
            </p>
            <p className="t-body text-sm text-ink-muted max-w-md mx-auto">
              Materi untuk kategori ini sedang disiapkan — coba lihat kategori lain, atau kembali
              lagi sebentar lagi.
            </p>
          </Reveal>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {filtered.map((course, index) => (
              <Reveal key={course.slug} delay={(index % 3) * 110} className="h-full">
                <article className="group h-full flex flex-col overflow-hidden rounded-2xl border border-blue-100 bg-paper-card transition-all duration-400 ease-warm hover:border-blue-600 hover:shadow-lift hover:-translate-y-1.5">
                  <div className={cn("relative h-44 overflow-hidden", course.tint || "bg-blue-50")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/8.x/notionists/svg?seed=${encodeURIComponent(course.title)}&size=200&backgroundColor=transparent`}
                      className="absolute inset-0 h-full w-full object-contain p-5 transition-transform duration-700 ease-warm group-hover:scale-105"
                      alt=""
                    />

                    {/* Nomor bulat biru pekat — motif yang sama dengan About.tsx. */}
                    <span
                      className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-xs shadow-lift"
                      style={{ fontFamily: "var(--font-inter)", fontWeight: 800 }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="absolute bottom-4 right-4">
                      <Tag tone={levelTone(course.levelColor)}>{course.level}</Tag>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-blue-600 text-xl leading-tight mb-2" style={CARD_TITLE}>
                      {course.title}
                    </h3>
                    <p className="t-body text-sm line-clamp-2 mb-6">{course.shortDesc}</p>

                    <div className="mt-auto flex items-center gap-4 text-[13px] text-ink-muted mb-5">
                      <span>
                        <span className="text-ink font-semibold">{course.lessonsCount}</span> modul
                      </span>
                      <span aria-hidden="true" className="h-3 w-px bg-blue-100" />
                      <span>
                        <span className="text-ink font-semibold">{course.duration}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-5 pb-5 border-b border-blue-100">
                      <span className="text-ink font-semibold text-sm">{course.rating}</span>
                      <div className="flex gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg
                            key={s}
                            className={cn(
                              "w-3 h-3",
                              s <= Math.round(course.rating) ? "text-amber-500" : "text-blue-100",
                            )}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-ink-muted text-xs">({course.reviews})</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button href={`/courses/${course.slug}`} variant="outline" size="sm">
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
