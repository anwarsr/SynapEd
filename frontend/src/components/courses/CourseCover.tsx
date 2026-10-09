"use client";

import { useState } from "react";
import CourseThumb from "@/components/ui/CourseThumb";
import { iconPaths } from "@/lib/courseUi";
import type { CourseSummary } from "@/lib/courses";
import { cn } from "@/lib/cn";

const FACE: React.CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

/**
 * Gambar sampul kartu kursus. Ditekan → MEMBALIK 3D dan menampilkan untuk siapa
 * kursus ini ("Untuk pemula", "Untuk tingkat menengah", …) menurut tingkat
 * kesulitannya; ditekan lagi → kembali ke gambar.
 *
 * `z-10`: kartu memakai tautan "Lihat Detail" yang diperluas ke seluruh kartu
 * (after:absolute inset-0). Tanpa lapisan di atasnya, menekan gambar akan
 * membuka halaman kursus, bukan membaliknya.
 */
export default function CourseCover({ course, nomor }: { course: CourseSummary; nomor: number }) {
  const [balik, setBalik] = useState(false);
  const pembuat = (course.instructorUsername || course.instructorName || "SynapEd").trim();

  return (
    <div className="relative z-10 h-44" style={{ perspective: "900px" }}>
      <button
        type="button"
        onClick={() => setBalik((v) => !v)}
        aria-pressed={balik}
        aria-label={balik ? "Kembali ke gambar kursus" : `Lihat pembuat kursus ini: ${pembuat}`}
        className="group/cover relative block h-full w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
      >
        <span
          className="absolute inset-0 block transition-transform duration-700 ease-warm motion-reduce:transition-none"
          style={{ transformStyle: "preserve-3d", transform: balik ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Depan: gambar + nomor */}
          <span aria-hidden={balik} className="absolute inset-0 block overflow-hidden bg-paper-alt" style={FACE}>
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
              className="absolute left-0 top-0 flex h-9 w-11 items-center justify-center bg-black/60 text-[11px] tracking-wider text-white backdrop-blur-sm transition-colors duration-300 group-hover:bg-blue-600"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 700 }}
            >
              {String(nomor).padStart(2, "0")}
            </span>
          </span>

          {/* Belakang: "DIBUAT OLEH" + username pembuat. Latar = latar kartu (ikut
              menerang saat di-hover). Setelah gambar selesai membalik, username
              berkedip cepat beberapa kali lalu menetap berwarna biru. */}
          <span
            aria-hidden={!balik}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper-card px-6 text-center transition-colors duration-500 ease-warm group-hover:bg-card-hover"
            style={{ ...FACE, transform: "rotateY(180deg)" }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-muted transition-[opacity,transform] duration-500 ease-warm motion-reduce:transition-none"
              style={{
                opacity: balik ? 1 : 0,
                transform: balik ? "translateY(0)" : "translateY(8px)",
                transitionDelay: balik ? "350ms" : "0ms",
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
