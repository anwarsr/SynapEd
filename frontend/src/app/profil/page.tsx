import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/ui/Reveal";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileStatsRow from "@/components/profile/ProfileStats";
import EducationList from "@/components/profile/EducationList";
import ResumeCard from "@/components/profile/ResumeCard";
import CertificateList from "@/components/profile/CertificateList";
import {
  EnrolledCourses,
  JoinedClasses,
  OwnedCourses,
} from "@/components/profile/ProfileCourses";
import EducatorStatus from "@/components/dashboard/EducatorStatus";
import LogoutButton from "@/components/dashboard/LogoutButton";
import ThemeSwitch from "@/components/profile/ThemeSwitch";
import LanguageSwitch from "@/components/profile/LanguageSwitch";
import { listCourses } from "@/lib/courses";
import { listMyEnrollments } from "@/lib/enrollments";
import { getUsernameInfo } from "@/lib/usernames";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { listMyClasses } from "@/lib/classes";
import { listMyCertificates } from "@/lib/certificates";
import { getApplication } from "@/lib/educator";
import { getProfileStats, getUserProfile, joinedAtOf } from "@/lib/userProfile";
import { adminAuth } from "@/lib/firebase/admin";
import { getBannerURL } from "@/lib/banner";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profil Saya – SynapEd" };

// Sesi ada di cookie, jadi halaman ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

/** Judul section + tautan kanan, dipakai empat kali di halaman ini. */
function SectionHead({
  judul,
  aksi,
}: {
  judul: string;
  aksi?: { href: string; label: string };
}) {
  return (
    <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
      <h2 className="t-h3">{judul}</h2>
      {aksi && (
        <Link
          href={aksi.href}
          className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
        >
          {aksi.label}
        </Link>
      )}
    </div>
  );
}

/** Judul kecil untuk kolom sidebar. */
function SideHead({ judul }: { judul: string }) {
  return <h2 className="t-label text-ink-muted mb-4">{judul}</h2>;
}

/**
 * Halaman profil — versi pemiliknya sendiri.
 *
 * Sengaja dibangun dari komponen yang seluruh datanya datang lewat props,
 * bukan yang membaca sesi masing-masing. `/profil/[uid]` memakai komponen yang
 * sama dengan `showEmail` dimatikan dan aksinya diganti.
 */
export default async function ProfilePage() {
  const user = await requireUser("/profil");
  const isEducator = user.role === "educator" || user.role === "admin";

  const [profile, stats, enrollments, owned, kelas, sertifikat, application, akun, handle, bannerURL, katalog] =
    await Promise.all([
      getUserProfile(user.uid),
      getProfileStats(user.uid, isEducator),
      listMyEnrollments(user.uid),
      isEducator ? listOwnedCourses(user.uid) : Promise.resolve([]),
      listMyClasses(user.uid),
      listMyCertificates(user.uid),
      getApplication(user.uid),
      adminAuth()
        .getUser(user.uid)
        .catch(() => null),
      getUsernameInfo(user.uid),
      getBannerURL(user.uid).catch(() => null),
      listCourses().catch(() => []),
    ]);

  // Gambar kursus untuk mini ikon "Kursus yang Diikuti" (sama dengan kartu katalog).
  const gambar = Object.fromEntries(katalog.map((c) => [c.slug, c.thumbnail]));

  // listMyEnrollments sudah terurut lastAccessedAt menurun, jadi yang pertama
  // dan belum selesai adalah yang paling terakhir disentuh.
  const lanjut = enrollments.find((e) => e.status !== "completed");

  const bergabung = joinedAtOf(akun?.metadata?.creationTime);

  return (
    <>
      <Navbar />

      <main className="bg-paper">
        <ProfileHeader
          name={user.name}
          username={handle.username}
          email={user.email}
          photoURL={user.photoURL}
          bannerURL={bannerURL}
          bannerEditable
          role={user.role}
          bio={profile.bio}
          skills={profile.skills}
          meta={bergabung ? `Bergabung ${bergabung}` : undefined}
          utama={
            isEducator
              ? { label: "Kursus Saya", href: "/educator/courses" }
              : lanjut
                ? {
                    label: "Lanjutkan Belajar",
                    href: `/courses/${lanjut.courseSlug}/learn${
                      lanjut.lastLessonSlug ? `/${lanjut.lastLessonSlug}` : ""
                    }`,
                  }
                : { label: "Lihat Kursus", href: "/courses" }
          }
          sekunder={{ label: "Edit Profil", href: "/profil/edit" }}
          showEmail
        />

        <div className="container-reading">
          <ProfileStatsRow stats={stats} isEducator={isEducator} />

          <div className="flex flex-wrap items-start gap-14 pt-16 pb-[88px]">
            {/* ── Kolom utama ─────────────────────────────────────── */}
            <div className="flex min-w-0 flex-1 basis-[440px] flex-col gap-14">
              {!isEducator && lanjut && (
                <Reveal>
                  <section>
                    <SectionHead judul="Lanjutkan Belajar" />
                    <ResumeCard enrollment={lanjut} />
                  </section>
                </Reveal>
              )}

              {isEducator && (
                <Reveal delay={60}>
                  <section>
                    <SectionHead
                      judul="Kursus yang Dibuat"
                      aksi={{ href: "/educator/courses", label: "Kelola kursus" }}
                    />
                    <OwnedCourses courses={owned} own />
                  </section>
                </Reveal>
              )}

              <Reveal delay={120}>
                <section>
                  <SectionHead
                    judul="Kursus yang Diikuti"
                    aksi={{ href: "/courses", label: "Jelajahi katalog" }}
                  />
                  <EnrolledCourses enrollments={enrollments} gambar={gambar} />
                </section>
              </Reveal>
            </div>

            {/* ── Sidebar ─────────────────────────────────────────── */}
            <aside className="flex w-full flex-1 basis-72 flex-col gap-10 lg:sticky lg:top-28">
              <EducatorStatus role={user.role} status={application?.status ?? null} />

              <section>
                <SideHead judul="Riwayat Pendidikan" />
                <EducationList items={profile.education} />
              </section>

              <section>
                <SideHead judul="Sertifikat" />
                <CertificateList items={sertifikat} />
              </section>

              <section>
                <SideHead judul="Kelas yang Diikuti" />
                <JoinedClasses kelas={kelas} />
              </section>

              <section>
                <SideHead judul="Pengaturan Laman" />
                <p className="mb-2 text-[12.5px] text-ink-muted">Tampilan</p>
                <ThemeSwitch />
                <p className="mb-2 mt-5 text-[12.5px] text-ink-muted">Bahasa</p>
                <LanguageSwitch />
              </section>

              {/* Aksi akun ditaruh paling bawah: profil dibaca dulu, baru
                  disunting. Keluar sengaja tetap di sini dan bukan di navbar,
                  supaya aksi merusak tidak berdampingan dengan tautan biasa. */}
              <section className="pt-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href="/dashboard/pendapatan"
                    className="bg-white/10 px-5 py-[11px] text-[13.5px] font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
                  >
                    Pendapatan
                  </Link>
                  <Link
                    href="/pengaturan"
                    className="bg-white/10 px-5 py-[11px] text-[13.5px] font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
                  >
                    Pengaturan Akun
                  </Link>
                  <LogoutButton />
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
