"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/** Pisahkan "1000+" -> { angka: 1000, akhiran: "+" }, "4.8★" -> { 4.8, "★" } */
function parse(value: string) {
  const m = value.match(/^([\d.,]+)(.*)$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  const decimals = (m[1].split(".")[1] ?? "").length;
  return { num, decimals, suffix: m[2] };
}

/** Angka yang menghitung naik saat masuk layar. Melambat di ujung
 *  (ease-out kubik) supaya terasa mengendap, bukan mekanis. */
export default function CountUp({ value, className }: { value: string; className?: string }) {
  const parsed = parse(value);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed || reduced) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let start = 0;
    const DURATION = 1400;

    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown((parsed.num * eased).toFixed(parsed.decimals) + parsed.suffix);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          raf = requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  // Tanpa animasi (atau nilai non-numerik) tampilkan apa adanya.
  return (
    <span
      ref={ref}
      className={className}
      style={{ fontFamily: "var(--font-fraunces)", fontVariationSettings: '"opsz" 48, "SOFT" 30' }}
    >
      {parsed && !reduced && shown !== null ? shown : value}
    </span>
  );
}
