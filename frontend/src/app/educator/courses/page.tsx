import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import Tag from "@/components/ui/Tag";
import Reveal from "@/components/ui/Reveal";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { requireEducator } from "@/lib/firebase/session";
import { levelTone } from "@/lib/courseUi";
import { formatDate } from "@/lib/adminUsers";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kursus Saya – SynapEd" };

export const dynamic = "force-dynamic";

const SANS = { fontFamily: "var(--font-sans)" } as const;

const LEVEL_TEKS = {
  blue: "text-blue-300",
  amber: "text-warn-text",
  rust: "text-error-text",
} as const;

const AKSI =
  "text-[13px] font-semibold text-white/70 underline-offset-[6px] transition-colors duration-200 hover:text-white hover:underline";

export default async function MyCoursesPage() {
  const user = await requireEducator("/educator/courses");
  const courses = await listOwnedCourses(user.uid, user.name);

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="mb-4 text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
              Kursus saya
            </h1>
            <p className="t-body max-w-[54ch] text-ink-muted">
              {courses.length === 0
                ? "Anda belum membuat kursus."
                : `${courses.length} kursus sudah Anda buat.`}
            </p>
          </div>

          <Link
            href="/educator/courses/new"
            className="bg-blue-600 px-7 py-4 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
          >
            Buat kursus
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="bg-paper-card px-8 py-14">
            <p className="max-w-[46ch] text-sm leading-[1.75] text-ink-muted">
              Kursus pertama Anda terdiri dari satu modul materi, satu video, dan satu penugasan akhir.
            </p>
            <Link
              href="/educator/courses/new"
              className="mt-7 inline-block bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
            >
              Buat kursus pertama
            </Link>
          </div>
        ) : (
          <ol className="grid gap-1">
            {courses.map((c, i) => (
              <li key={c.slug}>
                <Reveal delay={Math.min(i, 6) * 70}>
                  <div className="group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 overflow-hidden bg-paper-card px-6 py-6 transition-colors duration-300 ease-out-soft hover:bg-card-hover sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-8 sm:px-8">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-blue-500 transition-transform duration-500 ease-warm group-hover:scale-y-100"
                    />

                    <span
                      aria-hidden="true"
                      className="select-none text-[2.6rem] font-extralight leading-none tracking-[-0.04em] tabular-nums text-white/20 transition-colors duration-300 group-hover:text-blue-300 sm:text-[3.2rem]"
                      style={SANS}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <Link
                        href={`/courses/${c.slug}`}
                        className="block truncate text-[1.2rem] font-semibold tracking-[-0.02em] text-white transition-colors duration-200 hover:text-blue-300"
                        style={SANS}
                      >
                        {c.title}
                      </Link>
                      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted">
                        <span className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${LEVEL_TEKS[levelTone(c.levelColor)]}`}>
                          {c.level}
                        </span>
                        <span>{c.lessonsCount} bagian</span>
                        <span>dibuat {formatDate(c.createdAt)}</span>
                        <Tag tone={c.visibility === "public" ? "blue" : "neutral"}>
                          {c.visibility === "public" ? "Tayang" : "Tersembunyi"}
                        </Tag>
                      </p>
                    </div>

                    <div className="col-span-2 mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-1 sm:mt-0 sm:self-center">
                      <Link href={`/educator/courses/${c.slug}/students`} className={AKSI}>
                        Peserta
                      </Link>
                      <Link href={`/educator/courses/${c.slug}/edit`} className={AKSI}>
                        Sunting
                      </Link>
                      <Link href={`/courses/${c.slug}/learn`} className={AKSI}>
                        Lihat
                      </Link>
                      {/* Tombol hapus langsung dicabut dari sini. Penghapusan kini
                          melewati persetujuan admin, dan formulir alasannya ada di
                          halaman sunting - bukan di daftar. */}
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        )}
      </div>
    </EducatorShell>
  );
}
