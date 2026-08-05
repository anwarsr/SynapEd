import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { listCourses } from "@/lib/courses";
import { iconPaths, levelTone } from "@/lib/courseUi";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Semua Kursus – SynapEd",
};

// Lihat catatan di app/page.tsx — katalog dari DB tidak boleh dibekukan
// saat build, dan build tidak boleh bergantung pada API yang hidup.
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listCourses();

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center mb-16">
            <p className="chapter-mark mb-5">
              <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
              <span>Kurikulum Lengkap</span>
              <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            </p>

            <h1 className="t-display">
              <span className="mark">Jelajahi</span> semua kursus
            </h1>

            <span className="rule-accent mt-8 mx-auto" aria-hidden="true" />

            <p className="t-body mt-6 max-w-xl text-ink-muted">
              {courses.length} modul terstruktur dari level dasar hingga analisis lanjutan.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {courses.map((course) => (
              <div
                key={course.slug}
                className="bg-paper-card border border-rule rounded-2xl overflow-hidden flex flex-col transition-[border-color,box-shadow] duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft"
              >
                <div className={cn("h-32 flex items-center justify-center border-b border-rule", course.tint)}>
                  <svg
                    className="w-12 h-12 text-blue-600/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[course.icon] ?? iconPaths.reading} />
                  </svg>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="t-h3 text-base mb-2">{course.title}</h2>
                  <p className="t-body text-sm line-clamp-2 mb-5">{course.shortDesc}</p>

                  <div className="mt-auto flex items-center justify-between text-xs text-ink-muted mb-4">
                    <span>{course.lessonsCount} pelajaran</span>
                    <span>{course.duration}</span>
                  </div>

                  <div className="flex items-center justify-between mb-5 pb-5 border-b border-rule">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-ink">{course.rating}</span>
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <Tag tone={levelTone(course.levelColor)}>{course.level}</Tag>
                  </div>

                  <Button href={`/courses/${course.slug}`} variant="primary" size="sm" className="w-full">
                    Lihat Detail
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
