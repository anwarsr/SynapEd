import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import JoinClassForm from "@/components/classes/JoinClassForm";
import { formatDate } from "@/lib/adminUsers";
import { listMyClasses, listOwnedClasses } from "@/lib/classes";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelas Saya – SynapEd" };

// Sesi ada di cookie, jadi halaman ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

/**
 * Kelas yang diikuti seseorang, beserta formulir bergabung.
 *
 * Kelas yang ia MILIKI sengaja tidak dicampur ke daftar ini — hanya ditautkan.
 * Mengelola kelas dan mengikuti kelas adalah dua peran dengan tombol yang
 * berbeda, dan menyatukannya membuat setiap baris harus menjelaskan sendiri
 * ia yang mana.
 */
export default async function MyClassesPage() {
  const user = await requireUser("/kelas");

  const [diikuti, dimiliki] = await Promise.all([
    listMyClasses(user.uid),
    user.role === "educator" || user.role === "admin"
      ? listOwnedClasses(user.uid)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Navbar />

      <main className="bg-paper pt-32 pb-24">
        <div className="container-reading">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Kelas</span>
          </p>

          <h1 className="t-h2 mb-3">
            Kelas <span className="mark">saya</span>
          </h1>

          <p className="t-body text-ink-muted mb-10">
            {diikuti.length === 0
              ? "Belum mengikuti kelas apa pun. Masukkan kode undangan dari pengajar Anda."
              : `${diikuti.length} kelas yang Anda ikuti.`}
          </p>

          <div className="mb-10">
            <JoinClassForm />
          </div>

          {dimiliki.length > 0 && (
            <p className="t-body text-ink-muted mb-10">
              Anda juga mengelola {dimiliki.length} kelas —{" "}
              <Link
                href="/educator/classes"
                className="text-blue-700 hover:underline underline-offset-4"
              >
                buka panel educator
              </Link>
              .
            </p>
          )}

          {diikuti.length === 0 ? (
            <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
              <p className="t-body text-ink-muted">
                Kelas yang Anda ikuti akan muncul di sini.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {diikuti.map((k) => (
                <li key={k.id} className="bg-paper-card border border-rule rounded-2xl p-6">
                  <Link
                    href={`/kelas/${k.id}`}
                    className="text-sm font-medium text-ink transition-colors duration-200 hover:text-blue-700"
                  >
                    {k.name}
                  </Link>

                  {k.description && (
                    <p className="mt-1 text-sm text-ink-muted line-clamp-2">{k.description}</p>
                  )}

                  <p className="mt-2 text-xs text-ink-muted">
                    {k.memberCount} anggota · {k.postCount} postingan · dibuat{" "}
                    {formatDate(k.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
