"use client";

import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { faqs } from "@/data/landing";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";

/** Tipografi FAQ */
const QUESTION: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  letterSpacing: "-0.025em",
  lineHeight: 1.15,
};

const FACE: React.CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

/**
 * Tata letak ubin di desktop: 6 kolom — baris pertama tiga ubin selebar 2
 * kolom, baris kedua dua ubin selebar 3 kolom — jadi seluruh area terisi
 * penuh tanpa sisa kosong. Di ponsel satu kolom.
 */
function spanOf(i: number, total: number): string {
  const barisAtas = Math.ceil(total / 2);
  return i < barisAtas ? "md:col-span-2" : "md:col-span-3";
}

export default function FAQ() {
  // Tiap ubin membalik sendiri-sendiri; beberapa boleh terbuka sekaligus.
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section id="faq" className="relative flex min-h-screen flex-col overflow-hidden bg-ivory">
      {/* =====================================================
          JUDUL — baris tersendiri di atas ubin, jadi tak pernah tertutup
          ubin dan tak mengganggu susunannya.
      ====================================================== */}

      <div className="container-page pb-10 pt-24 sm:pb-12 sm:pt-28">
        <Reveal>
          <SectionTitle title="FAQ" />
        </Reveal>
      </div>

      {/* =====================================================
          UBIN — memenuhi sisa section sampai tepi layar. Ditekan →
          terbalik (rotateY) dan menampilkan jawabannya.
      ====================================================== */}

      <div className="grid flex-1 grid-cols-1 gap-1 md:min-h-[640px] md:grid-cols-6 md:grid-rows-2">
        {faqs.map((faq, i) => {
          const open = flipped.has(i);

          return (
            <Reveal key={i} delay={i * 90} className={cn("h-full min-h-[300px]", spanOf(i, faqs.length))}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={open}
                aria-label={open ? `Tutup jawaban: ${faq.question}` : `Lihat jawaban: ${faq.question}`}
                className="group block h-full w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-500"
                style={{ perspective: "1600px" }}
              >
                <span
                  className="relative block h-full w-full transition-transform duration-[900ms] ease-warm motion-reduce:transition-none"
                  style={{ transformStyle: "preserve-3d", transform: open ? "rotateY(180deg)" : "rotateY(0deg)" }}
                >
                  {/* ── Depan: nomor + pertanyaan ── */}
                  <span
                    aria-hidden={open}
                    className="absolute inset-0 flex flex-col justify-between bg-paper-card p-7 transition-colors duration-500 group-hover:bg-[#16324A] sm:p-9"
                    style={FACE}
                  >
                    <span className="flex items-start justify-between">
                      <span
                        className="select-none text-white/90"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(3.5rem, 7vw, 6rem)",
                          fontWeight: 900,
                          lineHeight: 0.8,
                          letterSpacing: "-0.08em",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                        Ketuk untuk membalik
                      </span>
                    </span>

                    <span className="block max-w-[28ch] text-xl text-white sm:text-2xl" style={QUESTION}>
                      {faq.question}
                    </span>
                  </span>

                  {/* ── Belakang: jawaban ── */}
                  <span
                    aria-hidden={!open}
                    className="absolute inset-0 flex flex-col justify-between bg-blue-600 p-7 sm:p-9"
                    style={{ ...FACE, transform: "rotateY(180deg)" }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                      {String(i + 1).padStart(2, "0")} · Jawaban
                    </span>

                    <span
                      className="block max-w-[46ch] text-base leading-[1.7] text-white sm:text-lg"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {faq.answer}
                    </span>
                  </span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
