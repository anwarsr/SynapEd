"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Judul section: satu kata/frasa BESAR di tengah (huruf kapital, tebal).
 * Ukuran huruf dihitung dari panjang judul supaya judul panjang
 * ("LEARNING PATH") tetap muat selebar layar tanpa terpotong, sedangkan
 * judul pendek dibatasi 11rem.
 *
 * Muncul dengan animasi ACAK ALFABET: begitu judul masuk layar, tiap huruf
 * berganti-ganti huruf acak A–Z lalu "mengunci" ke huruf aslinya dari kiri ke
 * kanan. Lebar tiap huruf dikunci pada huruf aslinya (yang tak terlihat), jadi
 * baris tidak bergetar saat huruf acak berganti. Hemat gerak: langsung tampil.
 */
export default function SectionTitle({
  title,
  as: Tag = "h2",
  className,
}: {
  title: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const vw = (88 / (title.length * 0.64)).toFixed(2);
  const asli = title.toUpperCase().split("");

  const ref = useRef<HTMLDivElement>(null);
  const [terlihat, setTerlihat] = useState(false);
  const [tampil, setTampil] = useState<string[]>(asli);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const huruf = title.toUpperCase().split("");
    let interval: ReturnType<typeof setInterval> | undefined;

    const jalankan = () => {
      const t0 = performance.now();

      const tick = () => {
        const t = performance.now() - t0;
        // Huruf ke-i terkunci pada 350ms + i×80ms; sebelum itu acak A–Z
        const hasil = huruf.map((ch, i) =>
          ch === " " || t >= 350 + i * 80 ? ch : ALFABET[Math.floor(Math.random() * ALFABET.length)],
        );
        setTampil(hasil);
        if (hasil.every((c, i) => c === huruf[i])) clearInterval(interval);
      };

      tick();
      interval = setInterval(tick, 45);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTerlihat(true);
        if (!hemat) jalankan();
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      clearInterval(interval);
    };
  }, [title]);

  return (
    <div ref={ref} className={cn("flex flex-col items-center text-center", className)}>
      <Tag
        aria-label={title}
        className="max-w-full font-extrabold uppercase text-white"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: `min(${vw}vw, 11rem)`,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          opacity: terlihat ? 1 : 0,
          transition: "opacity 250ms",
        }}
      >
        {asli.map((ch, i) =>
          ch === " " ? (
            <span key={i} aria-hidden="true">
              {" "}
            </span>
          ) : (
            <span key={i} aria-hidden="true" className="relative inline-block">
              <span className="invisible">{ch}</span>
              <span
                className={cn(
                  "absolute inset-0 text-center transition-colors duration-200",
                  tampil[i] === ch ? "text-white" : "text-blue-300",
                )}
              >
                {tampil[i]}
              </span>
            </span>
          ),
        )}
      </Tag>
    </div>
  );
}
