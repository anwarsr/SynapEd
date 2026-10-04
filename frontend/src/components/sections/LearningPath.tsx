"use client";

import { useEffect, useRef, useState } from "react";
import { learningSteps } from "@/data/landing";
import { cn } from "@/lib/cn";

export default function LearningPath() {
  // Garis horizontal memanjang ke kanan mengikuti scroll — satu "layar"
  // scroll per langkah, sama seperti panel foto sticky di About.tsx,
  // tapi progresnya divisualkan sebagai garis, bukan crossfade foto.
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
    <section id="learning-path" className="bg-paper">
      {/* Desktop — garis progres sticky yang tumbuh mengikuti scroll */}
      <div
        ref={trackRef}
        className="hidden md:block relative"
        style={{
          height: `${learningSteps.length * 100}vh`,
        }}
      >
        <div className="sticky top-0 h-screen flex flex-col items-end pr-12">
          {/* Heading */}
          <h3
            className="text-blue-600 pt-28"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: "-0.04em",
            }}
          >
            Alur Belajar
          </h3>

          <div className="flex-1 flex items-center w-full">
            <div className="container-page w-full">
              {/* Title */}
              <h2
                key={active}
                className="rise-in text-blue-600 max-w-4xl"
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
                className="rise-in text-black text-lg 2xl:text-xl leading-relaxed max-w-lg 2xl:max-w-xl mt-8"
              >
                {step.desc}
              </p>

              {/* Garis progres */}
              <div className="relative mt-20 h-px w-full bg-black/15">
                <div
                  className="absolute left-0 top-0 h-px bg-blue-600"
                  style={{
                    width: `${progress * 100}%`,
                  }}
                />

                {learningSteps.map((s, i) => {
                  const left =
                    (i / (learningSteps.length - 1)) * 100;

                  const reached = i <= active;

                  return (
                    <span
                      key={s.num}
                      className={cn(
                        "absolute top-4 -translate-x-1/2 text-xs font-semibold tracking-[0.1em] whitespace-nowrap transition-colors duration-300 ease-out-soft",
                        reached
                          ? "text-blue-600"
                          : "text-black/35",
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

      {/* Mobile */}
      <div className="md:hidden container-page py-24">
        <p className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/50 mb-10">
          <span
            aria-hidden="true"
            className="w-6 h-px bg-black/20"
          />

          Alur Belajar

          <span
            aria-hidden="true"
            className="w-6 h-px bg-black/20"
          />
        </p>

        <div className="flex flex-col">
          {learningSteps.map((s) => (
            <div
              key={s.num}
              className="flex gap-5 py-5 border-b border-black/10 last:border-0"
            >
              {/* Number */}
              <span
                className="text-blue-600 shrink-0"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.num}
              </span>

              <div>
                {/* Title */}
                <h3
                  className="text-blue-600 mb-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.title}
                </h3>

                {/* Description */}
                <p className="text-black text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

