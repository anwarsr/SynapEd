"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import Stars from "@/components/ui/Stars";
import UserAvatar from "@/components/ui/UserAvatar";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { cn } from "@/lib/cn";

/**
 * "Apa Kata Mereka" — ulasan sungguhan dari peserta yang sudah menyelesaikan
 * kursusnya.
 *
 * Dulu isinya array testimoni yang ditulis tangan di data/landing.ts. Sekarang
 * datanya datang dari koleksi `reviews`, dan yang boleh menulis hanya pemilik
 * enrollment berstatus selesai — lihat reviewActions.ts.
 *
 * Dua akibat dari data yang nyata, dan keduanya disengaja:
 *
 *   - Bagian ini TIDAK dirender sama sekali kalau belum ada ulasan. Judul
 *     besar dengan ruang kosong di bawahnya lebih buruk daripada tidak ada.
 *     Pemanggilnya cukup merender <Testimonials items={...} /> apa adanya.
 *   - Marquee hanya dipakai saat kartunya cukup banyak. Dengan satu-dua
 *     ulasan, pita berjalan yang mengulang orang yang sama berkali-kali
 *     terbaca seperti mengarang jumlah.
 */

export interface TestimonialItem {
  id: string;
  name: string;
  avatar: string | null;
  content: string;
  rating: number;
  courseTitle: string;
  courseSlug: string;
  /** URL siap pakai, sudah lewat courseImageUrl(). */
  courseImage: string | null;
}

/** Di bawah ini kartunya ditata diam, tanpa pita berjalan. */
const MARQUEE_MIN = 4;

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontSize: "clamp(2.5rem, 6.5vw, 5.75rem)",
  fontWeight: 800,
  lineHeight: 1.03,
  letterSpacing: "-0.04em",
};

const NAME: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 900,
  letterSpacing: "-0.025em",
};

const QUOTE: React.CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontWeight: 500,
  lineHeight: 1.6,
  letterSpacing: "-0.02em",
};

/** Latar kartu saat kursusnya belum punya gambar. */
function CardImage({ src }: { src: string | null }) {
  if (!src) {
    return <div className="absolute inset-0 bg-linear-to-br from-blue-600 to-blue-800" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-warm group-hover:scale-105"
    />
  );
}

export default function Testimonials({ items }: { items: readonly TestimonialItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [charCount, setCharCount] = useState(0);

  const reducedMotion = useReducedMotion();

  const current = active === null ? null : items[active];
  const full = current?.content ?? "";

  /**
   * Efek mengetik pada isi ulasan di dialog.
   *
   * setState-nya ada di dalam callback setTimeout, BUKAN di badan efek.
   * Versi sebelumnya memanggil setTyped langsung di badan efek dan itu memicu
   * render berantai — react-hooks/set-state-in-effect menandainya, dan
   * peringatan itu satu-satunya galat lint yang tersisa di repo ini.
   *
   * Efeknya sengaja bergantung pada charCount: tiap tick menjadwalkan tick
   * berikutnya, dan berhenti sendiri begitu kalimatnya habis.
   */
  useEffect(() => {
    if (active === null || reducedMotion) return;
    if (charCount >= full.length) return;

    const id = setTimeout(() => setCharCount((n) => n + 1), charCount === 0 ? 220 : 18);
    return () => clearTimeout(id);
  }, [active, reducedMotion, charCount, full.length]);

  // Hitungannya di-nol-kan oleh penangan klik, bukan oleh efek — itulah yang
  // membuat efek di atas tidak perlu menulis state secara sinkron.
  function open(index: number) {
    setActive(index);
    setCharCount(0);
  }

  const typed = reducedMotion ? full : full.slice(0, charCount);
  const selesaiMengetik = typed.length === full.length;

  // Belum ada ulasan sama sekali — bagian ini tidak usah ada.
  if (items.length === 0) return null;

  const berjalan = items.length >= MARQUEE_MIN;
  const kartu = berjalan ? [...items, ...items] : items;

  return (
    <section id="testimonials" className="py-28 bg-paper overflow-hidden">
      <div className="container-page">
        <Reveal className="flex flex-col items-center text-center mb-14">
          <h2 className="text-blue-600 max-w-4xl" style={HEADING}>
            Apa Kata Mereka
          </h2>

          <p className="t-body mt-6 max-w-2xl text-ink-muted">
            Ulasan dari peserta yang sudah menyelesaikan kursusnya di SynapEd.
            Ketuk salah satu kartu untuk membaca selengkapnya.
          </p>
        </Reveal>
      </div>

      <div className={cn(berjalan && "testimonial-track")}>
        <div
          className={cn(
            berjalan
              ? "testimonial-marquee"
              : "container-page flex flex-wrap justify-center gap-5",
          )}
        >
          {kartu.map((t, i) => {
            const index = i % items.length;
            const isClone = berjalan && i >= items.length;

            return (
              <button
                key={`${t.id}-${i}`}
                type="button"
                onClick={() => open(index)}
                aria-hidden={isClone || undefined}
                tabIndex={isClone ? -1 : undefined}
                aria-label={`Baca ulasan lengkap dari ${t.name}`}
                className="group w-64 shrink-0 flex flex-col overflow-hidden rounded-2xl bg-paper-card text-left transition-all duration-400 ease-warm hover:shadow-lift hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                <div className="relative h-28 w-full overflow-hidden bg-black">
                  <CardImage src={t.courseImage} />
                  <div className="absolute inset-0 bg-linear-to-t from-blue-900/70 via-blue-900/10 to-blue-900/0" />
                  <span className="absolute bottom-2 left-3 right-3 text-[11px] font-medium text-white/90 truncate">
                    {t.courseTitle}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-ink-body text-[13px] line-clamp-2 mb-4" style={QUOTE}>
                    &ldquo;{t.content}&rdquo;
                  </p>

                  <div className="mt-auto flex items-center gap-3">
                    <UserAvatar name={t.name} photoURL={t.avatar} size="sm" />

                    <div className="min-w-0">
                      <p className="text-black text-sm truncate" style={NAME}>
                        {t.name}
                      </p>
                      <Stars value={t.rating} size="xs" className="mt-1" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dialog dirender sebagai bagian biasa, bukan <dialog> + showModal():
          showModal harus dipanggil dari efek, dan itulah sumber render
          berantai yang dulu ditandai lint. */}
      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ulasan-nama"
          className="fixed inset-0 z-100 flex items-center justify-center bg-ink/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <div className="w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-paper-card shadow-lift">
            <div className="relative h-40 w-full overflow-hidden bg-blue-600">
              <CardImage src={current.courseImage} />
              <div className="absolute inset-0 bg-linear-to-t from-blue-900/70 via-blue-900/10 to-blue-900/0" />

              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Tutup"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-paper-card/90 text-ink flex items-center justify-center transition-colors duration-200 ease-out-soft hover:bg-blue-600 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-7">
              <p className="text-ink-body text-base min-h-30 whitespace-pre-line" style={QUOTE} aria-live="polite">
                &ldquo;{typed}
                {!selesaiMengetik && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-0.5 h-[0.95em] align-middle bg-blue-500 ml-0.5 animate-pulse"
                  />
                )}
                {selesaiMengetik && "”"}
              </p>

              <div className="mt-7 flex items-center gap-3 pt-5">
                <UserAvatar name={current.name} photoURL={current.avatar} size="lg" className="w-12 h-12 text-base" />

                <div className="min-w-0">
                  <p id="ulasan-nama" className="text-black text-lg" style={NAME}>
                    {current.name}
                  </p>
                  <Link
                    href={`/courses/${current.courseSlug}`}
                    className="text-ink-muted text-xs mt-0.5 block truncate transition-colors hover:text-blue-700"
                  >
                    Alumni · {current.courseTitle}
                  </Link>
                </div>

                <Stars value={current.rating} size="sm" className="ml-auto" />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
