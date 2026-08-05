"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import SectionHeader from "@/components/ui/SectionHeader";
import Tag from "@/components/ui/Tag";
import type { Category, CourseSummary } from "@/lib/courses";
import { levelTone } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

interface Props {
  courses: CourseSummary[];
  categories: Category[];
}

export default function Courses({ courses, categories }: Props) {
  const [filter, setFilter] = useState("semua");

  // Katalognya kecil, jadi disaring di klien — filter terasa instan
  // tanpa perlu bolak-balik ke server.
  const filtered = filter === "semua" ? courses : courses.filter((c) => c.category === filter);

  return (
    <section id="courses" className="relative py-28 bg-paper overflow-hidden">
      {/* Kertas grafik tipis — motif buku catatan, bukan grid techy */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-rule) 1px, transparent 1px), linear-gradient(to bottom, var(--color-rule) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 60%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 60%, transparent 100%)",
        }}
      />

      <div className="relative container-page">
        <SectionHeader
          chapter="03"
          label="Materi"
          sub="Berbagai modul terstruktur dari level dasar hingga lanjutan, dirancang untuk pengalaman belajar yang optimal."
        >
          Materi <span className="mark">pembelajaran</span>
        </SectionHeader>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setFilter(cat.slug)}
              aria-pressed={filter === cat.slug}
              className={cn(
                "px-5 py-2 rounded-full text-sm border transition-colors duration-200 ease-out-soft",
                filter === cat.slug
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-paper-card border-rule text-ink-body hover:border-blue-500 hover:text-blue-700",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((course, index) => (
            <Reveal key={course.slug} delay={index * 100} className="h-full">
              <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden group flex flex-col h-full transition-all duration-300 ease-out-soft hover:border-rule-strong hover:shadow-lift hover:-translate-y-1.5">
                <div
                  className={cn(
                    "relative h-40 w-full flex justify-center items-end overflow-hidden pt-4 border-b border-rule",
                    course.tint,
                  )}
                >
                  <svg className="absolute bottom-0 w-full z-0 opacity-40" viewBox="0 0 400 150" fill="none" aria-hidden="true">
                    <path d="M-20 150C-20 150 150 30 420 150" className="stroke-rule-strong" strokeWidth="40" />
                    <path d="M20 150C20 150 180 60 380 150" className="stroke-blue-300" strokeWidth="20" />
                    <path d="M60 150C60 150 210 90 340 150" className="stroke-rule" strokeWidth="60" />
                  </svg>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.dicebear.com/8.x/notionists/svg?seed=${encodeURIComponent(course.title)}&size=150&backgroundColor=transparent`}
                    className="relative z-10 h-32 w-auto object-contain transition-transform duration-200 ease-out-soft group-hover:-translate-y-1"
                    alt=""
                  />
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <h3 className="t-h3 text-lg mb-2">{course.title}</h3>
                  <p className="t-body text-sm line-clamp-2 mb-5">{course.shortDesc}</p>

                  <div className="mt-auto space-y-1 mb-5 text-[13px] text-ink-muted">
                    <div>
                      <span className="text-ink font-medium">{course.lessonsCount}</span> modul pelajaran
                    </div>
                    <div>
                      <span className="text-ink font-medium">{course.duration}</span> estimasi durasi
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-5 pb-5 border-b border-rule">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink font-medium text-sm">{course.rating}</span>
                      <div className="flex gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg
                            key={s}
                            className={cn(
                              "w-3 h-3",
                              s <= Math.round(course.rating) ? "text-amber-500" : "text-rule-strong",
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
                    <Tag tone={levelTone(course.levelColor)}>{course.level}</Tag>
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
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
