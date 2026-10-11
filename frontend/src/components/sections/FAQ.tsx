"use client";

import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { faqs } from "@/data/landing";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";

/** Tipografi FAQ */
const QUESTION: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  letterSpacing: "-0.025em",
  lineHeight: 1.15,
};

const FACE: React.CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

/**
 * Teks dipecah per huruf (kata dibungkus nowrap agar baris tak patah di tengah
 * kata). Tiap huruf diberi --i = urutan global; animasinya (muncul dari kiri ke
 * kanan) ada di globals.css (.faq-huruf).
 */
function HurufKata({ teks, kelas }: { teks: string; kelas: string }) {
  let n = 0;
  return (
    <>
      {teks.split(" ").map((kata, k, semua) => (
        <span key={k} aria-hidden="true" className="inline-block whitespace-nowrap">
          {[...kata].map((h) => (
            <span key={n} className={kelas} style={{ "--i": n++ } as React.CSSProperties}>
              {h}
            </span>
          ))}
          {k < semua.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </>
  );
}

/**
 * Tata letak ubin di desktop: 6 kolom — baris pertama tiga ubin selebar 2
 * kolom, baris kedua dua ubin selebar 3 kolom — jadi seluruh area terisi
 * penuh tanpa sisa kosong. Di ponsel satu kolom.
 */
function spanOf(i: number, total: number): string {
  const barisAtas = Math.ceil(total / 2);
  return i < barisAtas ? "md:col-span-2" : "md:col-span-3";
}

export default function FAQ() {
  // Tiap ubin membalik sendiri-sendiri; beberapa boleh terbuka sekaligus.
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  // Hover ubin: masuk = "Lihat jawaban" muncul huruf demi huruf dari kiri ke kanan;
  // keluar = huruf-hurufnya keluar ke kanan (sama dengan label panel About).
  const [hov, setHov] = useState<{ i: number; fase: "masuk" | "keluar" } | null>(null);

  const toggle = (i: number) => {
    // Kursor masih di atas ubin: labelnya ("Lihat pertanyaan"/"Lihat jawaban") muncul lagi setelah dibalik.
    setHov({ i, fase: "masuk" });
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <section id="faq" className="relative flex min-h-screen flex-col overflow-hidden bg-ivory">
      {/* =====================================================
          JUDUL - baris tersendiri di atas ubin, jadi tak pernah tertutup
          ubin dan tak mengganggu susunannya.
      ====================================================== */}

      <div className="container-page pb-10 pt-24 sm:pb-12 sm:pt-28">
        <Reveal>
          <SectionTitle title="Tanya Jawab" />
        </Reveal>
      </div>

      {/* =====================================================
          UBIN - memenuhi sisa section sampai tepi layar. Hover: "Lihat jawaban"
          muncul huruf demi huruf. Ditekan → terbalik (rotateY) ke sisi terang
          berisi jawaban lengkap, juga muncul huruf demi huruf.
      ====================================================== */}

      <div className="grid flex-1 grid-cols-1 gap-1 md:min-h-[640px] md:grid-cols-6 md:grid-rows-2">
        {faqs.map((faq, i) => {
          const open = flipped.has(i);

          return (
            <Reveal key={i} delay={i * 90} className={cn("h-full min-h-[300px]", spanOf(i, faqs.length))}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={open}
                aria-label={open ? `Tutup jawaban: ${faq.question}` : `Lihat jawaban: ${faq.question}`}
                data-buka={open}
                data-hover={hov?.i === i ? hov.fase : "diam"}
                onPointerEnter={() => setHov({ i, fase: "masuk" })}
                onPointerLeave={() => setHov((h) => (h?.i === i && h.fase === "masuk" ? { i, fase: "keluar" } : h))}
                className="faq-ubin group block h-full w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-500"
                style={{ perspective: "1600px" }}
              >
                <span
                  className="relative block h-full w-full transition-transform duration-[900ms] ease-warm motion-reduce:transition-none"
                  style={{ transformStyle: "preserve-3d", transform: open ? "rotateY(180deg)" : "rotateY(0deg)" }}
                >
                  {/* ── Depan: nomor + pertanyaan. Di tempat tulisan lama "Ketuk untuk membalik",
                      kini "Lihat jawaban" yang muncul huruf demi huruf dari kiri ke kanan saat
                      di-hover (dan keluar ke kanan saat dilepas). Tanpa perubahan warna. ── */}
                  <span
                    aria-hidden={open}
                    className="absolute inset-0 flex flex-col justify-between bg-paper-card p-7 sm:p-9"
                    style={FACE}
                  >
                    <span className="flex items-start justify-between">
                      <span
                        className="select-none text-white/90"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(3.5rem, 7vw, 6rem)",
                          fontWeight: 900,
                          lineHeight: 0.8,
                          letterSpacing: "-0.08em",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="about-judul text-xs font-semibold uppercase tracking-[0.16em]">
                        <HurufKata teks="Lihat jawaban" kelas="about-huruf" />
                      </span>
                    </span>

                    <span className="block max-w-[28ch] text-xl text-white sm:text-2xl" style={QUESTION}>
                      {faq.question}
                    </span>
                  </span>

                  {/* ── Belakang: jawaban lengkap di latar terang (lebih muda dari sisi depan), tinta hitam.
                      Nomor di pojok kiri atas; di pojok kanan atas "Lihat pertanyaan" muncul huruf demi
                      huruf saat di-hover (animasi sama dengan "Lihat jawaban" di sisi depan). ── */}
                  <span
                    aria-hidden={!open}
                    className="faq-muda absolute inset-0 flex flex-col justify-between overflow-hidden p-7 sm:p-9"
                    style={{ ...FACE, transform: "rotateY(180deg)" }}
                  >
                    <span className="flex items-start justify-between">
                      <span
                        className="select-none opacity-90"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(3.5rem, 7vw, 6rem)",
                          fontWeight: 900,
                          lineHeight: 0.8,
                          letterSpacing: "-0.08em",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="about-judul text-xs font-semibold uppercase tracking-[0.16em]">
                        <HurufKata teks="Lihat pertanyaan" kelas="about-huruf" />
                      </span>
                    </span>

                    <span className="block max-w-[46ch] text-base font-medium leading-[1.7] sm:text-lg" style={{ fontFamily: "var(--font-sans)" }}>
                      <HurufKata teks={faq.answer} kelas="faq-b-huruf" />
                    </span>
                  </span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
