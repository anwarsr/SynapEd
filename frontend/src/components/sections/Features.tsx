"use client";
import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Reveal from "@/components/ui/Reveal";
import { features } from "@/data/landing";
import { useReducedMotion } from "@/lib/useReducedMotion";

const WORDS = ["Terverifikasi.", "Berkualitas.", "Praktis.", "Fleksibel."];

export default function Features() {
  const [typedText, setTypedText] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Saat reduced-motion aktif, kata ditampilkan statis di bawah —
    // tidak ada timer maupun observer yang dipasang.
    if (reducedMotion) return;

    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const type = () => {
      const current = WORDS[wordIndex];
      if (isDeleting) {
        setTypedText(current.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          wordIndex = (wordIndex + 1) % WORDS.length;
        }
        timeoutId = setTimeout(type, 65);
      } else {
        setTypedText(current.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === current.length) {
          isDeleting = true;
          timeoutId = setTimeout(type, 2600);
        } else {
          timeoutId = setTimeout(type, 130);
        }
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          type();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} id="features" className="py-28 bg-paper">
      <div className="container-page">
        <Reveal className="flex flex-col items-center text-center mb-14">
          <p className="chapter-mark mb-5">
            <span>§04</span>
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Keunggulan</span>
          </p>

          <h2 className="t-h2 max-w-3xl">Kenapa harus SynapEd?</h2>

          <p className="t-h2 text-blue-700 mt-2 min-h-[1.2em]" aria-live="polite">
            {reducedMotion ? WORDS[0] : typedText}
            {!reducedMotion && (
              <span
                className="inline-block w-[2px] h-[0.85em] align-middle bg-blue-500 ml-1 animate-pulse"
                aria-hidden="true"
              />
            )}
          </p>

          <span className="rule-accent mt-6 mx-auto" aria-hidden="true" />

          <p className="t-body mt-6 max-w-2xl text-ink-muted">
            SynapEd menghadirkan pembelajaran dari berbagai bidang ilmu secara sistematis. Materi
            dirancang agar mudah dipahami oleh pelajar dan pemula tanpa memerlukan latar belakang khusus.
          </p>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat, i) => (
            <Reveal key={i} delay={(i % 3) * 110} variant="tilt" className="h-full">
              <Card hover className="group p-8 h-full transition-transform duration-300 ease-out-soft hover:-translate-y-1.5">
                <span
                  aria-hidden="true"
                  className="card-line block w-8 h-px bg-blue-500 mb-6 transition-[width] duration-300 ease-out-soft group-hover:w-12"
                />
                <h3
                  className="text-ink mb-3"
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "clamp(1.25rem, 2vw, 1.625rem)",
                    fontWeight: 800,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {feat.title}
                </h3>
                <p className="t-body text-sm">{feat.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
