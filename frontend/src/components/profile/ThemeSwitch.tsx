"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Tema = "dark" | "light";

const THEME_KEY = "synaped_theme";

const OPSI: { id: Tema; label: string; ket: string; swatch: [string, string, string] }[] = [
  { id: "dark", label: "Gelap", ket: "Bawaan", swatch: ["#0B1A24", "#12293A", "#2F6FED"] },
  { id: "light", label: "Terang", ket: "Lebih cerah", swatch: ["#F5F8FD", "#FFFFFF", "#2563EB"] },
];

/**
 * Pengaturan tampilan laman: Gelap (bawaan) atau Terang.
 *
 * Tema disimpan di localStorage dan diterapkan lewat atribut `data-theme` pada
 * <html>; skrip kecil di <head> (layout.tsx) memasangnya SEBELUM cat pertama
 * supaya tidak berkedip. Pilihan hanya berlaku di perangkat ini.
 */
export default function ThemeSwitch() {
  const [tema, setTema] = useState<Tema>("dark");

  // Baca tema aktif setelah mount (HTML server tak tahu pilihan pengguna).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTema(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function pilih(t: Tema) {
    setTema(t);
    const root = document.documentElement;
    if (t === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // penyimpanan diblokir: tema tetap berlaku sampai halaman dimuat ulang
    }
  }

  return (
    <div role="radiogroup" aria-label="Tema tampilan" className="grid grid-cols-2 gap-1">
      {OPSI.map((o) => {
        const aktif = tema === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => pilih(o.id)}
            className={cn(
              "flex flex-col items-start gap-3 p-4 text-left transition-colors duration-200 ease-out-soft",
              aktif ? "bg-blue-600 text-white" : "bg-paper-card text-ink-body hover:bg-card-hover",
            )}
          >
            {/* pratinjau palet */}
            <span aria-hidden="true" className="flex h-9 w-full overflow-hidden">
              <span className="flex-1" style={{ background: o.swatch[0] }} />
              <span className="flex-1" style={{ background: o.swatch[1] }} />
              <span className="flex-1" style={{ background: o.swatch[2] }} />
            </span>
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className={cn("block text-[12px]", aktif ? "text-white/80" : "text-ink-muted")}>{o.ket}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
