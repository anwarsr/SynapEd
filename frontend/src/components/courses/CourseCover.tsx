"use client";

import { useState } from "react";
import CourseThumb from "@/components/ui/CourseThumb";
import { iconPaths } from "@/lib/courseUi";
import type { CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";

/**
 * Gambar sampul kartu kursus. Ditekan → gambar TERGULUNG KE ATAS seperti pintu
 * garasi dan menyingkap pembuat kursus ("DIBUAT OLEH" + username) di baliknya;
 * ditekan lagi → pintu turun menutup. Pintu dibuat lambat di awal & akhir
 * (motor menarik, lalu mengendap) dan bergaris sekat tipis agar terbaca sebagai
 * pintu berpanel, bukan gambar yang sekadar bergeser.
 *
 * `z-10`: kartu memakai tautan "Lihat Detail" yang diperluas ke seluruh kartu
 * (after:absolute inset-0). Tanpa lapisan di atasnya, menekan gambar akan
 * membuka halaman kursus, bukan membaliknya.
 */
export default function CourseCover({ course, nomor }: { course: CourseSummary; nomor: number }) {
  const [balik, setBalik] = useState(false);
  const pembuat = (course.instructorUsername || course.instructorName || "SynapEd").trim();

  return (
    <div className="relative z-10 h-44 overflow-hidden">
      <button
        type="button"
        onClick={() => setBalik((v) => !v)}
        aria-pressed={balik}
        aria-label={balik ? "Kembali ke gambar kursus" : `Lihat pembuat kursus ini: ${pembuat}`}
        className="group/cover relative block h-full w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
      >
        <span className="absolute inset-0 block">
          {/* Pintu: gambar + nomor. Naik penuh ke atas (-100%) = terbuka. */}
          <span
            aria-hidden={balik}
            className="absolute inset-0 z-[1] block overflow-hidden bg-paper-alt shadow-[0_6px_14px_rgb(0_0_0/0.35)] transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.25,1)] motion-reduce:transition-none"
            style={{ transform: balik ? "translateY(-100%)" : "translateY(0)" }}
          >
            <CourseThumb
              thumbnail={course.thumbnail}
              className="absolute inset-0 h-full w-full transition-transform duration-700 ease-warm group-hover:scale-[1.04]"
              fallback={
                <div className={cn("flex h-full w-full items-center justify-center", course.tint)}>
                  <svg
                    className="h-12 w-12 text-blue-600/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[course.icon] ?? iconPaths.reading} />
                  </svg>
                </div>
              }
            />

            <span
              className="absolute left-0 top-0 flex h-9 w-11 items-center justify-center bg-black/60 text-[11px] tracking-wider text-white backdrop-blur-sm"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}
            >
              {String(nomor).padStart(2, "0")}
            </span>

            {/* Sekat panel pintu garasi */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgb(0 0 0 / 0.28) calc(25% - 1px), rgb(0 0 0 / 0.28) 25%)",
              }}
            />
          </span>

          {/* Di balik pintu: "DIBUAT OLEH" + username pembuat. Latar = latar kartu (ikut
              menerang saat di-hover). Setelah pintu terbuka, username berkedip cepat
              beberapa kali lalu menetap berwarna biru. */}
          <span
            aria-hidden={!balik}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper-card px-6 text-center"
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-muted transition-[opacity,transform] duration-500 ease-warm motion-reduce:transition-none"
              style={{
                opacity: balik ? 1 : 0,
                transform: balik ? "translateY(0)" : "translateY(8px)",
                transitionDelay: balik ? "500ms" : "0ms",
              }}
            >
              Dibuat oleh
            </span>

            <span
              className={cn(
                "max-w-full break-all text-[1.55rem] font-extrabold uppercase leading-tight tracking-[0.12em] text-white",
                balik && "cover-kedip",
              )}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {pembuat}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
