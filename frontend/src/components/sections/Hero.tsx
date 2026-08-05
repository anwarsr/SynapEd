"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";
import { stats } from "@/data/landing";

const photos = [
  { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80", alt: "Mahasiswa belajar bersama" },
  { src: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80", alt: "Laboratorium riset" },
  { src: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80", alt: "Teknologi dan pembelajaran" },
];

export default function Hero() {
  const [activePhoto, setActivePhoto] = useState(0);

  return (
    <section id="hero" className="relative min-h-screen flex items-center bg-hero-navy overflow-hidden">
      <div className="relative z-10 w-full container-page pt-32 pb-20 grid lg:grid-cols-[1.05fr_1fr] items-center gap-14 lg:gap-10">
        {/* ── Kiri — teks ─────────────────────────────────── */}
        <div className="text-center lg:text-left">
          <div
            className="rise-in inline-flex items-center gap-2.5 px-4 py-2 bg-white/10 border border-white/15 rounded-full mb-7 backdrop-blur-sm"
            style={{ "--rise-delay": "60ms" } as React.CSSProperties}
          >
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            <span className="text-xs font-medium text-blue-100">Belajar Lebih Seru dan Menarik di SynapEd</span>
          </div>

          <h1
            className="rise-in text-paper"
            style={{
              fontFamily: "var(--font-fraunces)",
              // Dijaga agar frasa bersapuan selalu muat satu baris — kalau
              // membungkus, box-decoration-break memberi sapuan per baris
              // dan yang atas memotong baris di bawahnya.
              fontSize: "clamp(2.05rem, 5.2vw, 5.5rem)",
              fontWeight: 400,
              lineHeight: 1.04,
              letterSpacing: "-0.026em",
              fontVariationSettings: '"opsz" 120, "SOFT" 40, "WONK" 1',
              "--rise-delay": "170ms",
            } as React.CSSProperties}
          >
            Platform Terbaik <br />
            <span className="mark mark-on-dark">Kuasai Ilmu Apapun</span>
          </h1>

          <p
            className="rise-in text-lg 2xl:text-xl leading-relaxed text-blue-100/80 max-w-lg 2xl:max-w-xl mt-8 mx-auto lg:mx-0"
            style={{ "--rise-delay": "300ms" } as React.CSSProperties}
          >
            Akses ratusan materi berkualitas dari berbagai bidang ilmu. Didesain untuk pelajar,
            mahasiswa, dan profesional di semua bidang.
          </p>

          <div
            className="rise-in flex flex-wrap gap-3 mt-9 justify-center lg:justify-start"
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

          <div
            className="rise-in flex items-start gap-7 sm:gap-10 mt-12 pt-8 border-t border-white/12 justify-center lg:justify-start"
            style={{ "--rise-delay": "500ms" } as React.CSSProperties}
          >
            {stats.slice(0, 3).map((s, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden="true" className="w-px h-9 bg-white/15 mt-1" />}
                <div>
                  <CountUp value={s.value} className="block text-paper text-2xl sm:text-3xl tabular-nums" />
                  <div className="t-label text-blue-300/80 mt-1.5 text-[0.58rem] tracking-[0.07em] sm:tracking-[0.13em]">
                    {s.label}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        {/* ── Kanan — tumpukan foto + kartu mengambang ─────── */}
        <div
          className="rise-in hidden lg:flex justify-center"
          style={{ "--rise-delay": "300ms" } as React.CSSProperties}
        >
          {/* SATU sistem offset untuk semua elemen: tiap lapis bergeser
              tetap 18px ke kanan dan 14px ke atas. Bingkai kosong adalah
              lapis ke-4 yang meneruskan irama yang sama, bukan bentuk
              nyasar. Kartu dikunci ke tepi kiri dengan overhang identik. */}
          {/* Seluruh susunan memakai posisi absolut dalam piksel tetap, jadi
              cara paling aman membesarkannya di layar lebar adalah scale —
              perbandingan antar lapis tetap terjaga persis. */}
          <div className="relative w-[446px] h-[478px] 2xl:scale-110">
            {/* Lapis 4 — bingkai kosong, penutup kaskade */}
            <div
              aria-hidden="true"
              className="absolute rounded-3xl border border-white/12"
              style={{ left: 54, top: 0, width: 390, height: 420 }}
            />

            {/* Dek foto — aktif selalu di depan, sisanya mengekor berurutan */}
            {photos.map((photo, i) => {
              const isActive = i === activePhoto;
              const rest = photos.map((_, idx) => idx).filter((idx) => idx !== activePhoto);
              const depth = isActive ? 0 : rest.indexOf(i) + 1;

              return (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  aria-label={`Tampilkan foto: ${photo.alt}`}
                  className="absolute cursor-pointer rounded-3xl transition-all duration-300 ease-out-soft"
                  style={{
                    left: 0,
                    top: 42,
                    width: 390,
                    height: 420,
                    transform: `translate(${depth * 18}px, ${depth * -14}px)`,
                    zIndex: 30 - depth,
                    opacity: isActive ? 1 : 0.4,
                  }}
                >
                  <div className="w-full h-full rounded-3xl overflow-hidden border-[6px] border-white/90 shadow-lift">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} className="w-full h-full object-cover photo-warm" alt={photo.alt} />
                  </div>
                </button>
              );
            })}

            {/* Garis amber menempel rapat di bawah foto depan —
                menggemakan sapuan di judul, bukan garis melayang. */}
            <div
              aria-hidden="true"
              className="absolute bg-amber-500 rounded-full"
              style={{ left: 24, top: 472, width: 342, height: 3 }}
            />

            {/* Kedua kartu dikunci ke tepi kiri, overhang sama (-26px) */}
            <div
              className="drift absolute z-40 bg-paper-card border border-rule rounded-2xl px-4 py-3 shadow-lift"
              style={{ left: -26, top: 86, "--drift-delay": "2.2s" } as React.CSSProperties}
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

            <div
              className="drift absolute z-40 bg-paper-card border border-rule rounded-2xl px-4 py-3 shadow-lift"
              style={{ left: -26, top: 348 }}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
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
          </div>
        </div>
      </div>
    </section>
  );
}
