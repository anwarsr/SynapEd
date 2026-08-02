"use client";
import { useState } from "react";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";
import { stats } from "@/data/landing";

export default function Hero() {
  const [activePhoto, setActivePhoto] = useState(0);

  const photos = [
    { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80", alt: "Mahasiswa sedang belajar" },
    { src: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80", alt: "Laboratorium riset" },
    { src: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80", alt: "Teknologi dan pembelajaran" },
  ];

  return (
    <section id="hero" className="relative min-h-screen flex items-center bg-hero-navy overflow-hidden">
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-32 pb-24 grid lg:grid-cols-[1.05fr_1fr] items-center gap-14 lg:gap-10">
        {/* ── Kiri — teks ─────────────────────────────────── */}
        <div className="text-center lg:text-left">
          <div
            className="rise-in inline-flex items-center gap-2.5 px-4 py-2 bg-white/10 border border-white/15 rounded-full mb-8 backdrop-blur-sm"
            style={{ "--rise-delay": "60ms" } as React.CSSProperties}
          >
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            <span className="text-xs font-medium text-blue-100">Belajar Lebih Seru dan Menarik di SynapEd</span>
          </div>

          <h1
            className="rise-in text-paper"
            style={{
              fontFamily: "var(--font-fraunces)",
              fontSize: "clamp(2.9rem, 5.6vw, 4.75rem)",
              fontWeight: 400,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              fontVariationSettings: '"opsz" 120, "SOFT" 40, "WONK" 1',
              "--rise-delay": "160ms",
            } as React.CSSProperties}
          >
            Platform Terbaik <br />
            <span className="mark mark-on-dark">Kuasai Ilmu Apapun</span>
          </h1>

          <p
            className="rise-in text-lg lg:text-xl leading-relaxed text-blue-100/85 max-w-xl mt-8 mx-auto lg:mx-0"
            style={{ "--rise-delay": "280ms" } as React.CSSProperties}
          >
            Akses ratusan materi berkualitas dari berbagai bidang ilmu. Didesain untuk pelajar,
            mahasiswa, dan profesional di semua bidang.
          </p>

          <div
            className="rise-in flex flex-wrap gap-3 mt-10 justify-center lg:justify-start"
            style={{ "--rise-delay": "380ms" } as React.CSSProperties}
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

          {/* Strip bukti — mengisi ruang bawah sekaligus memberi bobot */}
          <div
            className="rise-in flex items-center gap-8 sm:gap-12 mt-14 pt-8 border-t border-white/12 justify-center lg:justify-start"
            style={{ "--rise-delay": "480ms" } as React.CSSProperties}
          >
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="text-center lg:text-left">
                <CountUp
                  value={s.value}
                  className="block text-paper text-2xl sm:text-3xl tabular-nums"
                />

                <div className="t-label text-blue-300 mt-1.5 text-[0.6rem]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Kanan — tumpukan foto + kartu mengambang ─────── */}
        <div
          className="rise-in hidden lg:flex justify-center"
          style={{ "--rise-delay": "300ms" } as React.CSSProperties}
        >
          <div className="relative w-[460px] h-[480px]">
            {/* Bingkai garis — kedalaman tanpa menambah blok berat */}
            <div
              aria-hidden="true"
              className="absolute right-2 bottom-2 w-[350px] h-[370px] rounded-3xl border border-white/15"
            />
            <div
              aria-hidden="true"
              className="drift absolute right-[38px] bottom-[-10px] w-[300px] h-[3px] bg-amber-500 rounded-full"
              style={{ "--drift-delay": "1.4s" } as React.CSSProperties}
            />

            <div className="absolute left-0 top-0 z-10 w-[400px] h-[430px]">
              {photos.map((photo, i) => {
                const isActive = activePhoto === i;
                const offset = isActive ? 0 : i < activePhoto ? -30 : 30;
                const rotation = isActive ? 0 : i < activePhoto ? -3.5 : 3.5;

                return (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    aria-label={`Tampilkan foto: ${photo.alt}`}
                    className="absolute inset-0 cursor-pointer transition-all duration-300 ease-out-soft"
                    style={{
                      transform: `translateX(${offset}px) rotate(${rotation}deg)`,
                      zIndex: isActive ? 30 : 10,
                      opacity: isActive ? 1 : 0.55,
                    }}
                  >
                    <div className="w-full h-full rounded-3xl overflow-hidden border-[6px] border-white/90 shadow-lift">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.src} className="w-full h-full object-cover photo-warm" alt={photo.alt} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dua kartu mengambang — titik baca & kedalaman */}
            <div className="drift absolute z-40 -left-10 bottom-24 bg-paper-card border border-rule rounded-2xl px-5 py-4 shadow-lift">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink leading-tight">Kurikulum Terstruktur</div>
                  <div className="text-xs text-ink-muted">Dari dasar hingga lanjutan</div>
                </div>
              </div>
            </div>

            <div
              className="drift absolute z-40 -right-4 top-10 bg-paper-card border border-rule rounded-2xl px-4 py-3 shadow-lift"
              style={{ "--drift-delay": "2.2s" } as React.CSSProperties}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink leading-tight">4.8 dari 5</div>
                  <div className="text-xs text-ink-muted">Rating pelajar</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
