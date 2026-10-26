"use client";

import { useEffect, useState } from "react";
import {
  KUNCI_TEMA,
  PALET_BAWAAN,
  PALET_CONTOH,
  bacaPaletTersimpan,
  hexSah,
  hitungTema,
  lepasTemaKustom,
  terapkanTemaKustom,
  type PaletKustom,
} from "@/lib/customTheme";
import { cn } from "@/lib/cn";

type Tema = "dark" | "light" | "custom";

const OPSI: { id: Tema; label: string; ket: string; swatch?: [string, string, string] }[] = [
  { id: "dark", label: "Gelap", ket: "Bawaan", swatch: ["#0B1A24", "#12293A", "#2F6FED"] },
  { id: "light", label: "Terang", ket: "Lebih cerah", swatch: ["#F5F8FD", "#FFFFFF", "#2563EB"] },
  { id: "custom", label: "Kustom", ket: "Atur sendiri" },
];

const BARIS: { kunci: keyof PaletKustom; label: string; ket: string }[] = [
  { kunci: "latar", label: "Latar", ket: "Warna dasar halaman" },
  { kunci: "kartu", label: "Kartu", ket: "Kartu, panel, dan kolom isian" },
  { kunci: "teks", label: "Teks", ket: "Tulisan utama" },
  { kunci: "aksen", label: "Aksen", ket: "Tombol, tautan, penanda aktif" },
];

/**
 * Pengaturan tampilan laman: Gelap (bawaan), Terang, atau Kustom (palet sendiri).
 *
 * Gelap/Terang diterapkan lewat atribut `data-theme` pada <html>; Kustom
 * memasang variabel warna turunan (lib/customTheme.ts) langsung di <html>.
 * Skrip kecil di <head> (layout.tsx) memasang pilihan SEBELUM cat pertama supaya
 * tidak berkedip. Pilihan hanya berlaku di perangkat ini.
 */
export default function ThemeSwitch() {
  const [tema, setTema] = useState<Tema>("dark");
  const [palet, setPalet] = useState<PaletKustom>(PALET_BAWAAN);
  const [teksHex, setTeksHex] = useState<Record<string, string>>({});

  // Baca keadaan aktif setelah mount (HTML server tak tahu pilihan pengguna).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let simpan: string | null = null;
      try {
        simpan = localStorage.getItem(KUNCI_TEMA);
      } catch {
        // diblokir: pakai atribut yang terpasang
      }
      setPalet(bacaPaletTersimpan());
      setTema(simpan === "custom" ? "custom" : document.documentElement.dataset.theme === "light" ? "light" : "dark");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function pilih(t: Tema) {
    setTema(t);
    const root = document.documentElement;
    if (t === "custom") {
      terapkanTemaKustom(palet);
      return;
    }
    lepasTemaKustom();
    if (t === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem(KUNCI_TEMA, t);
    } catch {
      // penyimpanan diblokir: tema tetap berlaku sampai halaman dimuat ulang
    }
  }

  function ubahPalet(baru: PaletKustom) {
    setPalet(baru);
    terapkanTemaKustom(baru);
  }

  function ubahWarna(kunci: keyof PaletKustom, nilai: string) {
    ubahPalet({ ...palet, [kunci]: nilai.toUpperCase() });
    setTeksHex((h) => ({ ...h, [kunci]: nilai.toUpperCase() }));
  }

  const peringatan = tema === "custom" ? hitungTema(palet).peringatan : [];

  return (
    <div>
      <div role="radiogroup" aria-label="Tema tampilan" className="grid grid-cols-3 gap-1 max-sm:grid-cols-1">
        {OPSI.map((o) => {
          const aktif = tema === o.id;
          const swatch: [string, string, string] = o.swatch ?? [palet.latar, palet.kartu, palet.aksen];
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
                <span className="flex-1" style={{ background: swatch[0] }} />
                <span className="flex-1" style={{ background: swatch[1] }} />
                <span className="flex-1" style={{ background: swatch[2] }} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className={cn("block text-[12px]", aktif ? "text-white/80" : "text-ink-muted")}>{o.ket}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tema === "custom" && (
        <div className="mt-1 bg-paper-card p-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.26em] text-ink-muted">Palet saya</p>

          <ul className="space-y-3">
            {BARIS.map((b) => (
              <li key={b.kunci} className="flex items-center gap-3">
                <label className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden shadow-[inset_0_0_0_1px_rgba(128,128,128,0.4)]" style={{ background: palet[b.kunci] }}>
                  <span className="sr-only">Pilih warna {b.label}</span>
                  <input
                    type="color"
                    value={palet[b.kunci].toLowerCase()}
                    onChange={(e) => ubahWarna(b.kunci, e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{b.label}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{b.ket}</span>
                </span>
                <label className="sr-only" htmlFor={`hex-${b.kunci}`}>
                  Kode warna {b.label}
                </label>
                <input
                  id={`hex-${b.kunci}`}
                  value={teksHex[b.kunci] ?? palet[b.kunci]}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(e) => {
                    let v = e.target.value.trim().toUpperCase();
                    if (v && !v.startsWith("#")) v = `#${v}`;
                    setTeksHex((h) => ({ ...h, [b.kunci]: v }));
                    if (hexSah(v)) ubahPalet({ ...palet, [b.kunci]: v });
                  }}
                  onBlur={() => setTeksHex((h) => ({ ...h, [b.kunci]: palet[b.kunci] }))}
                  className="w-[88px] bg-white/[0.06] px-2.5 py-2 text-center text-[13px] font-medium tabular-nums text-ink outline-none shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
                />
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.26em] text-ink-muted">Contoh palet</p>
          <div className="flex flex-wrap gap-1.5">
            {PALET_CONTOH.map((c) => (
              <button
                key={c.nama}
                type="button"
                onClick={() => {
                  setTeksHex({});
                  ubahPalet(c.palet);
                }}
                className="group flex items-center gap-2.5 bg-white/[0.06] py-1.5 pl-1.5 pr-3 text-[12.5px] font-medium text-ink-body transition-colors duration-200 hover:bg-white/[0.12] hover:text-ink"
              >
                <span aria-hidden="true" className="flex h-5 w-9 overflow-hidden">
                  <span className="flex-1" style={{ background: c.palet.latar }} />
                  <span className="flex-1" style={{ background: c.palet.kartu }} />
                  <span className="flex-1" style={{ background: c.palet.aksen }} />
                </span>
                {c.nama}
              </button>
            ))}
          </div>

          {peringatan.length > 0 && (
            <ul className="mt-4 space-y-1 bg-white/[0.06] px-4 py-3 shadow-[inset_3px_0_0_var(--color-blue-500)]" role="status">
              {peringatan.map((p) => (
                <li key={p} className="text-[12.5px] leading-[1.6] text-ink-body">
                  {p}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              setTeksHex({});
              ubahPalet(PALET_BAWAAN);
            }}
            className="mt-4 text-[12.5px] font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Setel ulang palet
          </button>
        </div>
      )}
    </div>
  );
}
