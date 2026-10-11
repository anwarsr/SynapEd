import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import Reveal from "@/components/ui/Reveal";
import ClassForm from "@/components/classes/ClassForm";
import { ClassSpine } from "@/components/classes/ClassPlate";
import { formatDateOnly } from "@/lib/adminUsers";
import { listOwnedClasses } from "@/lib/classes";
import { requireEducator } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelas Saya – SynapEd" };

export const dynamic = "force-dynamic";

const DISPLAY_BARIS = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

/**
 * Daftar kelas milik educator, beserta formulir buatnya di kolom kanan.
 *
 * Kepalanya pita `bg-paper-alt`, bukan hero navy: ini ruang kerja, bukan
 * halaman sambutan. Hero gelap di setiap halaman membuat yang gelap berhenti
 * berarti apa-apa.
 *
 * Tanpa rute /baru tersendiri: membuat kelas hanya butuh dua kolom, dan
 * halaman terpisah untuk itu berarti satu perpindahan halaman penuh sebelum
 * sesuatu yang pertama kali dilihat orang justru kosong.
 */
export default async function MyClassesPage() {
  const user = await requireEducator("/educator/classes");
  const kelas = await listOwnedClasses(user.uid);

  return (
    <EducatorShell user={user}>
      <div className="container-reading mb-12 pt-4">
        <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
          Kelas yang Anda kelola
        </h1>

        <p className="t-body max-w-[54ch] text-ink-muted">
          {kelas.length === 0
            ? "Belum ada kelas. Buat satu, lalu bagikan kode undangannya kepada peserta."
            : `${kelas.length} kelas. Kode undangannya tertera di tiap baris.`}
        </p>
      </div>

      <div className="container-reading">
        <div className="grid gap-9 grid-cols-[minmax(0,1fr)_minmax(260px,320px)] max-lg:grid-cols-1 max-lg:gap-6">
          <div className="min-w-0">
            {kelas.length === 0 ? (
              <div className="bg-paper-card px-8 py-14">
                <p className="text-[22px] font-semibold tracking-[-0.02em] text-white" style={DISPLAY_BARIS}>
                  Belum ada kelas
                </p>
                <p className="mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
                  Buat satu di panel sebelah, lalu bagikan kode undangannya kepada peserta Anda.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {kelas.map((k, i) => (
                  <li key={k.id}>
                    <Reveal delay={i * 90}>
                      <div className="flex overflow-hidden bg-paper-card transition-colors duration-300 ease-out-soft hover:bg-card-hover">
                        <ClassSpine nama={k.name} variant="tipis" gambar={k.imageURL} />

                        <div className="min-w-0 flex-1 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/educator/classes/${k.id}`}
                                className="text-[20px] text-white transition-colors duration-200 hover:text-blue-300"
                                style={DISPLAY_BARIS}
                              >
                                {k.name}
                              </Link>

                              <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                                {/* Kode ditaruh di baris, bukan disembunyikan
                                    di dalam kelasnya: inilah yang paling sering
                                    dicari pengajar saat membuka halaman ini. */}
                                <code className="bg-white/10 px-2 py-0.5 text-xs tracking-[0.12em] text-white">
                                  {k.joinCode}
                                </code>
                                <span>
                                  {k.memberCount} anggota · {k.postCount} postingan · dibuat{" "}
                                  {formatDateOnly(k.createdAt)}
                                </span>
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Link
                                href={`/educator/classes/${k.id}`}
                                className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700"
                              >
                                Buka
                              </Link>
                              <Link
                                href={`/educator/classes/${k.id}/members`}
                                className="bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/15"
                              >
                                Anggota
                              </Link>
                            </div>
                          </div>

                          {k.description && (
                            <p className="mt-3 max-w-[64ch] text-sm leading-[1.65] text-ink-body line-clamp-2">
                              {k.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ClassForm />
          </aside>
        </div>
      </div>
    </EducatorShell>
  );
}
