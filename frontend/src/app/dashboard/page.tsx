import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Tag from "@/components/ui/Tag";
import {
  DeleteAccount,
  EmailForm,
  PasswordForm,
  ProfileForm,
} from "@/components/dashboard/AccountForms";
import { AvatarForm, PhoneForm } from "@/components/dashboard/ProfileMedia";
import LogoutButton from "@/components/dashboard/LogoutButton";
import SignInMethodsCard from "@/components/dashboard/SignInMethodsCard";
import EducatorStatus from "@/components/dashboard/EducatorStatus";
import { getSignInMethods } from "@/lib/accountProviders";
import { listMyEnrollments, progressFromSnapshot } from "@/lib/enrollments";
import { getApplication } from "@/lib/educator";
import { requireUser } from "@/lib/firebase/session";
import { iconPaths, levelTone } from "@/lib/courseUi";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profil Saya – SynapEd" };

// Sesi ada di cookie, jadi halaman ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const [enrollments, application, methods] = await Promise.all([
    listMyEnrollments(user.uid),
    getApplication(user.uid),
    getSignInMethods(user.uid),
  ]);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Akun Saya</span>
          </p>

          {/* Keluar ditaruh sebaris dengan sapaan: navbar sekarang hanya
              menampilkan ikon profil, jadi inilah jalan keluarnya. */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <h1 className="t-h2">
              Halo, <span className="mark">{user.name}</span>
            </h1>
            <LogoutButton />
          </div>
          <p className="t-body text-ink-muted mb-10">{user.email}</p>

          <EducatorStatus role={user.role} status={application?.status ?? null} />

          {/* Angka kemajuan di sini dihitung dari pelajaran yang benar-benar
              ditandai selesai. Dashboard Laravel dulu menampilkan 65% & 30%
              yang ditulis tangan di controller — itulah yang digantikan. */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="t-h3">Kursus Saya</h2>
              <Link href="/courses" className="text-sm text-blue-700 hover:underline underline-offset-4">
                Jelajahi katalog →
              </Link>
            </div>

            {enrollments.length === 0 ? (
              <div className="rounded-2xl border border-rule bg-paper-alt px-6 py-10 text-center">
                <p className="t-h3 text-lg mb-2">Belum mengikuti kursus</p>
                <p className="text-sm text-ink-muted mb-6">
                  Pilih satu dari katalog untuk mulai belajar.
                </p>
                <Link
                  href="/courses"
                  className="inline-flex rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
                >
                  Lihat Kursus
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {enrollments.map((e) => {
                  const progress = progressFromSnapshot(e);

                  return (
                    <Link
                      key={e.courseSlug}
                      href={`/courses/${e.courseSlug}/learn${e.lastLessonSlug ? `/${e.lastLessonSlug}` : ""}`}
                      className="group bg-paper-card border border-rule rounded-2xl p-4 transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft hover:-translate-y-0.5"
                    >
                      <span className="flex items-center gap-4">
                        <span
                          className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                            e.courseTint,
                          )}
                        >
                          <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[e.courseIcon] ?? iconPaths.reading} />
                          </svg>
                        </span>

                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-ink truncate">
                            {e.courseTitle}
                          </span>
                          <span className="block text-xs text-ink-muted mt-0.5">
                            {progress.done} dari {progress.total} pelajaran
                          </span>
                        </span>

                        <Tag tone={levelTone(e.courseLevelColor)}>{e.courseLevel}</Tag>
                      </span>

                      <span className="flex items-center gap-3 mt-4">
                        <span className="flex-1 h-1.5 rounded-full bg-paper-alt overflow-hidden" role="presentation">
                          <span
                            className="block h-full rounded-full bg-blue-600 transition-all duration-500 ease-warm"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </span>
                        <span className="t-numeral text-xs text-ink-muted tabular-nums shrink-0">
                          {progress.percent}%
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <hr className="rule-line mb-12" />

          <section className="space-y-5">
            <h2 className="t-h3 mb-5">Pengaturan Akun</h2>
            <AvatarForm user={user} />
            <ProfileForm user={user} />
            <PhoneForm user={user} />
            <SignInMethodsCard methods={methods} emailVerified={user.emailVerified} />
            <EmailForm user={user} methods={methods} />
            <PasswordForm methods={methods} />
            <DeleteAccount methods={methods} />
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
