"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { PengaturanSuara } from "./suaraGame";

function Saklar({ aktif, nama, ubah }: { aktif: boolean; nama: string; ubah: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      onClick={ubah}
      className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left text-[13px] font-extrabold text-[#2B2233] kecil:text-[11px]"
    >
      {nama}
      <span className={cn("relative inline-block h-5 w-9 shrink-0 rounded-full border-2 border-[#2B2233] transition-colors kecil:h-4 kecil:w-7", aktif ? "bg-[#6BA7D8]" : "bg-[#D9CDB5]")}>
        <span className={cn("absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#2B2233] transition-all kecil:h-2.5 kecil:w-2.5", aktif ? "left-[calc(100%-1rem)] kecil:left-[calc(100%-0.85rem)]" : "left-0.5")} />
      </span>
    </button>
  );
}

/**
 * Tombol pengeras suara + panel kecil untuk menghidupkan/mematikan MUSIK dan EFEK suara game (disimpan di perangkat). Panel
 * terbuka ke kiri tombol supaya tak keluar layar saat tombol ada di pojok kanan atas. Gaya stiker, sama dengan tombol game lain.
 */
export default function PanelSuara({
  peng,
  onMusik,
  onEfek,
  tombolClass,
}: {
  peng: PengaturanSuara;
  onMusik: (b: boolean) => void;
  onEfek: (b: boolean) => void;
  tombolClass: string;
}) {
  const [buka, setBuka] = useState(false);
  const semua = peng.musik || peng.efek;
  return (
    <div className="relative">
      <button type="button" aria-expanded={buka} aria-label="Pengaturan suara" onClick={() => setBuka((b) => !b)} className={cn(tombolClass, semua && "bg-[#6BA7D8]")}>
        <svg viewBox="0 0 20 20" className="h-5 w-5 kecil:h-4 kecil:w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
          {semua ? <path d="M13.5 7.5a3.5 3.5 0 010 5M15.5 5.5a6 6 0 010 9" /> : <path d="M13.5 8l4 4M17.5 8l-4 4" />}
        </svg>
      </button>
      {buka && (
        <div role="group" aria-label="Suara" className="absolute right-full top-0 z-10 mr-2 w-40 rounded-xl border-[2.5px] border-[#2B2233] bg-[#FBF1DA] p-1.5 shadow-[3px_3px_0_#2B2233] kecil:w-32 kecil:p-1">
          <Saklar aktif={peng.musik} nama="Musik" ubah={() => onMusik(!peng.musik)} />
          <Saklar aktif={peng.efek} nama="Efek suara" ubah={() => onEfek(!peng.efek)} />
        </div>
      )}
    </div>
  );
}
