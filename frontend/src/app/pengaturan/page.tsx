import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import {
  DeleteAccount,
  EmailForm,
  PasswordForm,
} from "@/components/dashboard/AccountForms";
import { PhoneForm } from "@/components/dashboard/ProfileMedia";
import LogoutButton from "@/components/dashboard/LogoutButton";
import SignInMethodsCard from "@/components/dashboard/SignInMethodsCard";
import { getSignInMethods } from "@/lib/accountProviders";
import { requireUser } from "@/lib/firebase/session";
import { getMyPhone } from "@/lib/userProfile";
import { getUsernameInfo } from "@/lib/usernames";
import UsernameForm from "@/components/dashboard/UsernameForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pengaturan – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Pengaturan akun — segala yang BUKAN pajangan profil.
 *
 * Pemisahannya mengikuti satu garis: apa yang dilihat orang lain masuk profil,
 * apa yang hanya urusan pemilik akun masuk ke sini. Nomor telepon ada di sini,
 * bukan di profil, karena ia alamat kontak pribadi — bukan bagian dari
 * perkenalan.
 */
export default async function SettingsPage() {
  const user = await requireUser("/pengaturan");
  const [methods, phone, username] = await Promise.all([
    getSignInMethods(user.uid),
    getMyPhone(user.uid),
    getUsernameInfo(user.uid),
  ]);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-6">
            <h1 className="text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
              Pengaturan
            </h1>
            <LogoutButton />
          </div>
          <p className="t-body mb-12 text-ink-muted">{user.email}</p>

          <div className="mb-12 bg-paper-card px-7 py-6">
            <p className="text-sm leading-[1.7] text-ink-body">
              Mencari foto, perkenalan, atau riwayat pendidikan?{" "}
              <Link href="/profil/edit" className="font-semibold text-white underline decoration-white/30 underline-offset-[5px] transition-colors hover:decoration-white">
                Semuanya ada di Edit Profil
              </Link>
              .
            </p>
          </div>

          <section className="space-y-4">
            <UsernameForm username={username.username} changedAt={username.changedAt} />
            <PhoneForm initialPhone={phone} />
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
