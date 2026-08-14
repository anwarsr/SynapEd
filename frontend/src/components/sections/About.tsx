"use client";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

const points = [
  {
    num: "01",
    title: "Terstruktur",
    desc: "Kurikulum disusun secara terstruktur dan terukur, dari dasar hingga mahir, sehingga memudahkan pemahaman bertahap tanpa lompatan materi.",
    iconPath:
      "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z",
  },
  {
    num: "02",
    title: "Interaktif",
    desc: "Elemen interaktif dan kuis di setiap modul menjadikan pembelajaran lebih menarik, efektif, dan mudah diingat dalam jangka panjang.",
    iconPath:
      "M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59",
  },
  {
    num: "03",
    title: "Berbasis Riset",
    desc: "Seluruh materi divalidasi berdasarkan jurnal dan literatur ilmiah internasional terbaru, dikurasi bersama para ahli di bidangnya.",
    iconPath:
      "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
  },
];

export default function About() {
  // Panel gambar tetap diam (sticky) selagi daftar poin di sampingnya
  // berpindah sorotan mengikuti seberapa jauh section ini sudah discroll —
  // satu poin aktif per "layar" scroll, seperti buku yang halamannya
  // berganti sendiri.
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;

      const progress = Math.min(Math.max(-rect.top / total, 0), 1);
      const idx = Math.min(points.length - 1, Math.floor(progress * points.length));
      setActive(idx);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="about" className="bg-paper">
      <div className="container-page pt-28">
        {/* Kepala section versi modern: sans-serif tebal seperti H1 Hero,
            bukan serif "buku teks" yang dipakai section lain — biru di
            atas putih, bukan tinta netral. */}
        <Reveal className="mb-14 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-[0.14em] mb-6">
            01 — Tentang
          </span>

          <h2
            className="max-w-3xl text-blue-700"
            style={{
              fontFamily: "var(--font-inter)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)",
            }}
          >
            Platform pembelajaran modern <br />
            untuk <span className="text-blue-500">generasi digital</span>
          </h2>

          <span className="rule-accent mt-6 mx-auto" aria-hidden="true" />

          <p className="t-body mt-6 max-w-2xl text-blue-700/70">
            SynapEd menghadirkan pembelajaran dari berbagai bidang ilmu secara sistematis dan
            terstruktur. Materi dirancang agar mudah dipahami oleh pelajar dan pemula tanpa
            memerlukan latar belakang khusus.
          </p>
        </Reveal>
      </div>

      {/* Desktop — panel gambar sticky + poin bergilir mengikuti scroll. */}
      <div ref={trackRef} className="hidden md:block relative" style={{ height: `${points.length * 100}vh` }}>
        <div className="sticky top-0 h-screen flex items-center">
          <div className="container-page w-full grid grid-cols-2 gap-16 items-center">
            <div className="relative aspect-4/3 rounded-3xl border border-blue-100 bg-blue-50 overflow-hidden">
              {points.map((p, i) => (
                <div
                  key={p.title}
                  className="absolute inset-0 flex items-center justify-center transition-all duration-700 ease-warm"
                  style={{
                    opacity: active === i ? 1 : 0,
                    transform: active === i ? "scale(1)" : "scale(1.05)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="t-numeral-ghost absolute -bottom-10 -right-4 text-[13rem] text-blue-100 select-none"
                  >
                    {p.num}
                  </span>
                  <div className="relative w-28 h-28 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lift">
                    <svg
                      className="w-14 h-14 text-white"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              {points.map((p, i) => {
                const isActive = active === i;
                return (
                  <div
                    key={p.title}
                    className={cn(
                      "py-4 border-b transition-colors duration-500 ease-warm",
                      isActive ? "border-blue-300" : "border-blue-100",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={cn(
                          "w-5 h-5 shrink-0 text-blue-500 transition-all duration-400 ease-warm",
                          isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
                        )}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <h3
                        className={cn(
                          "font-sans font-extrabold tracking-tight transition-all duration-400 ease-warm",
                          isActive ? "text-3xl text-blue-700" : "text-xl text-blue-300",
                        )}
                        style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.02em" }}
                      >
                        {p.title}
                      </h3>
                    </div>

                    <div
                      className="grid transition-all duration-500 ease-warm"
                      style={{ gridTemplateRows: isActive ? "1fr" : "0fr", opacity: isActive ? 1 : 0 }}
                    >
                      <div className="overflow-hidden">
                        <p className="t-body mt-3 pl-8 max-w-md text-blue-700/70">{p.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile — scroll-jacking terasa buruk di layar sentuh, jadi di sini
          ketiga poin ditumpuk polos seperti kartu biasa. */}
      <div className="md:hidden container-page py-16">
        <div className="flex flex-col gap-5">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 110}>
              <div className="border border-blue-100 rounded-2xl p-6 bg-paper-card">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                  </svg>
                </div>
                <h3
                  className="font-extrabold tracking-tight text-blue-700 mb-2 text-xl"
                  style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.02em" }}
                >
                  {p.title}
                </h3>
                <p className="t-body text-sm text-blue-700/70">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
