"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import Stars from "@/components/ui/Stars";
import MiniProfile from "@/components/profile/MiniProfile";
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
  /** Banner profil penulis; null = hitam bawaan. */
  banner: string | null;
  /** Balasan admin; null = belum dibalas. */
  reply: { body: string; by: string } | null;
}

/** Di bawah ini kartunya ditata diam, tanpa pita berjalan. */
const MARQUEE_MIN = 4;
/** Berapa kali daftar kartu digandakan di pita berjalan. */
const SALINAN = 4;

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
  // Kartu mini-profil penulis (terbuka di atas dialog komentar).
  const [mini, setMini] = useState(false);

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
    setMini(false);
  }

  // ── Pita kartu: bisa digeser (seret dengan mouse, usap di layar sentuh) dan
  //    tetap berjalan pelan sendiri; berhenti saat kursor di atasnya, saat
  //    diseret, atau saat dialog terbuka. Isinya digandakan EMPAT kali
  //    (SALINAN kali) dan posisinya dijaga di salinan kedua-ketiga: begitu
  //    melewati satu salinan, posisi dibungkus mundur/maju selebar satu salinan.
  //    Dulu hanya dua salinan dan posisi awal 0, sehingga menyeret ke KANAN
  //    langsung membentur scrollLeft = 0 sebelum sempat dibungkus.
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

    // Lebar satu salinan; dijaga posisi di [satu, dua] salinan.
    const lebarSalinan = () => el.scrollWidth / SALINAN;

    const bungkus = () => {
      const w = lebarSalinan();
      if (w <= 0) return;
      if (el.scrollLeft >= 2 * w) el.scrollLeft -= w;
      else if (el.scrollLeft < w) el.scrollLeft += w;
    };

    // Mulai di salinan kedua: ada ruang penuh ke kiri maupun ke kanan.
    el.scrollLeft = lebarSalinan();

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
    if (d.captured) {
      // Posisi dibungkus SAAT diseret juga, dan titik awal seretan ikut
      // digeser selebar satu salinan, supaya seretan tak pernah membentur ujung.
      const w = el.scrollWidth / SALINAN;
      let v = d.startLeft - dx;
      if (w > 0) {
        while (v >= 2 * w) {
          v -= w;
          d.startLeft -= w;
        }
        while (v < w) {
          v += w;
          d.startLeft += w;
        }
      }
      el.scrollLeft = v;
    }
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

  const kartu = berjalan ? Array.from({ length: SALINAN }, () => items).flat() : items;

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
                className="group flex min-h-96 w-72 shrink-0 flex-col overflow-hidden bg-paper-card text-left transition-[transform,background-color] duration-500 ease-warm hover:-translate-y-1.5 hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                {/* Banner penulis (hitam bila belum punya) — foto profil, nama, dan
                    bintang duduk DI TENGAH banner, sedikit ke atas dari titik tengah */}
                <span className="keep-white relative flex h-44 w-full shrink-0 flex-col items-center justify-center overflow-hidden bg-banner pb-5">
                  {t.banner && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.banner} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  {/* Peredam supaya teks tetap terbaca di atas foto apa pun */}
                  {t.banner && <span aria-hidden="true" className="absolute inset-0 bg-black/45" />}

                  <UserAvatar
                    name={t.name}
                    photoURL={t.avatar}
                    size="md"
                    className="relative h-[60px] w-[60px] text-base ring-2 ring-white/25"
                  />
                  <span className="relative mt-3 block max-w-[85%] truncate text-base text-white" style={NAME}>
                    {t.name}
                  </span>
                  <Stars value={t.rating} size="xs" className="relative mt-1.5" />
                </span>

                <span className="flex flex-1 flex-col px-6 pb-7 pt-5 text-center">
                  {/* Kursus yang diulas */}
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                    {t.courseTitle}
                  </span>

                  <span className="mt-3 line-clamp-4 block text-sm text-ink-body" style={QUOTE}>
                    &ldquo;{t.content}&rdquo;
                  </span>

                  {/* Balasan admin: kutipan kecil bergaris biru di dasar kartu */}
                  {t.reply && (
                    <span className="mt-auto block pt-5 text-left">
                      <span className="block bg-white/[0.04] px-4 py-3 shadow-[inset_3px_0_0_var(--color-blue-500)]">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.26em] text-blue-300">
                          Balasan {t.reply.by}
                        </span>
                        <span className="mt-1.5 line-clamp-2 block text-[12.5px] leading-[1.6] text-ink-muted">
                          {t.reply.body}
                        </span>
                      </span>
                    </span>
                  )}
                </span>
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
          <div className="relative w-[min(34rem,calc(100vw-2rem))] overflow-hidden bg-paper-card shadow-lift">
            {/* Banner: foto profil, nama, dan bintang di tengahnya */}
            <div className="keep-white relative flex h-48 w-full flex-col items-center justify-center overflow-hidden bg-banner pb-5 sm:h-52">
              {current.banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.banner} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {current.banner && <span aria-hidden="true" className="absolute inset-0 bg-black/45" />}

              {/* Foto & nama membuka kartu mini-profil, bukan berpindah halaman */}
              <button
                type="button"
                onClick={() => setMini(true)}
                aria-label={`Lihat profil ${current.name}`}
                className="relative rounded-full transition-transform duration-300 ease-warm hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              >
                <UserAvatar
                  name={current.name}
                  photoURL={current.avatar}
                  size="lg"
                  className="h-[68px] w-[68px] text-lg ring-2 ring-white/25"
                />
              </button>
              <div className="relative mt-3 max-w-[85%] text-center">
                <button
                  type="button"
                  onClick={() => setMini(true)}
                  className="block max-w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                >
                  <p id="ulasan-nama" className="truncate text-lg text-white underline-offset-4 hover:underline" style={NAME}>
                    {current.name}
                  </p>
                </button>
                <Stars value={current.rating} size="sm" className="mx-auto mt-1.5" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Tutup"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center bg-black/50 text-white/80 backdrop-blur-sm transition-colors duration-200 ease-out-soft hover:bg-black/70 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="px-8 pb-8 pt-6 text-center sm:px-10 sm:pb-10">
            <Link
              href={`/courses/${current.courseSlug}`}
              className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300 transition-colors hover:text-white"
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

            {current.reply && selesaiMengetik && (
              <div className="mini-masuk mt-6 bg-white/[0.04] px-5 py-4 text-left shadow-[inset_3px_0_0_var(--color-blue-500)]">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-blue-300">Balasan {current.reply.by}</p>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-[1.7] text-ink-body">{current.reply.body}</p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {current && mini && (
        <MiniProfile
          key={current.uid}
          uid={current.uid}
          name={current.name}
          avatar={current.avatar}
          banner={current.banner}
          onClose={() => setMini(false)}
        />
      )}
    </section>
  );
}
