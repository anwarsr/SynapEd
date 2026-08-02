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

  const featureIcons = [
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    "M15 10l4.553-2.069A1 1 0 0121 8.873v6.254a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
    "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  ];

  return (
    <section ref={sectionRef} id="features" className="py-28 bg-paper">
      <div className="max-w-7xl mx-auto px-6">
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
            <Reveal key={i} delay={(i % 3) * 110} className="h-full">
              <Card hover className="group p-8 h-full transition-transform duration-300 ease-out-soft hover:-translate-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 transition-colors duration-300 group-hover:bg-blue-600">
                  <svg
                    className="w-6 h-6 text-blue-700 transition-colors duration-300 group-hover:text-white"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={featureIcons[i]} />
                  </svg>
                </div>
                <h3 className="t-h3 text-lg mb-2">{feat.title}</h3>
                <p className="t-body text-sm">{feat.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
