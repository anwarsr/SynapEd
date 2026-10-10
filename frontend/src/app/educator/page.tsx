import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Tag from "@/components/ui/Tag";
import ApplyButton from "@/components/educator/ApplyButton";
import { getApplication } from "@/lib/educator";
import { requireUser } from "@/lib/firebase/session";
import { formatDate } from "@/lib/adminUsers";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menjadi Educator – SynapEd" };

// Isinya bergantung pada siapa yang masuk dan status pengajuannya.
export const dynamic = "force-dynamic";

const benefits = [
  {
    title: "Rancang kursus Anda sendiri",
    body: "Susun materi, bagi menjadi section dan pelajaran, lengkapi dengan video dan bahan bacaan.",
  },
  {
    title: "Jangkau seluruh pelajar SynapEd",
    body: "Kursus Anda tampil di katalog yang sama dengan kursus lain, tanpa biaya penerbitan.",
  },
  {
    title: "Tetap menjadi pemilik materi",
    body: "Anda yang menentukan isi dan pembaruannya. SynapEd menyediakan tempatnya.",
  },
];

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-paper-card p-8 sm:p-10">{children}</div>;
}

export default async function EducatorPage() {
  const user = await requireUser("/educator");
  const application = await getApplication(user.uid);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading">
          <h1 className="mb-6 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.06] tracking-[-0.04em] text-white">
            Bagikan yang Anda kuasai, jadilah educator
          </h1>

          <p className="t-body mb-14 max-w-2xl text-lg text-ink-body">
            Educator adalah penyedia kursus di SynapEd - seperti lembaga atau pengajar
            yang membuka kelasnya sendiri. Anda menyusun kursus, SynapEd yang
            menyediakan tempat dan pelajarnya.
          </p>

          {/* Tiga keunggulan: nomor raksasa-tipis, turun bertangga (kolom kedua & ketiga
              lebih rendah) dan garis biru menggambar di tepi atas saat di-hover. */}
          <ol className="mb-24 grid gap-1 sm:grid-cols-3">
            {benefits.map((b, i) => (
              <li
                key={b.title}
                className={cn(
                  "group relative overflow-hidden bg-paper-card px-7 pb-10 pt-6 transition-colors duration-500 ease-warm hover:bg-card-hover",
                  i === 1 && "sm:mt-10",
                  i === 2 && "sm:mt-20",
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-blue-500 transition-transform duration-700 ease-warm group-hover:scale-x-100"
                />
                <span
                  aria-hidden="true"
                  className="block select-none text-[6rem] font-extralight leading-none tracking-[-0.07em] text-white/[0.12] transition-colors duration-500 ease-warm group-hover:text-blue-300/50"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2
                  className="mt-9 text-[1.3rem] font-bold leading-[1.2] tracking-[-0.025em] text-white transition-transform duration-500 ease-warm group-hover:translate-x-1"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {b.title}
                </h2>
                <p className="mt-3 text-sm leading-[1.75] text-ink-muted">{b.body}</p>
              </li>
            ))}
          </ol>

          <h2 className="t-h3 mb-3">Persyaratan</h2>
          <p className="t-body text-ink-body mb-10">
            Belum ada persyaratan khusus. Pengajuan Anda ditinjau admin SynapEd, dan
            hasilnya muncul di halaman ini.
          </p>

          {/* Bagian yang berubah menurut keadaan akun. Semua cabang dijelaskan
              apa adanya - pengguna berhak tahu di mana pengajuannya berada. */}
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
                className="inline-block bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
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
