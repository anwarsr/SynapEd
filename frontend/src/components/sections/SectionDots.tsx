"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveSection } from "@/lib/useActiveSection";
import { cn } from "@/lib/cn";

/** Urutan section beranda dari atas ke bawah — harus cocok dengan id di page.tsx. */
const SECTIONS: readonly { id: string; label: string }[] = [
  { id: "hero", label: "Beranda" },
  { id: "about", label: "Tentang" },
  { id: "courses", label: "Kursus" },
  { id: "features", label: "Fitur" },
  { id: "learning-path", label: "Alur Belajar" },
  { id: "testimonials", label: "Ulasan" },
  { id: "faq", label: "FAQ" },
];

const IDS = SECTIONS.map((s) => s.id);

/** Jarak seretan (px) yang dihitung sebagai gestur geser. */
const AMBANG = 36;

/**
 * Titik navigasi di tepi kanan: menunjukkan section yang sedang dibaca dan
 * melompat ke section yang dipencet. Hanya tampil di lg:+ (di bawahnya
 * menutupi konten).
 *
 * PEMILIH SECTION: menyeret titik-titik ke KIRI (mouse atau sentuhan) membuka mode
 * pilih - seluruh laman diburamkan (lapisan `backdrop-filter`) dan titik-titik
 * melebar menjadi daftar bernomor yang bisa dipilih. Menyeret ke KANAN, Esc, atau
 * mengetuk latar yang buram mengembalikan semuanya seperti semula. Seret dibaca lewat
 * pendengar di `window` (bukan setPointerCapture) supaya klik pada tombol titik tetap
 * sampai ke tombolnya.
 */
export default function SectionDots() {
  const active = useActiveSection(IDS) ?? "hero";
  const [terbuka, setTerbuka] = useState(false);
  const barusSeret = useRef(false);
  // Indikator hover: SELAMA penunjuk berada di atas daftar, HANYA tulisan section yang sedang aktif
  // memantul ke kiri-kanan terus-menerus (petunjuk bahwa ia bisa digeser); titik-titiknya diam.
  const [hover, setHover] = useState(false);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const mulaiSeret = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const x0 = e.clientX;
      let sudah = false;

      const gerak = (ev: PointerEvent) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) > 8) barusSeret.current = true;
        if (sudah) return;
        if (!terbuka && dx < -AMBANG) {
          sudah = true;
          setTerbuka(true);
        } else if (terbuka && dx > AMBANG) {
          sudah = true;
          setTerbuka(false);
        }
      };
      const selesai = () => {
        window.removeEventListener("pointermove", gerak);
        window.removeEventListener("pointerup", selesai);
        window.removeEventListener("pointercancel", selesai);
        // Klik yang menyusul seretan ditelan; dibersihkan sesudah peristiwa klik lewat.
        setTimeout(() => {
          barusSeret.current = false;
        }, 0);
      };
      barusSeret.current = false;
      window.addEventListener("pointermove", gerak);
      window.addEventListener("pointerup", selesai);
      window.addEventListener("pointercancel", selesai);
    },
    [terbuka],
  );

  useEffect(() => {
    if (!terbuka) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerbuka(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [terbuka]);

  return (
    <>
      {/* Lapisan pengabur: seluruh laman (termasuk navbar) tampak buram selama mode pilih. */}
      <div
        aria-hidden="true"
        onPointerDown={mulaiSeret}
        onClick={() => setTerbuka(false)}
        className={cn(
          "fixed inset-0 z-[65] hidden bg-paper/55 backdrop-blur-xl transition-opacity duration-500 ease-warm lg:block",
          terbuka ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <nav
        aria-label="Navigasi section"
        onPointerDown={mulaiSeret}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onClickCapture={(e) => {
          if (barusSeret.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn(
          "fixed right-2 top-1/2 hidden -translate-y-1/2 touch-pan-y select-none p-4 transition-transform duration-700 ease-warm lg:block",
          terbuka ? "z-[70] -translate-x-[min(9vw,150px)] scale-[1.18]" : "z-40",
        )}
        style={{ transformOrigin: "100% 50%" }}
      >
        {/* Tombol bantu papan ketik: membuka/menutup pemilih section */}
        <button
          type="button"
          onClick={() => setTerbuka((v) => !v)}
          aria-expanded={terbuka}
          className="sr-only focus:not-sr-only focus:absolute focus:-top-9 focus:right-0 focus:bg-blue-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-[#fff]"
        >
          {terbuka ? "Tutup pemilih section" : "Buka pemilih section"}
        </button>

        <ul className="flex flex-col items-end gap-4">
          {SECTIONS.map((s, i) => {
            const isActive = s.id === active;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    goTo(s.id);
                    setTerbuka(false);
                  }}
                  aria-label={`${s.label} (bagian ${i + 1})`}
                  aria-current={isActive ? "true" : undefined}
                  className="group flex items-center gap-3 py-0.5"
                >
                  <span
                    className={cn(
                      "font-sans text-[11px] font-semibold uppercase tracking-wider transition-all duration-500 ease-warm",
                      isActive && hover && !terbuka && "dots-pantul",
                      terbuka
                        ? cn("translate-x-0 opacity-100", isActive ? "text-blue-600" : "text-white group-hover:text-blue-400")
                        : isActive
                          ? "text-blue-600 opacity-100"
                          : "pointer-events-none translate-x-1 text-ink-muted opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                    )}
                    style={{ transitionDelay: terbuka ? `${i * 55 + 120}ms` : "0ms" }}
                  >
                    {String(i + 1).padStart(2, "0")} {s.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block rounded-full transition-all duration-200 ease-out-soft",
                      isActive ? "h-3 w-3 bg-blue-600" : "h-2 w-2 bg-blue-600/30 group-hover:bg-blue-600",
                      terbuka && !isActive && "bg-blue-600/60",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
