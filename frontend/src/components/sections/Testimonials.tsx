"use client";
import { useRef } from "react";
import SectionHeader from "@/components/ui/SectionHeader";
import { testimonials } from "@/data/landing";
import { cn } from "@/lib/cn";

export default function Testimonials() {
  const sliderRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!sliderRef.current) return;
    const card = sliderRef.current.querySelector(".snap-center") as HTMLElement | null;
    const w = (card?.offsetWidth || 300) + 20;
    sliderRef.current.scrollLeft += dir === "left" ? -w : w;
  };

  return (
    <section id="testimonials" className="py-28 bg-paper overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader chapter="06" label="Testimoni">
          Apa kata <span className="mark">mereka</span> yang sudah belajar
        </SectionHeader>

        <div
          ref={sliderRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth pb-4"
        >
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="group snap-center shrink-0 w-[85%] md:w-[calc(33.333%-0.834rem)] bg-paper-card border border-rule rounded-2xl p-4 flex flex-col transition-all duration-300 ease-out-soft hover:border-rule-strong hover:shadow-lift hover:-translate-y-1.5"
            >
              <div className="h-52 w-full rounded-2xl overflow-hidden mb-7">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.work_image}
                  className="w-full h-full object-cover photo-warm transition-transform duration-[600ms] ease-warm group-hover:scale-105"
                  alt=""
                />
              </div>

              <div className="px-3 pb-5 flex flex-col items-center text-center">
                <p className="t-quote mb-7">&ldquo;{t.content}&rdquo;</p>

                <div className="flex flex-col items-center gap-3 mt-auto">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-rule">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.image}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=142A56&color=fff`;
                      }}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <div className="flex gap-0.5 mt-1.5" aria-label={`Rating ${t.rating} dari 5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg
                          key={s}
                          className={cn("w-3 h-3", s <= t.rating ? "text-amber-500" : "text-rule-strong")}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-3 mt-10">
          {(["left", "right"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => scroll(dir)}
              aria-label={dir === "left" ? "Testimoni sebelumnya" : "Testimoni berikutnya"}
              className="w-11 h-11 rounded-full bg-paper-card border border-rule text-ink flex items-center justify-center transition-colors duration-200 ease-out-soft hover:bg-blue-600 hover:border-blue-600 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={dir === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
