"use client";
import type { LangkahBubble, PeranBatang } from "@/lib/lab/sort/sortTypes";
import { cn } from "@/lib/cn";

/** Warna batang per peran. Batang biasa memakai isian samar supaya peran menonjol. */
const WARNA: Record<PeranBatang | "biasa", string> = {
  biasa: "bg-white/[0.16]",
  banding: "bg-blue-300",
  tukar: "bg-amber-500",
  terurut: "bg-blue-600",
};

/**
 * Deretan batang bubble sort: tinggi = nilai, angka di atasnya.
 *
 * Setiap batang selebar 1/n papan dan digeser lewat properti CSS `translate`
 * sebesar posisinya × lebarnya sendiri (persen `translate` dihitung dari lebar
 * elemen itu), jadi pertukaran tampil sebagai dua batang yang meluncur
 * bersilangan. Urutan DOM DIKUNCI menurut id: elemen yang dipindah React
 * diperlakukan peramban sebagai elemen baru dan transisinya tidak berjalan
 * (lihat `urutStabil.ts`).
 */
export default function PapanBubble({ langkah }: { langkah: LangkahBubble }) {
  const n = langkah.urutan.length;
  const maks = Math.max(1, ...langkah.urutan.map((b) => b.nilai));
  const posisi = new Map(langkah.urutan.map((b, i) => [b.id, i]));
  const perId = [...langkah.urutan].sort((a, b) => a.id - b.id);
  const batas = langkah.batasTerurut;

  return (
    <div className="bg-paper-card px-3 pb-3 pt-6 sm:px-5">
      <div className="relative h-64 sm:h-72" role="img" aria-label={`Data sekarang: ${langkah.urutan.map((b) => b.nilai).join(", ")}`}>
        {/* Batas bagian kanan yang sudah di tempat akhirnya. */}
        {batas > 0 && batas < n && (
          <div
            aria-hidden="true"
            className="lab-posisi absolute bottom-0 top-0 w-px bg-blue-400/60"
            style={{ left: `${(batas / n) * 100}%` }}
          />
        )}

        {perId.map((b) => {
          const peran = langkah.peran[b.id];
          const label = langkah.label[b.id];
          const tinggi = Math.max(4, (b.nilai / maks) * 78);
          return (
            <div
              key={b.id}
              className="lab-posisi absolute bottom-0 left-0 flex h-full flex-col items-center justify-end px-[3px] sm:px-1.5"
              style={{ width: `${100 / n}%`, translate: `${(posisi.get(b.id) ?? 0) * 100}% 0` }}
            >
              <span
                className={cn(
                  "mb-1 h-5 text-xs font-bold text-blue-300 transition-opacity duration-300",
                  label ? "opacity-100" : "opacity-0",
                )}
              >
                {label ?? "j"}
              </span>
              <span
                className={cn(
                  "mb-1 text-xs font-semibold tabular-nums sm:text-sm",
                  peran === "banding" || peran === "tukar" ? "text-ink" : "text-ink-body",
                )}
              >
                {b.nilai}
              </span>
              <div
                className={cn(
                  "w-full transition-[background-color,height] duration-300 ease-out-soft",
                  WARNA[peran ?? "biasa"],
                  peran === "tukar" && "lab-glow",
                )}
                style={{ height: `${tinggi}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Indeks A[1..N] tidak ikut bergerak — yang bergerak nilainya. */}
      <div className="mt-2 flex" aria-hidden="true">
        {langkah.urutan.map((_, i) => (
          <span
            key={i}
            className={cn("flex-1 text-center text-[10px] tabular-nums sm:text-[11px]", i >= batas ? "text-blue-300" : "text-ink-faint")}
          >
            {n > 9 ? i + 1 : `A[${i + 1}]`}
          </span>
        ))}
      </div>
    </div>
  );
}
