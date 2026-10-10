import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/ui/Reveal";
import { EnrolledCourses, JoinedClasses, CreatedCourses } from "@/components/profile/ProfileCourses";
import ClassCard from "@/components/classes/ClassCard";
import EnrolledCourseCard from "@/components/dashboard/EnrolledCourseCard";
import { listMyEnrollments } from "@/lib/enrollments";
import { listMyClasses, listOwnedClasses } from "@/lib/classes";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { listCourses } from "@/lib/courses";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Dashboard: kursus dan kelas yang SEDANG diikuti - dan, untuk educator/admin,
 * juga yang DIBUAT (kursus + kelas), supaya satu halaman cukup untuk dua peran.
 *
 * Pendapatan royalti (dulu isi halaman ini) pindah ke /dashboard/pendapatan dan
 * dijangkau lewat tombol khusus di kanan atas — tidak semua akun punya
 * pendapatan, tetapi semua akun mengikuti sesuatu.
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const pengajar = user.role === "educator" || user.role === "admin";

  const [enrollments, kelas, katalog, kursusDibuat, kelasDibuat] = await Promise.all([
    listMyEnrollments(user.uid),
    listMyClasses(user.uid),
    listCourses(),
    pengajar ? listOwnedCourses(user.uid, user.name) : Promise.resolve([]),
    pengajar ? listOwnedClasses(user.uid) : Promise.resolve([]),
  ]);

  // Gambar, pembuat, dan deskripsi ada di katalog, bukan di snapshot enrollment.
  const kursus = new Map(katalog.map((c) => [c.slug, c]));

  const selesai = enrollments.filter((e) => e.status === "completed").length;

  const angka = [
    { nilai: enrollments.length, label: "Kursus diikuti" },
    { nilai: selesai, label: "Kursus selesai" },
    { nilai: kelas.length, label: "Kelas diikuti" },
    ...(pengajar
      ? [
          { nilai: kursusDibuat.length, label: "Kursus dibuat" },
          { nilai: kelasDibuat.length, label: "Kelas dibuat" },
        ]
      : []),
  ];

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-paper pb-28 pt-36">
        <div className="container-page">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="mb-4 text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
                Dashboard
              </h1>
              <p className="t-body max-w-[56ch] text-ink-muted">
                {pengajar
                  ? "Yang Anda ikuti dan yang Anda buat - kursus maupun kelas - dalam satu tempat."
                  : "Kursus dan kelas yang sedang Anda ikuti, dalam satu tempat."}
              </p>
            </div>

            {/* Pintu khusus ke pendapatan royalti, referral, dan penjualan */}
            <Link
              href="/dashboard/pendapatan"
              className="group inline-flex items-center gap-2.5 bg-blue-600 px-7 py-4 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
            >
              Pendapatan
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          <dl className="mb-16 grid gap-1 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
            {angka.map((k) => (
              <div key={k.label} className="bg-paper-card px-7 py-6">
                <dd className="t-numeral text-[34px] tabular-nums text-white">{k.nilai.toLocaleString("id-ID")}</dd>
                <dt className="mt-2 text-[12.5px] text-ink-muted">{k.label}</dt>
              </div>
            ))}
          </dl>

          <div className="grid gap-14 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] lg:gap-14">
            <Reveal>
              <section>
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="t-h3">Kursus yang Diikuti</h2>
                  <Link href="/courses" className="bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15">
                    Jelajahi katalog
                  </Link>
                </div>
                {enrollments.length === 0 ? (
                  <EnrolledCourses enrollments={enrollments} />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {enrollments.map((e) => (
                      <EnrolledCourseCard key={e.courseSlug} enrollment={e} course={kursus.get(e.courseSlug) ?? null} />
                    ))}
                  </div>
                )}

              </section>
            </Reveal>

            <Reveal delay={90}>
              <section>
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="t-h3">Kelas yang Diikuti</h2>
                  <Link href="/kelas" className="bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15">
                    Kelola kelas
                  </Link>
                </div>
                <JoinedClasses kelas={kelas} />

              </section>
            </Reveal>
          </div>

          {/* Khusus educator/admin: yang DIBUAT, bukan hanya yang diikuti */}
          {pengajar && (
            <div className="mt-20 grid gap-14 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] lg:gap-14">
              <Reveal>
                <section>
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
                    <h2 className="t-h3">Kursus yang Dibuat</h2>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/educator/courses" className="bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15">
                        Kelola
                      </Link>
                      <Link href="/educator/courses/new" className="bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700">
                        Buat kursus
                      </Link>
                    </div>
                  </div>
                  <CreatedCourses courses={kursusDibuat} own kelola />
                </section>
              </Reveal>

              <Reveal delay={90}>
                <section>
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
                    <h2 className="t-h3">Kelas yang Dibuat</h2>
                    <Link href="/educator/classes" className="bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700">
                      Kelola kelas
                    </Link>
                  </div>
                  {kelasDibuat.length === 0 ? (
                    <p className="bg-white/5 px-5 py-6 text-center text-[13px] text-ink-muted">
                      Belum membuat kelas. Buat satu, lalu bagikan kode undangannya kepada peserta.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {kelasDibuat.map((k) => (
                        <ClassCard key={k.id} kelas={k} href={`/educator/classes/${k.id}`} peran="Pengajar" />
                      ))}
                    </div>
                  )}
                </section>
              </Reveal>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
