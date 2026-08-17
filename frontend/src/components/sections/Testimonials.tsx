"use client";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { testimonials } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { cn } from "@/lib/cn";

/** Tipografi disamakan dengan About.tsx: Inter tebal, tracking rapat,
 *  biru identitas — bukan serif Fraunces. Bedanya hanya perataan:
 *  kepala section ini di TENGAH, sedangkan About rata kiri. */
const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
  fontWeight: 800,
  lineHeight: 1.03,
  letterSpacing: "-0.04em",
};

const NAME: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 900,
  letterSpacing: "-0.025em",
};

/** Kutipan memakai Inter (bukan Fraunces italic seperti .t-quote)
 *  supaya satu suara dengan About.tsx. */
const QUOTE: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 500,
  lineHeight: 1.6,
  letterSpacing: "-0.02em",
};

export default function Testimonials() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const reducedMotion = useReducedMotion();

  // Barisnya digandakan supaya animasi marquee bisa berulang mulus:
  // saat salinan pertama habis bergeser, salinan kedua sudah menempati
  // posisi yang sama persis, jadi tidak terlihat "melompat".
  const marquee = [...testimonials, ...testimonials];

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (active !== null && !el.open) el.showModal();
    else if (active === null && el.open) el.close();
  }, [active]);

  useEffect(() => {
    // Komentar diketik huruf demi huruf saat kartu dibuka. Saat
    // reduced-motion aktif teksnya langsung utuh — tanpa timer sama sekali.
    if (active === null) return;

    const full = testimonials[active].content;
    if (reducedMotion) {
      setTyped(full);
      return;
    }

    setTyped("");
    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const type = () => {
      i++;
      setTyped(full.slice(0, i));
      if (i < full.length) timeoutId = setTimeout(type, 18);
    };

    timeoutId = setTimeout(type, 220);
    return () => clearTimeout(timeoutId);
  }, [active, reducedMotion]);

  const current = active === null ? null : testimonials[active];

  return (
    <section id="testimonials" className="py-28 bg-paper overflow-hidden">
      <div className="container-page">
        <Reveal className="flex flex-col items-center text-center mb-14">
          <h2 className="text-blue-600 max-w-4xl" style={HEADING}>
            Apa Kata Mereka
          </h2>

          <p className="t-body mt-6 max-w-2xl text-ink-muted">
            Cerita dari pelajar, mahasiswa, dan tenaga pendidik yang sudah belajar bersama SynapEd.
            Ketuk salah satu kartu untuk membaca ceritanya secara utuh.
          </p>
        </Reveal>
      </div>

      {/* Marquee sengaja keluar dari container-page supaya barisnya
          memenuhi lebar layar dan terpotong rapi di kedua tepi. */}
      <div className="testimonial-track">
        <div className="testimonial-marquee">
          {marquee.map((t, i) => {
            const index = i % testimonials.length;
            const isClone = i >= testimonials.length;

            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(index)}
                // Salinan kedua hanya hiasan visual: disembunyikan dari
                // pembaca layar dan dari urutan Tab supaya tidak dobel.
                aria-hidden={isClone || undefined}
                tabIndex={isClone ? -1 : undefined}
                aria-label={`Baca testimoni lengkap dari ${t.name}`}
                className="group w-64 shrink-0 flex flex-col overflow-hidden rounded-2xl border border-blue-100 bg-paper-card text-left transition-all duration-400 ease-warm hover:border-blue-600 hover:shadow-lift hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {/* Panel foto biru pekat + gradasi gelap di kaki — motif
                    yang sama dengan panel gambar di About.tsx. */}
                <div className="relative h-28 w-full overflow-hidden bg-blue-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.work_image}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-warm group-hover:scale-105"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-blue-900/60 via-blue-900/0 to-blue-900/0" />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-ink-body text-[13px] line-clamp-2 mb-4" style={QUOTE}>
                    &ldquo;{t.content}&rdquo;
                  </p>

                  <div className="mt-auto flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden border border-blue-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.image}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=1D4FD0&color=fff`;
                        }}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-blue-600 text-sm truncate" style={NAME}>
                        {t.name}
                      </p>
                      <div className="flex gap-0.5 mt-1" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg
                            key={s}
                            className={cn("w-2.5 h-2.5", s <= t.rating ? "text-amber-500" : "text-blue-100")}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Memakai <dialog> asli seperti ConfirmDialog: jebakan fokus,
          tombol Esc, dan lapisan teratas ditangani browser sendiri. */}
      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          setActive(null);
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) setActive(null);
        }}
        aria-labelledby="testimoni-nama"
        className="dialog-panel m-auto w-[min(34rem,calc(100vw-2rem))] p-0 bg-paper-card border border-blue-100 rounded-2xl shadow-lift"
      >
        {current && (
          <div>
            <div className="relative h-40 w-full overflow-hidden bg-blue-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.work_image} className="absolute inset-0 w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-linear-to-t from-blue-900/70 via-blue-900/10 to-blue-900/0" />

              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Tutup"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-paper-card/90 text-ink flex items-center justify-center transition-colors duration-200 ease-out-soft hover:bg-blue-600 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-7">
              {/* min-height menahan tinggi panel supaya tidak "melar"
                  sebaris demi sebaris selagi teksnya diketik. */}
              <p
                className="text-ink-body text-base min-h-30"
                style={QUOTE}
                aria-live="polite"
              >
                &ldquo;{typed}
                {!reducedMotion && typed.length < current.content.length && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-0.5 h-[0.95em] align-middle bg-blue-500 ml-0.5 animate-pulse"
                  />
                )}
                {typed.length === current.content.length && "”"}
              </p>

              <div className="mt-7 flex items-center gap-3 pt-5 border-t border-blue-100">
                <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden border border-blue-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.image}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(current.name)}&background=1D4FD0&color=fff`;
                    }}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>

                <div>
                  <p id="testimoni-nama" className="text-blue-600 text-lg" style={NAME}>
                    {current.name}
                  </p>
                  <p className="text-ink-muted text-xs mt-0.5">{current.position}</p>
                </div>

                <div className="ml-auto flex gap-0.5" aria-label={`Rating ${current.rating} dari 5`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      className={cn("w-3.5 h-3.5", s <= current.rating ? "text-amber-500" : "text-blue-100")}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
