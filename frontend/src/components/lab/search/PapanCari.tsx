"use client";
import { useEffect, useRef, useState } from "react";
import type { LangkahCari, NamaPenunjuk } from "@/lib/lab/search/searchTypes";
import { cn } from "@/lib/cn";

const JARAK = 6;
/** Tinggi lajur label penunjuk di atas kotak — cukup untuk tiga label bertumpuk. */
const LAJUR_LABEL = 36;
const LAJUR_INDEKS = 18;
const URUTAN_LABEL: NamaPenunjuk[] = ["Kiri", "Tengah", "Kanan", "i"];

/**
 * Kotak berindeks Lab Searching.
 *
 * Kotak dibungkus menjadi beberapa baris (32 data tidak muat sebaris), tetapi
 * setiap kotak tetap diposisikan ABSOLUT lewat `translate` dari kolom/barisnya
 * — bukan flex-wrap — supaya saat binary search mengurutkan data, kotak
 * meluncur ke tempat barunya, juga melintasi baris. Jumlah kolom dihitung dari
 * lebar papan (ResizeObserver). Urutan DOM tetap per `id` (pelajaran
 * `urutStabil.ts`): node yang dipindah React tidak bertransisi.
 *
 * Lebar awal 720px dipakai server DAN klien (sama, jadi tanpa hydration
 * mismatch), lalu diganti ukuran sebenarnya begitu terukur.
 */
export default function PapanCari({ langkah, dicari }: { langkah: LangkahCari; dicari: number }) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(720);

  useEffect(() => {
    const el = wadahRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLebar(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = langkah.sel.length;
  const SEL = lebar < 480 ? 40 : 48;
  const kolom = Math.max(1, Math.min(n, Math.floor((lebar + JARAK) / (SEL + JARAK))));
  const jumlahBaris = Math.ceil(n / kolom);
  const tinggiBaris = LAJUR_LABEL + SEL + LAJUR_INDEKS + 10;
  const kiriAwal = Math.max(0, (lebar - (kolom * (SEL + JARAK) - JARAK)) / 2);

  const posisi = new Map(langkah.sel.map((s, i) => [s.id, i]));
  const perId = [...langkah.sel].sort((a, b) => a.id - b.id);
  const label = new Map<number, NamaPenunjuk[]>();
  for (const nama of URUTAN_LABEL) {
    const i = langkah.penunjuk[nama];
    if (i !== undefined && i >= 0 && i < n) label.set(i, [...(label.get(i) ?? []), nama]);
  }
  const { Kiri, Kanan } = langkah.penunjuk;
  const dalamRentang = (i: number) => Kiri !== undefined && Kanan !== undefined && i >= Kiri && i <= Kanan;
  const tersingkir = (i: number) => langkah.tersingkir.some(([a, b]) => i >= a && i <= b);
  const ketemu = langkah.hasil?.ketemu ? langkah.hasil.indeks : null;

  return (
    <div className="bg-paper-card px-3 pb-4 pt-4 sm:px-5">
      <p className="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm text-ink-muted">
        <span>
          Cari <span className="text-2xl font-semibold tabular-nums text-ink">{dicari}</span>
        </span>
        <span className="text-xs">dalam {n} data</span>
      </p>

      <div
        ref={wadahRef}
        className="relative transition-[height] duration-300"
        style={{ height: jumlahBaris * tinggiBaris }}
        role="img"
        aria-label={`Data: ${langkah.sel.map((s) => s.nilai).join(", ")}`}
      >
        {perId.map((s) => {
          const i = posisi.get(s.id) ?? 0;
          const x = kiriAwal + (i % kolom) * (SEL + JARAK);
          const y = Math.floor(i / kolom) * tinggiBaris;
          const aktif = langkah.aktif === i;
          const ok = ketemu === i;
          const redup = tersingkir(i) && !ok;
          const nama = label.get(i) ?? [];
          return (
            <div
              key={s.id}
              className="lab-posisi absolute left-0 top-0 flex flex-col items-center"
              style={{ width: SEL, translate: `${x}px ${y}px` }}
            >
              <div className="flex flex-col items-center justify-end" style={{ height: LAJUR_LABEL }}>
                {nama.map((t) => (
                  <span key={t} className="lab-pop text-[10px] font-bold leading-[12px] text-blue-300">
                    {t}
                  </span>
                ))}
              </div>
              <div
                className={cn(
                  "flex w-full items-center justify-center text-sm font-semibold tabular-nums transition-[background-color,opacity,box-shadow] duration-300",
                  ok ? "bg-blue-600 text-white" : aktif ? "lab-glow bg-blue-300 text-paper" : "bg-white/[0.08] text-ink",
                  redup && "opacity-30",
                  dalamRentang(i) && !aktif && !ok && "shadow-[inset_0_-3px_0_var(--color-blue-400)]",
                )}
                style={{ height: SEL }}
              >
                {s.nilai}
              </div>
              <span className={cn("mt-1 text-[10px] tabular-nums", redup ? "text-ink-faint/60" : "text-ink-faint")} style={{ height: LAJUR_INDEKS - 4 }}>
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
