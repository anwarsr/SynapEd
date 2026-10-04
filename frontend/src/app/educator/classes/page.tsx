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

const DISPLAY_JUDUL = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

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
      <div className="-mt-12 mb-10 border-b border-rule bg-paper-alt pb-10 pt-16">
        <div className="container-reading">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Panel Educator</span>
          </p>

          <h1 className="text-ink" style={{ ...DISPLAY_JUDUL, fontSize: "clamp(2rem,4vw,2.8rem)" }}>
            Kelas yang Anda <span className="mark">kelola</span>
          </h1>

          <p className="t-body text-ink-muted mt-4 max-w-[54ch]">
            {kelas.length === 0
              ? "Belum ada kelas. Buat satu, lalu bagikan kode undangannya kepada peserta."
              : `${kelas.length} kelas. Kode undangannya tertera di tiap baris.`}
          </p>
        </div>
      </div>

      <div className="container-reading">
        <div className="grid gap-9 grid-cols-[minmax(0,1fr)_minmax(260px,320px)] max-lg:grid-cols-1 max-lg:gap-6">
          <div className="min-w-0">
            {kelas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rule-strong bg-paper-card/55 px-8 py-14 text-center">
                <p className="text-[22px] text-ink" style={DISPLAY_BARIS}>
                  Belum ada kelas
                </p>
                <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
                  Buat satu di panel sebelah, lalu bagikan kode undangannya kepada peserta Anda.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {kelas.map((k, i) => (
                  <li key={k.id}>
                    <Reveal delay={i * 90}>
                      <div className="flex overflow-hidden rounded-2xl border border-rule bg-paper-card transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft">
                        <ClassSpine nama={k.name} variant="tipis" />

                        <div className="min-w-0 flex-1 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/educator/classes/${k.id}`}
                                className="text-[20px] text-ink transition-colors duration-200 hover:text-blue-700"
                                style={DISPLAY_BARIS}
                              >
                                {k.name}
                              </Link>

                              <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                                {/* Kode ditaruh di baris, bukan disembunyikan
                                    di dalam kelasnya: inilah yang paling sering
                                    dicari pengajar saat membuka halaman ini. */}
                                <code className="rounded-md border border-rule bg-paper-alt px-2 py-0.5 text-xs tracking-[0.12em] text-ink">
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
                                className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors duration-200 hover:border-blue-500"
                              >
                                Buka
                              </Link>
                              <Link
                                href={`/educator/classes/${k.id}/members`}
                                className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
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
