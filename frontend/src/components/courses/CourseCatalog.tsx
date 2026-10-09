"use client";

import { useMemo, useState } from "react";
import CourseCard from "@/components/courses/CourseCard";
import type { Category, CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";

/** Pilihan batas bawah rating. 0 = semua (termasuk yang belum diulas). */
const RATING_OPSI: { nilai: number; label: string }[] = [
  { nilai: 0, label: "Semua rating" },
  { nilai: 4.5, label: "4,5 ke atas" },
  { nilai: 4, label: "4,0 ke atas" },
  { nilai: 3, label: "3,0 ke atas" },
];

const CHIP =
  "px-4 py-2 text-sm font-medium transition-colors duration-200 ease-out-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";

/**
 * Katalog lengkap dengan pencarian dan filter.
 *
 * Semua penyaringan terjadi di browser terhadap daftar yang sudah dimuat server:
 * katalog sekecil ini tidak butuh pencarian di sisi server, dan hasilnya
 * langsung berubah saat mengetik. Pencarian mencocokkan judul, deskripsi
 * singkat, kategori, dan nama pengajar — tanpa membedakan huruf besar-kecil.
 */
export default function CourseCatalog({
  courses,
  categories,
}: {
  courses: CourseSummary[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [kategori, setKategori] = useState("semua");
  const [minRating, setMinRating] = useState(0);
  const [terbuka, setTerbuka] = useState(false);

  const labelKategori = useMemo(() => new Map(categories.map((c) => [c.slug, c.label])), [categories]);

  const hasil = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (kategori !== "semua" && c.category !== kategori) return false;
      if (minRating > 0 && c.rating < minRating) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.shortDesc} ${labelKategori.get(c.category) ?? c.category} ${c.instructorName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [courses, query, kategori, minRating, labelKategori]);

  const aktif = (kategori !== "semua" ? 1 : 0) + (minRating > 0 ? 1 : 0);

  function reset() {
    setKategori("semua");
    setMinRating(0);
  }

  return (
    <div>
      {/* ── Bilah cari + tombol filter ─────────────────────────────────── */}
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white/[0.08] py-2 pl-5 pr-2 transition-colors duration-200 focus-within:bg-white/[0.13]">
          <svg className="h-5 w-5 shrink-0 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
          </svg>
          <span className="sr-only">Cari kursus</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, topik, atau pengajar…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-white outline-none placeholder:text-white/35 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => setTerbuka((v) => !v)}
          aria-expanded={terbuka}
          aria-controls="panel-filter"
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-colors duration-200 ease-out-soft",
            terbuka ? "bg-blue-600 text-white" : "bg-white/10 text-white hover:bg-white/15",
          )}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M7 12h10M10 18h4" />
          </svg>
          Filter
          {aktif > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-paper">
              {aktif}
            </span>
          )}
        </button>
      </div>

      {/* ── Panel filter: jenis kursus + rating ─────────────────────────── */}
      <div
        id="panel-filter"
        className={cn(
          "mx-auto grid max-w-3xl transition-[grid-template-rows,opacity,margin] duration-500 ease-warm motion-reduce:transition-none",
          terbuka ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!terbuka}
      >
        <div className="overflow-hidden">
          <div className="bg-paper-card p-6 sm:p-8">
            <p className="t-label mb-3 text-ink-muted">Jenis kursus</p>
            <div className="mb-7 flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  tabIndex={terbuka ? 0 : -1}
                  onClick={() => setKategori(c.slug)}
                  aria-pressed={kategori === c.slug}
                  className={cn(CHIP, kategori === c.slug ? "bg-blue-600 text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white")}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <p className="t-label mb-3 text-ink-muted">Rating</p>
            <div className="flex flex-wrap gap-1">
              {RATING_OPSI.map((o) => (
                <button
                  key={o.nilai}
                  type="button"
                  tabIndex={terbuka ? 0 : -1}
                  onClick={() => setMinRating(o.nilai)}
                  aria-pressed={minRating === o.nilai}
                  className={cn(CHIP, minRating === o.nilai ? "bg-blue-600 text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white")}
                >
                  {o.nilai > 0 && <span className="mr-1.5 text-amber-500">★</span>}
                  {o.label}
                </button>
              ))}
            </div>

            {aktif > 0 && (
              <button
                type="button"
                tabIndex={terbuka ? 0 : -1}
                onClick={reset}
                className="mt-7 text-sm font-medium text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                Hapus semua filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Hasil ───────────────────────────────────────────────────────── */}
      <p className="mb-6 mt-10 text-sm text-ink-muted" role="status" aria-live="polite">
        {hasil.length === courses.length && !query && aktif === 0
          ? `${courses.length} kursus`
          : `${hasil.length} dari ${courses.length} kursus`}
      </p>

      {hasil.length === 0 ? (
        <div className="bg-white/5 px-8 py-20 text-center">
          <p className="text-xl font-semibold text-white" style={{ fontFamily: "var(--font-sans)" }}>
            Tidak ada kursus yang cocok
          </p>
          <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
            Coba kata kunci lain, atau longgarkan filter jenis dan rating.
          </p>
          {(query || aktif > 0) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                reset();
              }}
              className="mt-7 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Atur ulang pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hasil.map((c, i) => (
            <CourseCard key={c.slug} course={c} nomor={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
