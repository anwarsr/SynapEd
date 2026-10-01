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
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Akun Saya</span>
          </p>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <h1 className="t-h2">
              Pengaturan <span className="mark">akun</span>
            </h1>
            <LogoutButton />
          </div>
          <p className="t-body text-ink-muted mb-10">{user.email}</p>

          <div className="mb-10 rounded-2xl border border-rule bg-paper-alt px-6 py-5">
            <p className="text-sm text-ink-body">
              Mencari foto, perkenalan, atau riwayat pendidikan?{" "}
              <Link href="/profil/edit" className="text-blue-700 hover:underline underline-offset-4">
                Semuanya ada di Edit Profil
              </Link>
              .
            </p>
          </div>

          <section className="space-y-5">
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
