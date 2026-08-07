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
import { listCourses } from "@/lib/courses";
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
  const [courses, application, methods] = await Promise.all([
    listCourses(),
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

          {/* Katalog tanpa angka kemajuan. Dashboard Laravel dulu menampilkan
              progres 65% & 30%, tapi keduanya ditulis tangan di controller.
              Enrollment belum ada, jadi angka itu tidak ditiru di sini. */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="t-h3">Kursus Tersedia</h2>
              <Link href="/courses" className="text-sm text-blue-700 hover:underline underline-offset-4">
                Lihat semua →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {courses.map((c) => (
                <Link
                  key={c.slug}
                  href={`/courses/${c.slug}/learn`}
                  className="group flex items-center gap-4 bg-paper-card border border-rule rounded-2xl p-4 transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft hover:-translate-y-0.5"
                >
                  <span
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                      c.tint,
                    )}
                  >
                    <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[c.icon] ?? iconPaths.reading} />
                    </svg>
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{c.title}</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      {c.lessonsCount} pelajaran · {c.duration}
                    </span>
                  </span>

                  <Tag tone={levelTone(c.levelColor)}>{c.level}</Tag>

                  <svg className="w-4 h-4 text-ink-faint flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
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
