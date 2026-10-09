import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/ui/Reveal";
import ClassCard from "@/components/classes/ClassCard";
import JoinClassForm from "@/components/classes/JoinClassForm";
import { listMyClasses, listOwnedClasses } from "@/lib/classes";
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

  const terakhir = diikuti[0];

  return (
    <>
      <Navbar />

      <main>
        {/* Kepala: sedikit lebih tua dari latar halaman. -mt-14 menaikkannya ke
            belakang navbar supaya navbar mengambang, bukan duduk di atas pita. */}
        <section className="relative -mt-14 overflow-hidden bg-header pb-20 pt-44">
          <div className="container-page relative">
            <h1
              className="rise-in max-w-[16ch] font-extrabold leading-[1.03] tracking-[-0.04em] text-white"
              style={
                {
                  fontSize: "clamp(2.4rem, 6.5vw, 5rem)",
                  "--rise-delay": "120ms",
                } as React.CSSProperties
              }
            >
              Kelas saya
            </h1>

            <p
              className="rise-in mt-5 max-w-[52ch] text-base leading-relaxed text-white/75"
              style={{ "--rise-delay": "260ms" } as React.CSSProperties}
            >
              {diikuti.length === 0
                ? "Belum mengikuti kelas apa pun. Masukkan kode undangan dari pengajar Anda untuk mulai."
                : `${diikuti.length} kelas yang Anda ikuti. Pengumuman terbaru menunggu di dalamnya.`}
            </p>

            <div
              className="rise-in mt-8 flex flex-wrap gap-3"
              style={{ "--rise-delay": "380ms" } as React.CSSProperties}
            >
              <a
                href="#gabung"
                className="bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
              >
                Gabung kelas baru
              </a>

              {terakhir && (
                <Link
                  href={`/kelas/${terakhir.id}`}
                  className="whitespace-nowrap bg-white/10 px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
                >
                  Lanjutkan kelas terakhir
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="bg-paper py-14">
          <div className="container-page grid gap-9 grid-cols-[minmax(0,1fr)_minmax(260px,320px)] max-lg:grid-cols-1 max-lg:gap-6">
            <div className="min-w-0">
              <h2 className="text-[22px] text-ink mb-5" style={DISPLAY_SEKSI}>
                Kelas yang diikuti
              </h2>

              {dimiliki.length > 0 && (
                <p className="t-body text-ink-muted mb-6">
                  Anda juga mengelola {dimiliki.length} kelas -{" "}
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
                <div className="bg-white/5 px-8 py-16 text-center">
                  <span
                    aria-hidden="true"
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center bg-white/10"
                  >
                    <svg
                      className="h-7 w-7 text-ink-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.5v11m5.5-5.5h-11M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-13z"
                      />
                    </svg>
                  </span>

                  <p className="text-[22px] text-ink" style={DISPLAY_SEKSI}>
                    Belum ada kelas di sini
                  </p>

                  <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
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
