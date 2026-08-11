import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Tag from "@/components/ui/Tag";
import ApplyButton from "@/components/educator/ApplyButton";
import { getApplication } from "@/lib/educator";
import { requireUser } from "@/lib/firebase/session";
import { formatDate } from "@/lib/adminUsers";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menjadi Educator – SynapEd" };

// Isinya bergantung pada siapa yang masuk dan status pengajuannya.
export const dynamic = "force-dynamic";

const benefits = [
  {
    title: "Rancang kursus Anda sendiri",
    body: "Susun materi, bagi menjadi section dan pelajaran, lengkapi dengan video dan bahan bacaan.",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    title: "Jangkau seluruh pelajar SynapEd",
    body: "Kursus Anda tampil di katalog yang sama dengan kursus lain, tanpa biaya penerbitan.",
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    title: "Tetap menjadi pemilik materi",
    body: "Anda yang menentukan isi dan pembaruannya. SynapEd menyediakan tempatnya.",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  },
];

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-paper-card border border-rule rounded-2xl p-8">{children}</div>;
}

export default async function EducatorPage() {
  const user = await requireUser("/educator");
  const application = await getApplication(user.uid);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Program Educator</span>
          </p>

          <h1 className="t-h2 mb-4">
            Bagikan yang Anda kuasai, <span className="mark">jadilah educator</span>
          </h1>

          <p className="t-body text-lg text-ink-body mb-12 max-w-2xl">
            Educator adalah penyedia kursus di SynapEd — seperti lembaga atau pengajar
            yang membuka kelasnya sendiri. Anda menyusun kursus, SynapEd yang
            menyediakan tempat dan pelajarnya.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {benefits.map((b) => (
              <div key={b.title} className="bg-paper-card border border-rule rounded-2xl p-6">
                <span className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <svg
                    className="w-5 h-5 text-blue-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={b.icon} />
                  </svg>
                </span>
                <h2 className="t-h3 text-base mb-2">{b.title}</h2>
                <p className="text-sm text-ink-muted leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>

          <h2 className="t-h3 mb-4">Persyaratan</h2>
          <p className="t-body text-ink-body mb-10">
            Belum ada persyaratan khusus. Pengajuan Anda ditinjau admin SynapEd, dan
            hasilnya muncul di halaman ini.
          </p>

          {/* Bagian yang berubah menurut keadaan akun. Semua cabang dijelaskan
              apa adanya — pengguna berhak tahu di mana pengajuannya berada. */}
          {user.role === "educator" ? (
            <Panel>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="t-h3 text-lg">Anda sudah menjadi educator</h2>
                <Tag tone="amber">Educator</Tag>
              </div>
              <p className="t-body text-sm mb-6">
                Anda dapat membuat kursus sendiri: satu modul materi, satu video, dan satu
                penugasan akhir.
              </p>
              <Link
                href="/educator/courses"
                className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
              >
                Kelola Kursus Saya
              </Link>
            </Panel>
          ) : user.role === "admin" ? (
            <Panel>
              <h2 className="t-h3 text-lg mb-3">Anda masuk sebagai admin</h2>
              <p className="t-body text-sm mb-6">
                Andalah yang meninjau pengajuan educator, bukan mengajukannya.
              </p>
              <Link href="/admin/notifications" className="text-sm text-blue-700 hover:underline underline-offset-4">
                Lihat pengajuan masuk →
              </Link>
            </Panel>
          ) : application?.status === "pending" ? (
            <Panel>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="t-h3 text-lg">Pengajuan sedang ditinjau</h2>
                <Tag tone="amber">Menunggu</Tag>
              </div>
              <p className="t-body text-sm">
                Diajukan pada {formatDate(application.createdAt)}. Status di halaman ini
                berubah setelah admin memutuskan.
              </p>
            </Panel>
          ) : application?.status === "rejected" ? (
            <Panel>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="t-h3 text-lg">Pengajuan sebelumnya ditolak</h2>
                <Tag tone="rust">Ditolak</Tag>
              </div>
              <p className="t-body text-sm mb-6">
                Ditinjau pada {formatDate(application.decidedAt)}. Anda masih boleh
                mengajukan kembali.
              </p>
              <ApplyButton label="Ajukan Kembali" />
            </Panel>
          ) : (
            <Panel>
              <h2 className="t-h3 text-lg mb-3">Siap mengajukan?</h2>
              <p className="t-body text-sm mb-6">
                Pengajuan dikirim atas nama <span className="text-ink font-medium">{user.email}</span>.
                Tidak ada berkas yang perlu diunggah.
              </p>
              <ApplyButton />
            </Panel>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
