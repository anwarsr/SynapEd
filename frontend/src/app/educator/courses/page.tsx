import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import Tag from "@/components/ui/Tag";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { requireEducator } from "@/lib/firebase/session";
import { iconPaths, levelTone } from "@/lib/courseUi";
import { formatDate } from "@/lib/adminUsers";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kursus Saya – SynapEd" };

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await requireEducator("/educator/courses");
  const courses = await listOwnedCourses(user.uid);

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <p className="chapter-mark mb-5">
          <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          <span>Educator</span>
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <h1 className="t-h2">
            Kursus <span className="mark">saya</span>
          </h1>
          <Link
            href="/educator/courses/new"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
          >
            Buat Kursus
          </Link>
        </div>

        <p className="t-body text-ink-muted mb-10">
          {courses.length === 0
            ? "Anda belum membuat kursus."
            : `${courses.length} kursus sudah diterbitkan.`}
        </p>

        {courses.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted mb-6">
              Kursus pertama Anda terdiri dari satu modul materi, satu video, dan satu
              penugasan akhir.
            </p>
            <Link
              href="/educator/courses/new"
              className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
            >
              Buat Kursus Pertama
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => (
              <li
                key={c.slug}
                className="flex flex-wrap items-center gap-4 bg-paper-card border border-rule rounded-2xl p-5"
              >
                <span
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                    c.tint,
                  )}
                >
                  <svg
                    className="w-5 h-5 text-blue-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={iconPaths[c.icon] ?? iconPaths.reading}
                    />
                  </svg>
                </span>

                <span className="flex-1 min-w-[12rem]">
                  <Link
                    href={`/courses/${c.slug}`}
                    className="block text-sm font-medium text-ink hover:text-blue-700 transition-colors truncate"
                  >
                    {c.title}
                  </Link>
                  <span className="block text-xs text-ink-muted mt-0.5">
                    {c.lessonsCount} bagian · dibuat {formatDate(c.createdAt)}
                  </span>
                </span>

                <Tag tone={c.visibility === "public" ? "blue" : "neutral"}>
                  {c.visibility === "public" ? "Tayang" : "Tersembunyi"}
                </Tag>

                <Tag tone={levelTone(c.levelColor)}>{c.level}</Tag>

                <span className="flex items-center gap-4">
                  <Link
                    href={`/educator/courses/${c.slug}/edit`}
                    className="text-sm text-blue-700 hover:underline underline-offset-4"
                  >
                    Sunting
                  </Link>
                  <Link
                    href={`/courses/${c.slug}/learn`}
                    className="text-sm text-blue-700 hover:underline underline-offset-4"
                  >
                    Lihat
                  </Link>
                  {/* Tombol hapus langsung dicabut dari sini. Penghapusan kini
                      melewati persetujuan admin, dan formulir alasannya ada di
                      halaman sunting — bukan di daftar. */}
                </span>
              </li>
            ))}
          </ul>
        )}

      </div>
    </EducatorShell>
  );
}
