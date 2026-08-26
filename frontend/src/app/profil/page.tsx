import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileStatsRow from "@/components/profile/ProfileStats";
import EducationList from "@/components/profile/EducationList";
import { EnrolledCourses, OwnedCourses } from "@/components/profile/ProfileCourses";
import EducatorStatus from "@/components/dashboard/EducatorStatus";
import { listMyEnrollments } from "@/lib/enrollments";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { getApplication } from "@/lib/educator";
import { getProfileStats, getUserProfile } from "@/lib/userProfile";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profil Saya – SynapEd" };

// Sesi ada di cookie, jadi halaman ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

/**
 * Halaman profil — versi pemiliknya sendiri.
 *
 * Sengaja dibangun dari komponen yang seluruh datanya datang lewat props,
 * bukan yang membaca sesi masing-masing. Saat profil dibuka orang lain nanti,
 * `/profil/[uid]` cukup mengoper data pemilik profilnya ke komponen yang sama
 * dengan dua prop dimatikan: `showEmail` dan tombol suntingnya.
 */
export default async function ProfilePage() {
  const user = await requireUser("/profil");
  const isEducator = user.role === "educator" || user.role === "admin";

  const [profile, stats, enrollments, owned, application] = await Promise.all([
    getUserProfile(user.uid),
    getProfileStats(user.uid, isEducator),
    listMyEnrollments(user.uid),
    isEducator ? listOwnedCourses(user.uid) : Promise.resolve([]),
    getApplication(user.uid),
  ]);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading space-y-10">
          <ProfileHeader
            name={user.name}
            email={user.email}
            photoURL={user.photoURL}
            role={user.role}
            bio={profile.bio}
            skills={profile.skills}
            showEmail
          />

          <ProfileStatsRow stats={stats} isEducator={isEducator} />

          {/* Ajakan melamar jadi educator, atau status lamaran yang berjalan.
              Hanya berarti bagi pemilik profilnya sendiri. */}
          <EducatorStatus role={user.role} status={application?.status ?? null} />

          <section>
            <h2 className="t-h3 mb-5">Riwayat Pendidikan</h2>
            <EducationList items={profile.education} />
          </section>

          {isEducator && (
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
                <h2 className="t-h3">Kursus yang Dibuat</h2>
                <Link
                  href="/educator/courses"
                  className="text-sm text-blue-700 hover:underline underline-offset-4"
                >
                  Kelola kursus →
                </Link>
              </div>
              <OwnedCourses courses={owned} own />
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
              <h2 className="t-h3">Kursus yang Diikuti</h2>
              <Link
                href="/courses"
                className="text-sm text-blue-700 hover:underline underline-offset-4"
              >
                Jelajahi katalog →
              </Link>
            </div>
            <EnrolledCourses enrollments={enrollments} />
          </section>

          {/* Tombol sunting ditaruh di bawah sesuai permintaan pemilik proyek —
              profil dibaca dulu, baru disunting. Pengaturan lain (email, sandi,
              cara masuk, hapus akun) punya halamannya sendiri. */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/profil/edit"
              className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
            >
              Edit Profil
            </Link>
            <Link
              href="/pengaturan"
              className="rounded-lg border border-rule px-7 py-3 text-sm font-medium text-ink-body transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
            >
              Pengaturan
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
