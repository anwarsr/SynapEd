"use client";
import { useState } from "react";
import Link from "next/link";
import type { CourseDetail, Lesson } from "@/lib/courses";
import { lessonIcons } from "@/lib/courseUi";
import { formatBytes, storageDownloadUrl, toEmbedUrl } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

interface Props {
  course: CourseDetail;
  current: Lesson;
  prev: Lesson | null;
  next: Lesson | null;
  position: number;
  total: number;
}

const typeLabel: Record<string, string> = {
  video: "Video",
  reading: "Bacaan",
  quiz: "Kuis",
};

export default function LearnShell({ course, current, prev, next, position, total }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const progress = Math.round((position / total) * 100);

  const embedUrl = current.videoUrl ? toEmbedUrl(current.videoUrl) : null;
  const attachments = current.attachments ?? [];

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ── Bilah atas ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-navy text-paper">
        <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={sidebarOpen ? "Tutup daftar materi" : "Buka daftar materi"}
            aria-expanded={sidebarOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link
            href={`/courses/${course.slug}`}
            className="flex items-center gap-2 text-sm text-blue-100/80 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Keluar dari kelas</span>
          </Link>

          <span className="hidden md:block text-sm font-medium truncate">{course.title}</span>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="text-xs text-blue-100/70 tabular-nums">
              {position} / {total}
            </span>
            <div className="w-24 sm:w-40 h-1.5 rounded-full bg-white/15 overflow-hidden" role="presentation">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-warm"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar kurikulum ────────────────────────────── */}
        <aside
          className={cn(
            "w-80 shrink-0 border-r border-rule bg-paper-alt overflow-y-auto",
            "lg:block",
            sidebarOpen ? "fixed inset-y-14 left-0 z-30 block shadow-lift" : "hidden",
          )}
        >
          <div className="p-5">
            <p className="chapter-mark mb-4">
              <span aria-hidden="true" className="w-5 h-px bg-rule-strong" />
              <span>Daftar Materi</span>
            </p>

            {course.sections.map((section, si) => (
              <div key={section.position} className="mb-6">
                <p className="flex items-baseline gap-2 mb-2.5">
                  <span className="t-numeral-ghost text-sm text-ink-faint" aria-hidden="true">
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-ink">{section.title}</span>
                </p>

                <ul className="space-y-0.5">
                  {section.lessons.map((lesson) => {
                    const active = lesson.slug === current.slug;
                    return (
                      <li key={lesson.slug}>
                        <Link
                          href={`/courses/${course.slug}/learn/${lesson.slug}`}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-200",
                            active
                              ? "bg-blue-600 text-white"
                              : "text-ink-body hover:bg-blue-50 hover:text-blue-700",
                          )}
                        >
                          <svg
                            className={cn("w-4 h-4 mt-0.5 shrink-0", active ? "text-white" : "text-blue-600")}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d={lessonIcons[lesson.type] ?? lessonIcons.reading} />
                          </svg>
                          <span className="flex-1 leading-snug">{lesson.title}</span>
                          <span className={cn("text-[11px] shrink-0 mt-0.5", active ? "text-blue-100" : "text-ink-faint")}>
                            {lesson.duration}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Konten pelajaran ─────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="t-label text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                {typeLabel[current.type] ?? current.type}
              </span>
              <span className="text-xs text-ink-muted">{current.duration}</span>
              {current.free && (
                <span className="t-label text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">Gratis</span>
              )}
            </div>

            <h1 className="t-h2 mb-8">{current.title}</h1>

            {embedUrl ? (
              /* Rasio 16:9 dijaga lewat aspect-video supaya tidak bergeser
                 saat iframe dimuat. */
              <div className="aspect-video w-full rounded-3xl overflow-hidden border border-rule bg-navy mb-8">
                <iframe
                  src={embedUrl}
                  title={current.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              /* Keadaan kosong yang jujur: struktur pelajaran sudah ada di
                 Firestore, tapi videoUrl-nya belum diisi lewat Console. */
              <div
                className={cn(
                  "rounded-3xl border border-rule flex flex-col items-center justify-center text-center px-8 py-16 mb-8",
                  current.type === "video" ? "bg-navy" : "bg-paper-alt",
                )}
              >
                <svg
                  className={cn("w-12 h-12 mb-4", current.type === "video" ? "text-blue-300" : "text-blue-600")}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={lessonIcons[current.type] ?? lessonIcons.reading} />
                </svg>
                <p className={cn("t-h3 text-lg mb-2", current.type === "video" && "text-paper")}>
                  Materi belum tersedia
                </p>
                <p className={cn("text-sm max-w-sm", current.type === "video" ? "text-blue-100/70" : "text-ink-muted")}>
                  Struktur pelajaran sudah ada, tetapi tautan video dan berkasnya belum diunggah.
                </p>
              </div>
            )}

            {attachments.length > 0 && (
              <section className="mb-8">
                <h2 className="t-label text-ink-muted mb-3">Berkas Pendukung</h2>
                <ul className="space-y-2">
                  {attachments.map((file) => {
                    const size = formatBytes(file.size);
                    return (
                      <li key={file.path}>
                        <a
                          href={storageDownloadUrl(file.path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 rounded-2xl border border-rule bg-paper-card px-4 py-3 transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                        >
                          <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d={lessonIcons.reading} />
                            </svg>
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-ink truncate group-hover:text-blue-700 transition-colors">
                              {file.name}
                            </span>
                            {size && <span className="block text-xs text-ink-muted">{size}</span>}
                          </span>
                          <svg className="w-4 h-4 text-ink-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                          </svg>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Navigasi antar pelajaran */}
            <nav className="flex items-stretch gap-3 pt-6 border-t border-rule">
              {prev ? (
                <Link
                  href={`/courses/${course.slug}/learn/${prev.slug}`}
                  className="group flex-1 rounded-2xl border border-rule bg-paper-card p-4 transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                >
                  <span className="t-label text-ink-faint block mb-1">← Sebelumnya</span>
                  <span className="text-sm text-ink group-hover:text-blue-700 transition-colors line-clamp-1">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span className="flex-1" />
              )}

              {next ? (
                <Link
                  href={`/courses/${course.slug}/learn/${next.slug}`}
                  className="group flex-1 rounded-2xl border border-rule bg-paper-card p-4 text-right transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                >
                  <span className="t-label text-ink-faint block mb-1">Berikutnya →</span>
                  <span className="text-sm text-ink group-hover:text-blue-700 transition-colors line-clamp-1">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <span className="flex-1 rounded-2xl border border-rule bg-paper-alt p-4 text-right">
                  <span className="t-label text-ink-faint block mb-1">Selesai</span>
                  <span className="text-sm text-ink-muted">Pelajaran terakhir</span>
                </span>
              )}
            </nav>
          </div>
        </main>
      </div>
    </div>
  );
}
