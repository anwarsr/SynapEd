"use client";

import { useEffect, useRef, useState } from "react";
import { learningSteps } from "@/data/landing";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";

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
    <section id="learning-path" className="bg-ivory">
      {/* Desktop — garis progres sticky yang tumbuh mengikuti scroll */}
      <div
        ref={trackRef}
        className="hidden md:block relative"
        style={{
          height: `${learningSteps.length * 100}vh`,
        }}
      >
        <div className="sticky top-0 h-screen flex flex-col items-center">
          {/* Heading */}
          <SectionTitle as="h3" title="Learning Path" className="w-full pt-24" />

          <div className="flex-1 flex items-center w-full">
            <div className="container-page w-full">
              {/* Title */}
              <h2
                key={active}
                className="rise-in text-white max-w-4xl"
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
                className="rise-in text-white text-lg 2xl:text-xl leading-relaxed max-w-lg 2xl:max-w-xl mt-8"
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
                  const left =
                    (i / (learningSteps.length - 1)) * 100;

                  const reached = i <= active;

                  return (
                    <span
                      key={s.num}
                      className={cn(
                        "absolute top-4 -translate-x-1/2 text-xs font-semibold tracking-[0.1em] whitespace-nowrap transition-colors duration-300 ease-out-soft",
                        reached
                          ? "text-white"
                          : "text-white/35",
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
        <p className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/50 mb-10">
          <span
            aria-hidden="true"
            className="w-6 h-px bg-white/20"
          />

          Alur Belajar

          <span
            aria-hidden="true"
            className="w-6 h-px bg-white/20"
          />
        </p>

        <div className="flex flex-col">
          {learningSteps.map((s) => (
            <div
              key={s.num}
              className="flex gap-5 py-5 border-b border-white/10 last:border-0"
            >
              {/* Number */}
              <span
                className="text-white shrink-0"
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
                  className="text-white mb-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.title}
                </h3>

                {/* Description */}
                <p className="text-white text-sm leading-relaxed">
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

