"use client";

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

/** Titik navigasi di tepi kanan: menunjukkan section yang sedang dibaca dan
 *  melompat ke section yang dipencet. Hanya tampil di lg:+ (di bawahnya
 *  menutupi konten). */
export default function SectionDots() {
  const active = useActiveSection(IDS) ?? "hero";

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Navigasi section"
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      <ul className="flex flex-col items-end gap-4">
        {SECTIONS.map((s, i) => {
          const isActive = s.id === active;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(s.id)}
                aria-label={`${s.label} (bagian ${i + 1})`}
                aria-current={isActive ? "true" : undefined}
                className="group flex items-center gap-3 py-0.5"
              >
                <span
                  className={cn(
                    "font-sans text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ease-out-soft",
                    isActive
                      ? "text-blue-600 opacity-100"
                      : "pointer-events-none translate-x-1 text-ink-muted opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                  )}
                >
                  {String(i + 1).padStart(2, "0")} {s.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "block rounded-full transition-all duration-200 ease-out-soft",
                    isActive
                      ? "h-3 w-3 bg-blue-600"
                      : "h-2 w-2 bg-blue-600/30 group-hover:bg-blue-600",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
