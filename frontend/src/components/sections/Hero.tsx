"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Hero() {
  // Muncul dari samping begitu halaman dimuat, lalu mengikuti scroll:
  // makin jauh Hero terscroll ke atas (mendekati About), makin jauh pula
  // gambar terdorong ke sisinya masing-masing sambil memudar.
  const [mounted, setMounted] = useState(false);
  const [exitT, setExitT] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;

    const onScroll = () => {
      const rect = hero.getBoundingClientRect();
      const progress = -rect.top / rect.height;
      setExitT(Math.min(Math.max(progress, 0), 1));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex items-center bg-hero-navy overflow-hidden">
      {/* Maskot pojok kiri-bawah — masuk dari bawah+luar sambil berputar,
          lalu melayang idle, dan mundur ke pojoknya sendiri saat discroll
          menuju About. */}
      <div
        aria-hidden="true"
        className="hidden lg:block absolute bottom-0 left-0 xl:left-25 xl:bottom-10 z-10 w-48 xl:w-64 pointer-events-none select-none"
        style={{
          transform: `translate(${mounted ? -exitT * 120 : -140}px, ${mounted ? exitT * 160 : 180}px) rotate(${mounted ? -exitT * 14 : -18}deg) scale(${mounted ? 1 - exitT * 0.15 : 0.85})`,
          opacity: mounted ? Math.max(0, 1 - exitT * 1.3) : 0,
          transition: "transform 900ms var(--ease-warm), opacity 900ms var(--ease-warm)",
        }}
      >
        <div className={`transition-transform duration-300 ease-out-soft ${mounted && exitT === 0 ? "animate-float-bob-left" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/4.png" alt="" className="w-full h-auto drop-shadow-2xl scale-x-[-4] scale-y-[4]" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden lg:block absolute bottom-0 right-0 xl:right-25 xl:bottom-10 z-10 w-48 xl:w-64 pointer-events-none select-none"
        style={{
          transform: `translate(${mounted ? exitT * 120 : 140}px, ${mounted ? exitT * 160 : 180}px) rotate(${mounted ? exitT * 14 : 18}deg) scale(${mounted ? 1 - exitT * 0.15 : 0.85})`,
          opacity: mounted ? Math.max(0, 1 - exitT * 1.3) : 0,
          transition: "transform 900ms var(--ease-warm), opacity 900ms var(--ease-warm)",
        }}
      >
        <div className={`transition-transform duration-300 ease-out-soft ${mounted && exitT === 0 ? "animate-float-bob-right" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/5.png" alt="" className="w-full h-auto drop-shadow-2xl scale-x-[5] scale-y-[5]" />
        </div>
      </div>

      <div className="relative z-10 w-full container-page pt-32 pb-20">
        <div className="relative max-w-3xl mx-auto text-center">
          <h1
            className="rise-in text-paper"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: "-0.04em",
              "--rise-delay": "170ms",
            } as React.CSSProperties}
          >
            Platform Terbaik <br />
            Kuasai Ilmu Apapun
          </h1>

          <p
            className="rise-in text-lg 2xl:text-xl leading-relaxed text-blue-100/80 max-w-lg 2xl:max-w-xl mt-8 mx-auto"
            style={{ "--rise-delay": "300ms" } as React.CSSProperties}
          >
            Akses ratusan materi berkualitas dari berbagai bidang ilmu. Didesain untuk pelajar,
            mahasiswa, dan profesional di semua bidang.
          </p>

          <div
            className="rise-in flex flex-wrap gap-3 mt-9 justify-center"
            style={{ "--rise-delay": "400ms" } as React.CSSProperties}
          >
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold bg-paper text-navy transition-all duration-200 ease-out-soft hover:bg-white hover:-translate-y-0.5 hover:shadow-lift"
            >
              Mulai Belajar
              <svg
                className="w-4 h-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-1"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#courses"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-lg text-sm font-semibold text-paper border border-white/25 transition-colors duration-200 ease-out-soft hover:bg-white/10 hover:border-white/50"
            >
              Lihat Kurikulum
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
