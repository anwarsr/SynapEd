import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/ui/Reveal";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileStatsRow from "@/components/profile/ProfileStats";
import EducationList from "@/components/profile/EducationList";
import { OwnedCourses } from "@/components/profile/ProfileCourses";
import { getPublicProfile } from "@/lib/publicProfile";
import { getCurrentUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ uid: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uid } = await params;
  const profile = await getPublicProfile(uid);

  return {
    title: profile ? `${profile.name} – SynapEd` : "Profil – SynapEd",
    description: profile?.content.bio || undefined,
  };
}

/**
 * Profil seseorang dilihat orang lain.
 *
 * Memakai komponen yang sama persis dengan `/profil`, hanya dengan yang
 * pribadi dimatikan — itulah sebabnya komponen-komponen itu dibuat menerima
 * seluruh datanya lewat props sejak awal, bukan membaca sesi masing-masing.
 *
 * Terbuka tanpa perlu masuk. Halaman ini adalah kartu nama seorang educator;
 * mengunci di balik login berarti calon peserta tidak bisa memeriksa siapa
 * yang mengajar sebelum mendaftar — padahal justru itu yang ia timbang.
 */
export default async function PublicProfilePage({ params }: Props) {
  const { uid } = await params;

  // Membuka profil sendiri lewat alamat publik dialihkan ke `/profil`, supaya
  // pemiliknya melihat versi lengkapnya — beserta tombol suntingnya.
  const viewer = await getCurrentUser();
  if (viewer?.uid === uid) redirect("/profil");

  const profile = await getPublicProfile(uid);
  if (!profile) notFound();

  const isEducator = profile.role === "educator" || profile.role === "admin";

  return (
    <>
      <Navbar />

      <main className="bg-paper">
        <ProfileHeader
          name={profile.name}
          username={profile.username}
          email=""
          photoURL={profile.photoURL}
          bannerURL={profile.bannerURL}
          role={profile.role}
          bio={profile.content.bio}
          skills={profile.content.skills}
          meta={[
            isEducator ? `${profile.stats.courses} kursus` : null,
            isEducator
              ? `${profile.stats.students.toLocaleString("id-ID")} peserta terdaftar`
              : null,
            profile.joinedAt ? `Bergabung ${profile.joinedAt}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          utama={
            isEducator ? { label: "Lihat Kursus", href: "#kursus" } : undefined
          }
        />

        <div className="container-reading">
          <ProfileStatsRow stats={profile.stats} isEducator={isEducator} isPublic />

          <div className="flex flex-wrap items-start gap-14 pt-16 pb-[88px]">
            <div className="flex min-w-0 flex-1 basis-[440px] flex-col gap-14">
              {isEducator && (
                <Reveal>
                  <section id="kursus">
                    <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-4">
                      <h2 className="t-h3">Kursus yang Diajarkan</h2>
                      <Link
                        href="/courses"
                        className="text-[13px] text-blue-700 hover:underline underline-offset-4"
                      >
                        Lihat katalog →
                      </Link>
                    </div>
                    <OwnedCourses courses={profile.courses} />
                  </section>
                </Reveal>
              )}
            </div>

            <aside className="flex w-full flex-1 basis-72 flex-col gap-10 lg:sticky lg:top-28">
              {profile.content.education.length > 0 && (
                <section>
                  <h2 className="t-label text-ink-muted mb-4">Riwayat Pendidikan</h2>
                  <EducationList items={profile.content.education} />
                </section>
              )}

              {isEducator && (
                <section>
                  <h2 className="t-label text-ink-muted mb-4">Tentang Educator</h2>

                  <dl className="bg-paper-card px-5 py-[18px] text-[13.5px]">
                    {[
                      profile.joinedAt ? ["Bergabung", profile.joinedAt] : null,
                      ["Kursus", `${profile.stats.courses}`],
                      [
                        "Pelajaran",
                        profile.stats.lessons.toLocaleString("id-ID"),
                      ],
                    ]
                      .filter((b): b is [string, string] => b !== null)
                      .map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4 py-1.5">
                          <dt className="text-ink-muted">{k}</dt>
                          <dd className="font-medium text-ink">{v}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );}
