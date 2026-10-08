"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import Stars from "@/components/ui/Stars";
import ProfileLink from "@/components/ui/ProfileLink";
import UserAvatar from "@/components/ui/UserAvatar";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";

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
  /** Penulis ulasan — menautkan namanya ke halaman profilnya. */
  uid: string;
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

const NAME: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 900,
  letterSpacing: "-0.025em",
};

const QUOTE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  lineHeight: 1.6,
  letterSpacing: "-0.02em",
};

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

  // ── Pita kartu: bisa digeser (seret dengan mouse, usap di layar sentuh) dan
  //    tetap berjalan pelan sendiri; berhenti saat kursor di atasnya, saat
  //    diseret, atau saat dialog terbuka. Isinya digandakan dan posisinya
  //    "dibungkus" di separuh lebar, jadi bisa digeser tanpa ujung.
  const berjalan = items.length >= MARQUEE_MIN;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const dialogRef = useRef(false);
  const dragRef = useRef({ down: false, startX: 0, startLeft: 0, moved: 0, captured: false });

  useEffect(() => {
    dialogRef.current = active !== null;
  }, [active]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !berjalan) return;

    const bungkus = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      if (el.scrollLeft >= half) el.scrollLeft -= half;
      else if (el.scrollLeft <= 0.5) el.scrollLeft += half;
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 50);
      last = now;

      if (!reducedMotion && !pausedRef.current && !dialogRef.current && !dragRef.current.down) {
        // ±30 px/dtk; scrollLeft membulatkan, jadi pecahan ditampung dulu
        acc += dt * 0.03;
        const utuh = Math.floor(acc);
        if (utuh > 0) {
          el.scrollLeft += utuh;
          acc -= utuh;
        }
      }
      bungkus();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [berjalan, reducedMotion]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    dragRef.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: 0, captured: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    const d = dragRef.current;
    if (!el || !d.down) return;

    const dx = e.clientX - d.startX;
    d.moved = Math.max(d.moved, Math.abs(dx));

    // Baru dianggap seret setelah 5px; sebelumnya tetap klik biasa pada kartu.
    if (d.moved > 5 && !d.captured) {
      d.captured = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    }
    if (d.captured) el.scrollLeft = d.startLeft - dx;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    const d = dragRef.current;
    if (!el) return;
    if (d.captured) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // sudah dilepas
      }
    }
    d.down = false;
    el.style.cursor = "";
  }

  const typed = reducedMotion ? full : full.slice(0, charCount);
  const selesaiMengetik = typed.length === full.length;

  // Belum ada ulasan sama sekali — bagian ini tidak usah ada.
  if (items.length === 0) return null;

  const kartu = berjalan ? [...items, ...items] : items;

  return (
    <section id="testimonials" className="py-28 bg-ivory overflow-hidden">
      <div className="container-page">
        <Reveal className="flex flex-col items-center text-center mb-14">
          <SectionTitle title="Comments" />
        </Reveal>
      </div>

      <div
        ref={scrollerRef}
        className="testimonial-scroller"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={() => (pausedRef.current = true)}
        onPointerLeave={() => (pausedRef.current = false)}
        // Seret yang berakhir di atas kartu tidak boleh dihitung sebagai klik
        onClickCapture={(e) => {
          if (dragRef.current.moved > 5) {
            e.stopPropagation();
            e.preventDefault();
            dragRef.current.moved = 0;
          }
        }}
      >
        <div
          className={cn(
            "flex gap-5 py-2",
            berjalan ? "w-max px-5" : "container-page flex-wrap justify-center",
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
                className="group flex min-h-80 w-72 shrink-0 flex-col bg-paper-card p-7 text-left transition-[transform,background-color] duration-500 ease-warm hover:-translate-y-1.5 hover:bg-[#16324A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                {/* Pemberi ulasan: foto profil besar + nama + bintang */}
                <div className="flex items-center gap-4">
                  <UserAvatar name={t.name} photoURL={t.avatar} size="lg" />

                  <div className="min-w-0">
                    <p className="truncate text-base text-white" style={NAME}>
                      {t.name}
                    </p>
                    <Stars value={t.rating} size="xs" className="mt-2" />
                  </div>
                </div>

                {/* Kursus yang diulas — dulu tertulis di atas gambar */}
                <p className="mt-7 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                  {t.courseTitle}
                </p>

                <p className="mt-3 line-clamp-5 text-sm text-ink-body" style={QUOTE}>
                  &ldquo;{t.content}&rdquo;
                </p>
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
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <div className="relative w-[min(34rem,calc(100vw-2rem))] bg-paper-card p-8 shadow-lift sm:p-10">
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Tutup"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center text-white/60 transition-colors duration-200 ease-out-soft hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-5 pr-10">
              <ProfileLink uid={current.uid} name={current.name} secondary className="shrink-0">
                <UserAvatar name={current.name} photoURL={current.avatar} size="lg" />
              </ProfileLink>

              <div className="min-w-0">
                <ProfileLink uid={current.uid} name={current.name}>
                  <p id="ulasan-nama" className="truncate text-lg text-white" style={NAME}>
                    {current.name}
                  </p>
                </ProfileLink>
                <Stars value={current.rating} size="sm" className="mt-2" />
              </div>
            </div>

            <Link
              href={`/courses/${current.courseSlug}`}
              className="mt-8 block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300 transition-colors hover:text-white"
            >
              {current.courseTitle}
            </Link>

            <p className="mt-3 min-h-30 whitespace-pre-line text-base text-ink-body" style={QUOTE} aria-live="polite">
              &ldquo;{typed}
              {!selesaiMengetik && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-[0.95em] w-0.5 animate-pulse bg-blue-400 align-middle"
                />
              )}
              {selesaiMengetik && "”"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
