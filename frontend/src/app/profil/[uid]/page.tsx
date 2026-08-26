import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
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

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading space-y-10">
          <ProfileHeader
            name={profile.name}
            email=""
            photoURL={profile.photoURL}
            role={profile.role}
            bio={profile.content.bio}
            skills={profile.content.skills}
          />

          <ProfileStatsRow stats={profile.stats} isEducator={isEducator} />

          {profile.content.education.length > 0 && (
            <section>
              <h2 className="t-h3 mb-5">Riwayat Pendidikan</h2>
              <EducationList items={profile.content.education} />
            </section>
          )}

          {isEducator && (
            <section>
              <h2 className="t-h3 mb-5">Kursus yang Diajarkan</h2>
              <OwnedCourses courses={profile.courses} />
            </section>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
