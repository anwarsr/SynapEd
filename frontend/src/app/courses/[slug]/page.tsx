import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import EnrollButton from "@/components/courses/EnrollButton";
import { getCourse } from "@/lib/courses";
import { getCourseAccess } from "@/lib/courseAccess";
import { formatPrice, iconPaths, lessonIcons, levelTone } from "@/lib/courseUi";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Tidak ada generateStaticParams: katalog hidup di Firestore, jadi
 * membekukan daftar slug saat build berarti kursus baru tidak muncul
 * sampai di-rebuild. Halaman ini dirender saat diminta.
 */

// Tombol aksinya bergantung pada sesi dan status pendaftaran, jadi halaman
// ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  return {
    title: course ? `${course.title} – SynapEd` : "Kursus – SynapEd",
    description: course?.shortDesc,
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const totalLessons = course.lessonsCount;

  // null = belum masuk. Pengunjung yang belum punya akun tetap melihat
  // seluruh halaman ini — hanya tombolnya yang berbeda.
  const access = await getCourseAccess(slug);
  const enrolled = access?.level === "full";
  const resumeSlug = access?.enrollment?.lastLessonSlug;

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-32 pb-24">
        <div className="container-reading">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-10">
            <Link href="/" className="hover:text-blue-700 transition-colors">Beranda</Link>
            <span aria-hidden="true">/</span>
            <Link href="/courses" className="hover:text-blue-700 transition-colors">Kursus</Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink">{course.title}</span>
          </nav>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-paper-card border border-rule rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-5">
                  <Tag tone={levelTone(course.levelColor)}>{course.level}</Tag>
                  <span className="t-label text-ink-faint">{course.category}</span>
                </div>

                <h1 className="t-h2 mb-5">{course.title}</h1>
                <p className="t-body">{course.longDesc}</p>

                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-8 pt-6 border-t border-rule text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths.reading} />
                    </svg>
                    <span>{totalLessons} Pelajaran</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span>{course.rating} ({course.reviews} ulasan)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{course.enrolledStudents.toLocaleString("id-ID")} peserta</span>
                  </div>
                </div>
              </div>

              <div className="bg-paper-card border border-rule rounded-2xl p-8">
                <h2 className="t-h3 mb-6">Yang Akan Anda Pelajari</h2>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3.5">
                  {course.whatYouLearn.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-ink-body leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-paper-card border border-rule rounded-2xl p-8">
                <h2 className="t-h3 mb-6">Kurikulum</h2>
                <div className="space-y-4">
                  {course.sections.map((section, si) => (
                    <div key={section.position} className="border border-rule rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 bg-paper-alt flex items-center gap-3">
                        <span className="t-numeral-ghost text-xl text-ink-faint" aria-hidden="true">
                          {String(si + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-medium text-ink">{section.title}</span>
                        <span className="text-xs text-ink-muted ml-auto">
                          {section.lessons.length} pelajaran
                        </span>
                      </div>

                      <ul className="divide-y divide-rule">
                        {section.lessons.map((lesson) => (
                          <li key={lesson.slug} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d={lessonIcons[lesson.type] ?? lessonIcons.reading} />
                              </svg>
                              <span className="text-ink-body truncate">{lesson.title}</span>
                              {lesson.free && <Tag tone="amber">Gratis</Tag>}
                            </div>
                            <span className="text-xs text-ink-muted flex-shrink-0">{lesson.duration}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside>
              <div className="bg-paper-card border border-rule rounded-2xl p-6 sticky top-28">
                <div className={cn("h-36 rounded-2xl flex items-center justify-center mb-6", course.tint)}>
                  <svg className="w-16 h-16 text-blue-600/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[course.icon] ?? iconPaths.reading} />
                  </svg>
                </div>

                <h2 className="t-h3 text-lg mb-1.5">{course.title}</h2>
                <p className="text-sm text-ink-muted mb-4">oleh {course.instructorName}</p>

                <p className="t-numeral text-2xl mb-6">
                  {course.price > 0 ? formatPrice(course.price) : "Gratis"}
                </p>

                <div className="flex flex-col gap-2.5">
                  {enrolled ? (
                    <Button
                      href={`/courses/${slug}/learn${resumeSlug ? `/${resumeSlug}` : ""}`}
                      variant="primary"
                      className="w-full"
                    >
                      Lanjutkan Belajar
                    </Button>
                  ) : !access ? (
                    // Belum masuk. Bawa ke login dengan ?next= supaya kembali
                    // ke halaman ini setelah masuk, bukan ke beranda.
                    <Button
                      href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}
                      variant="primary"
                      className="w-full"
                    >
                      Masuk untuk Mendaftar
                    </Button>
                  ) : course.price > 0 ? (
                    // Pembayaran belum ada. Katakan apa adanya alih-alih
                    // menyodorkan tombol yang tidak melakukan apa-apa.
                    <span className="w-full rounded-lg border border-rule bg-paper-alt px-6 py-3 text-center text-sm text-ink-muted">
                      Pembayaran segera hadir
                    </span>
                  ) : (
                    <EnrollButton slug={slug} />
                  )}

                  <Button href="/courses" variant="outline" className="w-full">
                    Lihat Kursus Lain
                  </Button>
                </div>

                <div className="mt-7 pt-6 border-t border-rule">
                  <h3 className="t-label text-ink-muted mb-4">Persyaratan</h3>
                  <ul className="space-y-2.5">
                    {course.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-ink-body leading-relaxed">
                        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {course.lastUpdated && (
                  <p className="mt-6 pt-5 border-t border-rule text-xs text-ink-muted">
                    Terakhir diperbarui {course.lastUpdated}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
