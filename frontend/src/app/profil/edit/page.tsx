import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import ProfileEditForm from "@/components/profile/ProfileEditForm";
import { AvatarForm } from "@/components/dashboard/ProfileMedia";
import { ProfileForm } from "@/components/dashboard/AccountForms";
import { getUserProfile } from "@/lib/userProfile";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Profil – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Penyuntingan profil.
 *
 * Foto dan nama tampil ikut di sini meski keduanya milik Firebase Auth, bukan
 * dokumen profil: dari sudut pandang pengguna semuanya "profil saya", dan
 * memaksanya berpindah halaman hanya untuk mengganti foto adalah pemisahan
 * yang melayani struktur data, bukan orangnya.
 */
export default async function EditProfilePage() {
  const user = await requireUser("/profil/edit");
  const profile = await getUserProfile(user.uid);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Profil Saya</span>
          </p>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <h1 className="t-h2">
              Edit <span className="mark">profil</span>
            </h1>
            <Link
              href="/profil"
              className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
            >
              ← Kembali
            </Link>
          </div>
          <p className="t-body text-ink-muted mb-10">
            Yang Anda isi di sini akan terlihat orang lain saat profil dibuka untuk umum.
          </p>

          <div className="space-y-6">
            <AvatarForm user={user} />
            <ProfileForm user={user} />
            <ProfileEditForm initial={profile} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
