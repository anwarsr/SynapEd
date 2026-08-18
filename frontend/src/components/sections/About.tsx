"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

const points = [
  {
    num: "01",
    title: "Terstruktur",
    desc: "Kurikulum disusun secara terstruktur dan terukur, dari dasar hingga mahir, sehingga memudahkan pemahaman bertahap tanpa lompatan materi.",
    image: "/images/terstruktur.jpg",
  },
  {
    num: "02",
    title: "Interaktif",
    desc: "Elemen interaktif dan kuis di setiap modul menjadikan pembelajaran lebih menarik, efektif, dan mudah diingat dalam jangka panjang.",
    image: "/images/interaktif.jpg",
  },
  {
    num: "03",
    title: "Berbasis Riset",
    desc: "Seluruh materi divalidasi berdasarkan jurnal dan literatur ilmiah internasional terbaru, dikurasi bersama para ahli di bidangnya.",
    image: "/images/riset.jpg",
  },
];

export default function About() {
  // Track scroll untuk menentukan card yang sedang aktif.
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;

      if (total <= 0) return;

      const progress = Math.min(
        Math.max(-rect.top / total, 0),
        1
      );

      const idx = Math.min(
        points.length - 1,
        Math.floor(progress * points.length)
      );

      setActive(idx);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="about" className="bg-paper">
      <div className="container-page pt-32 pb-6">
        {/* Penanda section ringkas */}
        <Reveal>
          <h1
            className="rise-in text-blue-600"
            style={
              {
                fontFamily: "var(--font-inter)",
                fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
                fontWeight: 800,
                lineHeight: 1.03,
                letterSpacing: "-0.04em",
                "--rise-delay": "170ms",
              } as React.CSSProperties
            }
          >
            Tentang SynapEd
          </h1>
        </Reveal>
      </div>

      {/* =========================================================
          DESKTOP
          Card bergerak dari bawah ke atas / atas ke bawah mengikuti scroll
          ========================================================= */}
      <div
        ref={trackRef}
        className="hidden md:block relative"
        style={{
          height: `${points.length * 100}vh`,
        }}
      >
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="container-page w-full grid grid-cols-2 gap-30 items-center">

            {/* =====================================================
                CARD
                ===================================================== */}
            <div className="relative h-[75vh] flex items-center justify-center">

              {points.map((p, i) => {
                const offset = i - active;

                /*
                 * Card aktif:
                 *   offset = 0
                 *
                 * Card berikutnya:
                 *   offset = 1
                 *   masuk dari bawah
                 *
                 * Card sebelumnya:
                 *   offset = -1
                 *   keluar ke atas
                 */
                const translateY = offset * 105;

                /*
                 * Card aktif sedikit miring.
                 * Card yang keluar/masuk memiliki arah kemiringan
                 * yang berbeda agar terasa seperti kartu fisik.
                 */
                const rotation =
                  offset === 0
                    ? -1.5
                    : offset > 0
                    ? 4
                    : -4;

                const scale =
                  offset === 0
                    ? 1
                    : 0.94;

                const opacity =
                  Math.abs(offset) > 1
                    ? 0
                    : offset === 0
                    ? 1
                    : 0.35;

                return (
                  <div
                    key={p.title}
                    className="absolute w-[82%] aspect-[4/5] overflow-hidden shadow-lift"
                    style={{
                      transform: `
                        translateY(${translateY}%)
                        rotate(${rotation}deg)
                        scale(${scale})
                      `,

                      opacity,

                      transition:
                        "transform 800ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 500ms ease",

                      zIndex:
                        points.length - Math.abs(offset),

                      /*
                       * Sudut dibuat sedikit berbeda supaya
                       * tidak terlihat seperti kotak sempurna.
                       */
                      borderRadius:
                        "18px 10px 22px 12px",

                      /*
                       * Sedikit condong / tidak simetris
                       * pada keempat sudut card.
                       */
                      clipPath:
                        "polygon(2% 0%, 98% 1%, 100% 96%, 96% 100%, 3% 98%, 0% 4%)",

                      willChange:
                        "transform, opacity",
                    }}
                  >
                    {/* =================================================
                        GAMBAR
                        TIDAK DIUBAH
                        ================================================= */}

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-blue-900/60 via-blue-900/0 to-blue-900/0" />

                    {/* Nomor */}
                    <span
                      className="absolute top-5 left-5 w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm shadow-lift"
                      style={{
                        fontFamily: "var(--font-inter)",
                        fontWeight: 800,
                      }}
                    >
                      {p.num}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* =====================================================
                TEXT AREA
                ===================================================== */}
            <div className="flex flex-col">

              <div className="flex flex-col gap-8">
                {points.map((p, i) => {
                  const isActive = active === i;

                  return (
                    <div
                      key={p.title}
                      className="flex items-center gap-3"
                    >
                      <svg
                        className={cn(
                          "w-6 h-6 shrink-0 text-blue-600 transition-all duration-400 ease-warm",
                          isActive
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 -translate-x-2"
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>

                      <h3
                        className={cn(
                          "font-sans tracking-tight transition-all duration-400 ease-warm",
                          isActive
                            ? "text-7xl text-blue-600"
                            : "text-xl text-black"
                        )}
                        style={{
                          fontFamily:
                            "var(--font-inter)",
                          fontWeight: 900,
                          letterSpacing: "-0.025em",
                        }}
                      >
                        {p.title}
                      </h3>
                    </div>
                  );
                })}
              </div>

              {/* Deskripsi */}
              <p
                key={active}
                className="text-2xl text-justify rise-in t-body mt-8 max-w-md text-black"
              >
                {points[active].desc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          MOBILE
          Tidak diubah
          ========================================================= */}
      <div className="md:hidden container-page py-10">
        <div className="flex flex-col gap-5">
          {points.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 110}
            >
              <div className="border border-blue-100 rounded-2xl overflow-hidden bg-paper-card">

                <div className="relative h-44 bg-blue-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-linear-to-t from-blue-900/60 via-blue-900/0 to-blue-900/0" />

                  <span
                    className="absolute top-4 left-4 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-lift"
                    style={{
                      fontFamily:
                        "var(--font-inter)",
                      fontWeight: 800,
                    }}
                  >
                    {p.num}
                  </span>
                </div>

                <div className="p-6">
                  <h3
                    className="tracking-tight text-blue-600 mb-2 text-xl"
                    style={{
                      fontFamily:
                        "var(--font-inter)",
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {p.title}
                  </h3>

                  <p className="t-body text-sm text-blue-600">
                    {p.desc}
                  </p>
                </div>

              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}