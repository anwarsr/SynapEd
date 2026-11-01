"use client";
import { useEffect } from "react";
import { IKON, Ikon, Kelompok, TOMBOL } from "../LabAlat";
import type { LabPlayer } from "@/lib/useLabPlayer";
import { KECEPATAN_PELAN } from "@/lib/lab/labTypes";
import { cn } from "@/lib/cn";

/**
 * Bagian bersama lab "langkah demi langkah" (Sorting, Searching): pemutar,
 * narasi, garis waktu, dan pintasan keyboard. Algoritma direkam dulu menjadi
 * potret-potret utuh, lalu `useLabPlayer` memutarnya — komponen ini hanya
 * kendali dan teksnya, tidak tahu apa yang sedang divisualisasikan.
 */

/** Putar/jeda; di ujung, Putar berarti "putar ulang dari awal". */
export function putarAtauJeda(pemutar: LabPlayer, jumlah: number, onMulai?: () => void) {
  if (pemutar.memutar) return pemutar.jeda();
  if (pemutar.frame >= jumlah - 1) pemutar.keLangkah(0);
  pemutar.putar();
  onMulai?.();
}

export function PemutarLangkah({ pemutar, jumlah, onMulai }: { pemutar: LabPlayer; jumlah: number; onMulai?: () => void }) {
  const terakhir = jumlah - 1;
  return (
    <Kelompok label="Pemutar">
      <button type="button" className={TOMBOL} onClick={() => pemutar.keLangkah(0)} disabled={pemutar.frame === 0} title="Ke awal (Home)" aria-label="Ke awal">
        ⏮
      </button>
      <button type="button" className={TOMBOL} onClick={pemutar.mundur} disabled={pemutar.frame === 0} title="Langkah sebelumnya (←)" aria-label="Langkah sebelumnya">
        ‹
      </button>
      <button
        type="button"
        onClick={() => putarAtauJeda(pemutar, jumlah, onMulai)}
        disabled={pemutar.hematGerak}
        title={pemutar.hematGerak ? "Hemat gerak aktif: pakai tombol langkah" : "Putar / jeda (Spasi)"}
        className={cn(TOMBOL, "min-w-[5.5rem] justify-center bg-blue-600 font-semibold text-white hover:bg-blue-700")}
      >
        {!pemutar.hematGerak && <Ikon d={pemutar.memutar ? IKON.henti : IKON.putar} />}
        {pemutar.memutar ? "Jeda" : pemutar.frame >= terakhir ? "Ulangi" : "Putar"}
      </button>
      <button type="button" className={TOMBOL} onClick={pemutar.maju} disabled={pemutar.frame >= terakhir} title="Langkah berikutnya (→)" aria-label="Langkah berikutnya">
        ›
      </button>
      <button type="button" className={TOMBOL} onClick={() => pemutar.keLangkah(terakhir)} disabled={pemutar.frame >= terakhir} title="Ke akhir (End)" aria-label="Ke akhir">
        ⏭
      </button>
      <select
        aria-label="Kecepatan"
        value={pemutar.kecepatan}
        onChange={(e) => pemutar.setKecepatan(Number(e.target.value))}
        className="bg-transparent px-1 py-1 text-sm text-ink-body focus:outline-none"
      >
        {KECEPATAN_PELAN.map((k) => (
          <option key={k} value={k}>
            {String(k).replace(".", ",")}×
          </option>
        ))}
      </select>
    </Kelompok>
  );
}

/** Tab pemilih algoritma di dalam satu lab (Bubble/Merge, Linear/Binary). */
export function TabAlgoritma<T extends string>({
  label,
  pilihan,
  nilai,
  onPilih,
}: {
  label: string;
  pilihan: readonly { id: T; nama: string }[];
  nilai: T;
  onPilih: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex bg-paper-card p-1">
      {pilihan.map((p) => {
        const dipilih = p.id === nilai;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={dipilih}
            onClick={() => onPilih(p.id)}
            className={cn(
              "px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
              dipilih ? "bg-blue-600 text-white" : "text-ink-muted hover:bg-white/10 hover:text-ink",
            )}
          >
            {p.nama}
          </button>
        );
      })}
    </div>
  );
}

export function NarasiLangkah({ fase, narasi, ke, jumlah }: { fase: string; narasi: string; ke: number; jumlah: number }) {
  return (
    <div className="bg-paper-card px-5 py-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">{fase}</p>
        <p className="text-xs tabular-nums text-ink-muted">
          Langkah {ke + 1} / {jumlah}
        </p>
      </div>
      <p key={ke} className="lab-fade-up mt-1.5 text-[15px] leading-relaxed text-ink">
        {narasi}
      </p>
    </div>
  );
}

export function GarisWaktu({ pemutar, jumlah }: { pemutar: LabPlayer; jumlah: number }) {
  return (
    <label className="flex items-center gap-3 text-xs text-ink-muted">
      <span className="shrink-0">Garis waktu</span>
      <input
        type="range"
        min={0}
        max={jumlah - 1}
        value={pemutar.frame}
        onChange={(e) => pemutar.keLangkah(Number(e.target.value))}
        className="range-tipis w-full"
        aria-label="Pilih langkah"
      />
    </label>
  );
}

export function DaftarPintasan() {
  return (
    <details className="group bg-paper-card px-5 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between text-ink-body">
        Tombol pintas keyboard
        <span aria-hidden="true" className="text-ink-faint transition-transform duration-200 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-xs text-ink-muted sm:grid-cols-2">
        {[
          ["Spasi", "putar atau jeda"],
          ["← / →", "langkah mundur / maju"],
          ["Home / End", "ke awal / ke akhir"],
          ["Esc", "keluar layar penuh"],
        ].map(([tombol, arti]) => (
          <li key={tombol} className="flex items-center gap-2">
            <kbd className="bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-ink">{tombol}</kbd>
            {arti}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Pintasan keyboard pemutar — hanya saat lab ini yang tampil, dan tidak saat
 * mengetik atau saat fokus di tombol (Spasi di tombol sudah menekan tombol itu).
 */
export function usePintasanPemutar(opsi: {
  aktif: boolean;
  pemutar: LabPlayer;
  jumlah: number;
  presentasi: boolean;
  keluarPresentasi: () => void;
  onMulai?: () => void;
}) {
  const { aktif, pemutar, jumlah, presentasi, keluarPresentasi, onMulai } = opsi;
  useEffect(() => {
    if (!aktif) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable='true']") || (e.key === " " && t.closest("button, summary")))) return;
      if (e.key === "Escape" && presentasi) keluarPresentasi();
      else if (e.key === " ") putarAtauJeda(pemutar, jumlah, onMulai);
      else if (e.key === "ArrowRight") pemutar.maju();
      else if (e.key === "ArrowLeft") pemutar.mundur();
      else if (e.key === "Home") pemutar.keLangkah(0);
      else if (e.key === "End") pemutar.keLangkah(jumlah - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [aktif, pemutar, jumlah, presentasi, keluarPresentasi, onMulai]);
}
