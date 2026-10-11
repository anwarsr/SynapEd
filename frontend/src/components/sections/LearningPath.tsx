"use client";

import { useEffect, useRef, useState } from "react";
import { learningSteps } from "@/data/landing";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";
import Reveal from "@/components/ui/Reveal";

const SANS = { fontFamily: "var(--font-sans)" } as const;

/** Angka langkah: berganti-ganti digit acak lalu "mengunci" satu per satu saat langkahnya menyala. */
function AngkaAcak({ teks, aktif }: { teks: string; aktif: boolean }) {
  const [tampil, setTampil] = useState(teks);
  const sudah = useRef(false);

  useEffect(() => {
    if (!aktif || sudah.current) return;
    sudah.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t0 = performance.now();
    const id = setInterval(() => {
      const t = performance.now() - t0;
      const huruf = teks.split("").map((c, i) => (t >= 380 + i * 160 ? c : String(Math.floor(Math.random() * 10))));
      setTampil(huruf.join(""));
      if (t >= 380 + teks.length * 160) {
        clearInterval(id);
        setTampil(teks);
      }
    }, 55);
    return () => clearInterval(id);
  }, [aktif, teks]);

  return <>{tampil}</>;
}

/**
 * Versi ponsel: rel tegak yang terisi biru MENGIKUTI GULIRAN, simpul kotak di
 * tiap langkah menyala + berdenyut satu kali saat dicapai rel, kartu langkah
 * meluncur masuk dari kanan (kabur → tajam) dengan sedikit pantulan, dan
 * angkanya mengacak digit lalu terkunci. Semua teks Plus Jakarta Sans.
 * Dapat dibalik: menggulir ke atas mematikan langkahnya lagi.
 */
function LearningPathMobile() {
  const listRef = useRef<HTMLOListElement>(null);
  const [nyala, setNyala] = useState(0);
  const N = learningSteps.length;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.62 - r.top) / Math.max(1, r.height)));
      el.style.setProperty("--rp", p.toFixed(4));
      setNyala(learningSteps.filter((_, i) => p >= (i + 0.3) / N).length);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--rp", "1");
      const id = requestAnimationFrame(() => setNyala(N));
      return () => cancelAnimationFrame(id);
    }

    const id = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [N]);

  return (
    <ol ref={listRef} className="relative pl-11" style={{ ...SANS, "--rp": 0 } as React.CSSProperties}>
      {/* Rel (warna pejal) + isian biru yang tumbuh mengikuti gulir */}
      <span aria-hidden="true" className="absolute bottom-6 left-[7px] top-6 w-px bg-[var(--lp-rel)]" />
      <span
        aria-hidden="true"
        className="absolute left-[7px] top-6 w-px bg-blue-400"
        style={{ height: "calc((100% - 3rem) * var(--rp))" }}
      />

      {learningSteps.map((s, i) => {
        const on = i < nyala;
        return (
          <li key={s.num} className="relative py-7">
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-11 top-[2.35rem] block h-[15px] w-[15px] transition-[background-color,transform] duration-500 ease-warm",
                on ? "lp-m-denyut scale-100 bg-blue-500" : "scale-75 bg-[var(--lp-simpul)]",
              )}
            />

            <div className="lp-m-kartu" data-on={on}>
              <span
                className={cn(
                  "block text-[2.6rem] font-extralight leading-none tracking-[-0.05em] tabular-nums transition-colors duration-700",
                  on ? "text-blue-300" : "text-white/20",
                )}
                style={SANS}
              >
                <AngkaAcak teks={s.num} aktif={on} />
              </span>
              <h3 className="mt-3 text-[1.3rem] font-extrabold leading-tight tracking-[-0.025em] text-white" style={SANS}>
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-body" style={SANS}>
                {s.desc}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function LearningPath() {
  // Garis horizontal memanjang ke kanan mengikuti scroll — satu "layar"
  // scroll per langkah.
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;

      if (total <= 0) return;

      const p = Math.min(Math.max(-rect.top / total, 0), 1);

      setProgress(p);
      setActive(Math.round(p * (learningSteps.length - 1)));
    };

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const step = learningSteps[active];

  return (
    <section id="learning-path" className="bg-ivory">
      {/* Desktop — garis progres sticky yang tumbuh mengikuti scroll */}
      <div
        ref={trackRef}
        className="relative hidden md:block"
        style={{
          height: `${learningSteps.length * 100}vh`,
        }}
      >
        <div className="sticky top-0 flex h-screen flex-col items-center">
          {/* Heading */}
          <SectionTitle as="h3" title="Alur Belajar" className="w-full pt-24" />

          <div className="flex w-full flex-1 items-center">
            <div className="container-page w-full">
              {/* Title */}
              <h2
                key={active}
                className="rise-in max-w-4xl text-white"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(1.5rem, 5vw, 4rem)",
                  fontWeight: 800,
                  lineHeight: 1.03,
                  letterSpacing: "-0.04em",
                }}
              >
                {step.title}
              </h2>

              {/* Description */}
              <p
                key={`desc-${active}`}
                className="rise-in mt-8 max-w-lg text-lg leading-relaxed text-white 2xl:max-w-xl 2xl:text-xl"
              >
                {step.desc}
              </p>

              {/* Garis progres */}
              <div className="relative mt-20 h-px w-full bg-white/15">
                <div
                  className="absolute left-0 top-0 h-px bg-white"
                  style={{
                    width: `${progress * 100}%`,
                  }}
                />

                {learningSteps.map((s, i) => {
                  const left = (i / (learningSteps.length - 1)) * 100;

                  const reached = i <= active;

                  return (
                    <span
                      key={s.num}
                      className={cn(
                        "absolute top-4 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tracking-[0.1em] transition-colors duration-300 ease-out-soft",
                        reached ? "text-white" : "text-white/35",
                      )}
                      style={{
                        left: `${left}%`,
                      }}
                    >
                      {s.num}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile - judul sama dengan section lain; langkah-langkahnya di LearningPathMobile */}
      <div className="container-page pb-24 pt-24 md:hidden">
        <Reveal className="mb-12">
          <SectionTitle title="Alur Belajar" />
        </Reveal>

        <LearningPathMobile />
      </div>
    </section>
  );
}
