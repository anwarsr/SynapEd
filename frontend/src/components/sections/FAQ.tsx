"use client";
import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { faqs } from "@/data/landing";
import { cn } from "@/lib/cn";

/** Tipografi & warna disamakan dengan LearningPath.tsx: Inter tebal,
 *  tracking rapat, di atas biru pekat (bg-hero-navy) — bukan Fraunces
 *  di atas kertas. */
const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
  fontWeight: 800,
  lineHeight: 1.03,
  letterSpacing: "-0.04em",
};

const QUESTION: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 700,
  letterSpacing: "-0.015em",
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="relative py-28 bg-hero-navy overflow-hidden">
      <div className="relative container-reading">
        <Reveal className="flex flex-col items-center text-center mb-14">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/60 mb-6">
            <span aria-hidden="true" className="w-6 h-px bg-white/25" />
            Pertanyaan
            <span aria-hidden="true" className="w-6 h-px bg-white/25" />
          </p>

          <h2 className="text-paper max-w-3xl" style={HEADING}>
            Pertanyaan yang sering diajukan
          </h2>
        </Reveal>

        <div className="flex flex-col gap-4 items-center">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;

            return (
              <Reveal
                key={i}
                delay={i * 90}
                className="group relative w-full flex justify-center items-center py-1"
              >
                {/* Maskot — muncul saat kartu terbuka MAUPUN saat kursor
                    mendekat (group-hover), tidak lagi menunggu klik. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[5%] lg:left-[10%] bottom-[-10px] z-30 pointer-events-none",
                    "transition-all duration-200 ease-out-soft hidden lg:block",
                    "group-hover:opacity-100 group-hover:translate-x-2",
                    isOpen ? "opacity-100 translate-x-2" : "opacity-0 -translate-x-8",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/3.png" alt="" className="h-56 w-auto object-contain" />
                </div>

                <div
                  className={cn(
                    "relative z-20 w-full max-w-2xl transition-transform duration-200 ease-out-soft",
                    "group-hover:lg:translate-x-16",
                    isOpen && "lg:translate-x-16",
                  )}
                >
                  {/* Gelembung percakapan — rounded-tl kecil membentuk "ekor" */}
                  <div
                    className={cn(
                      "rounded-3xl rounded-tl-sm border backdrop-blur-sm transition-colors duration-200 ease-out-soft",
                      isOpen
                        ? "bg-white/10 border-blue-300"
                        : "bg-white/5 border-white/15 group-hover:border-white/30",
                    )}
                  >
                    <button
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 p-6 md:p-8 text-left"
                    >
                      <div className="flex items-center gap-5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "w-1 h-8 rounded-full transition-colors duration-200",
                            isOpen ? "bg-amber-400" : "bg-white/25",
                          )}
                        />
                        <span className="text-base md:text-lg text-paper" style={QUESTION}>
                          {faq.question}
                        </span>
                      </div>

                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-200",
                          isOpen ? "bg-paper text-navy" : "bg-white/10 text-blue-100",
                        )}
                      >
                        <svg
                          className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>

                    <div
                      className="overflow-hidden transition-all duration-200 ease-out-soft"
                      style={{ maxHeight: isOpen ? "320px" : "0px" }}
                    >
                      <div className="px-8 md:px-[4.5rem] pb-8 pt-1">
                        <p className="text-sm text-blue-100/80 leading-relaxed border-t border-white/15 pt-5">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <p className="text-center text-blue-100/60 text-sm mt-12">
          Masih ada pertanyaan?{" "}
          <a href="#" className="text-paper font-medium hover:underline underline-offset-4">
            Hubungi kami
          </a>
        </p>
      </div>
    </section>
  );
}
