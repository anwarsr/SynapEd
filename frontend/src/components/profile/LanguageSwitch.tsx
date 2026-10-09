"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { LANG_KEY, setBahasa, type Bahasa } from "@/lib/language";

const OPSI: { id: Bahasa; label: string; ket: string }[] = [
  { id: "id", label: "Bahasa Indonesia", ket: "Bawaan" },
  { id: "en", label: "English", ket: "Diterjemahkan otomatis" },
];

/**
 * Pengaturan bahasa tampilan: Indonesia (bawaan, bahasa asli situs) atau Inggris.
 *
 * Terjemahan Inggris dikerjakan oleh Google Website Translation (widget resmi
 * `translate.google.com/translate_a/element.js`) - lihat TranslateLoader. Memilih
 * bahasa memuat ulang halaman supaya penerjemah menerjemahkan dari awal.
 */
export default function LanguageSwitch() {
  const [bahasa, setBahasaState] = useState<Bahasa>("id");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        setBahasaState(localStorage.getItem(LANG_KEY) === "en" ? "en" : "id");
      } catch {
        // abaikan
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function pilih(b: Bahasa) {
    if (b === bahasa) return;
    setBahasaState(b);
    setBahasa(b); // menyimpan, mengatur cookie penerjemah, lalu memuat ulang
  }

  return (
    <div role="radiogroup" aria-label="Bahasa tampilan" className="grid grid-cols-2 gap-1">
      {OPSI.map((o) => {
        const aktif = bahasa === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => pilih(o.id)}
            className={cn(
              "flex flex-col items-start gap-1 p-4 text-left transition-colors duration-200 ease-out-soft",
              aktif ? "bg-blue-600 text-white" : "bg-paper-card text-ink-body hover:bg-card-hover",
            )}
          >
            <span className="notranslate text-sm font-semibold" translate="no">
              {o.label}
            </span>
            <span className={cn("text-[12px]", aktif ? "text-white/80" : "text-ink-muted")}>{o.ket}</span>
          </button>
        );
      })}
    </div>
  );
}
