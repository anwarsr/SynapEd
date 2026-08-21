"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  /** Jeda mulai, untuk efek berurutan antar kartu (ms). */
  delay?: number;
  className?: string;
  /** "fade" (default): naik + memudar. "tilt": kartu miring 3D lalu tegak, kesan hologram. */
  variant?: "fade" | "tilt";
}

/** Muncul lembut saat masuk layar: naik + memudar masuk, sekali saja.
 *  Animasinya sendiri ada di .reveal / .is-visible (globals.css), jadi
 *  saat prefers-reduced-motion aktif konten tetap terlihat penuh. */
export default function Reveal({ children, delay = 0, className, variant = "fade" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sudah di dalam layar saat dimuat (mis. hero) — langsung tampilkan.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(variant === "tilt" ? "tilt-reveal" : "reveal", visible && "is-visible", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
