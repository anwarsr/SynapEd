import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/ui/Reveal";
import ClassCard from "@/components/classes/ClassCard";
import JoinClassForm from "@/components/classes/JoinClassForm";
import { listMyClasses } from "@/lib/classes";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelas Saya – SynapEd" };

// Sesi ada di cookie, jadi halaman ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

const DISPLAY_SEKSI = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

/**
 * Kelas yang diikuti seseorang, beserta panel bergabung.
 *
 * Kelas yang ia MILIKI sengaja tidak dicampur ke daftar ini: mengelola kelas dan
 * mengikuti kelas adalah dua peran. Kelas milik educator ada di /dashboard
 * ("Kelas yang Dibuat") dan /educator/classes.
 */
export default async function MyClassesPage() {
  const user = await requireUser("/kelas");

  const diikuti = await listMyClasses(user.uid);

  const terakhir = diikuti[0];

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-paper pb-28 pt-36">
        <div className="container-page">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="mb-4 text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
                Kelas saya
              </h1>
              <p className="t-body max-w-[56ch] text-ink-muted">
                {diikuti.length === 0
                  ? "Belum mengikuti kelas apa pun. Masukkan kode undangan dari pengajar Anda untuk mulai."
                  : `${diikuti.length} kelas yang Anda ikuti. Pengumuman terbaru menunggu di dalamnya.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#gabung"
                className="bg-blue-600 px-7 py-4 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
              >
                Gabung kelas baru
              </a>

              {terakhir && (
                <Link
                  href={`/kelas/${terakhir.id}`}
                  className="whitespace-nowrap bg-white/10 px-7 py-4 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
                >
                  Lanjutkan kelas terakhir
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-9 grid-cols-[minmax(0,1fr)_minmax(260px,320px)] max-lg:grid-cols-1 max-lg:gap-6">
            <div className="min-w-0">
              <h2 className="t-h3 mb-5">Kelas yang diikuti</h2>

              {diikuti.length === 0 ? (
                <div className="bg-paper-card px-8 py-14">
                  <p className="text-[22px] font-semibold tracking-[-0.02em] text-white" style={DISPLAY_SEKSI}>
                    Belum ada kelas di sini
                  </p>

                  <p className="mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
                    Minta kode undangan delapan karakter kepada pengajar Anda, lalu masukkan di
                    panel sebelah. Kelasnya akan langsung muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {diikuti.map((k, i) => (
                    <Reveal key={k.id} variant="tilt" delay={i * 110}>
                      <ClassCard kelas={k} href={`/kelas/${k.id}`} peran="Peserta" />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky hanya selama kolomnya berdampingan. Saat menumpuk di
                layar sempit, panel yang menempel justru mengikuti gulir di
                tengah daftar dan terasa rusak. */}
            <aside id="gabung" className="lg:sticky lg:top-24 lg:self-start">
              <JoinClassForm />
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
