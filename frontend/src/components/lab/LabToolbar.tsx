"use client";
import { cn } from "@/lib/cn";

/** Path ikon Heroicons (outline 24px), ditulis inline seperti sisa repo. */
const IKON = {
  undo: "M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3",
  redo: "M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3",
  mundur: "M15.75 19.5L8.25 12l7.5-7.5",
  maju: "M8.25 4.5l7.5 7.5-7.5 7.5",
  reset: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
  layar: "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15",
  keluar: "M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25",
} as const;

function Ikon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={cn("h-4 w-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const TOMBOL =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-ink-body transition-all duration-200 ease-out-soft hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

/** Satu kelompok tombol berbingkai — memisahkan riwayat, pemutar, dan papan. */
function Kelompok({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5 bg-paper-card p-1">
      {children}
    </div>
  );
}

export default function LabToolbar({
  bisaUndo,
  bisaRedo,
  onUndo,
  onRedo,
  onReset,
  memutar,
  adaLangkah,
  onPutar,
  onJeda,
  onMundur,
  onMaju,
  kecepatan,
  onKecepatan,
  presentasi,
  onPresentasi,
  anak,
}: {
  bisaUndo: boolean;
  bisaRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  memutar: boolean;
  adaLangkah: boolean;
  onPutar: () => void;
  onJeda: () => void;
  onMundur: () => void;
  onMaju: () => void;
  kecepatan: number;
  onKecepatan: (k: number) => void;
  presentasi: boolean;
  onPresentasi: () => void;
  /** Slot untuk tombol bagikan — supaya bilah ini tidak perlu tahu soal URL. */
  anak?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Kelompok label="Riwayat">
        <button type="button" onClick={onUndo} disabled={!bisaUndo} className={TOMBOL} title="Batalkan (u)">
          <Ikon d={IKON.undo} />
          <span className="hidden xl:inline">Batalkan</span>
        </button>
        <button type="button" onClick={onRedo} disabled={!bisaRedo} className={TOMBOL} title="Ulangi (r)">
          <Ikon d={IKON.redo} />
          <span className="hidden xl:inline">Ulangi</span>
        </button>
      </Kelompok>

      <Kelompok label="Pemutar langkah">
        <button type="button" onClick={onMundur} disabled={!adaLangkah} className={TOMBOL} title="Langkah sebelumnya (,)" aria-label="Langkah sebelumnya">
          <Ikon d={IKON.mundur} />
        </button>
        <button
          type="button"
          onClick={memutar ? onJeda : onPutar}
          disabled={!adaLangkah}
          title="Putar atau jeda (spasi)"
          className={cn(
            "inline-flex min-w-[5.75rem] items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold",
            "transition-all duration-200 ease-out-soft disabled:cursor-not-allowed",
            adaLangkah
              ? "bg-blue-600 text-white shadow-soft hover:bg-blue-700"
              : "bg-paper-alt text-ink-faint",
          )}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {memutar ? (
              <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
            ) : (
              <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
            )}
          </svg>
          {memutar ? "Jeda" : "Putar"}
        </button>
        <button type="button" onClick={onMaju} disabled={!adaLangkah} className={TOMBOL} title="Langkah berikutnya (.)" aria-label="Langkah berikutnya">
          <Ikon d={IKON.maju} />
        </button>
        <label className="ml-1 flex items-center pr-1" title="Kecepatan putar">
          <span className="sr-only">Kecepatan</span>
          <select
            value={kecepatan}
            onChange={(e) => onKecepatan(Number(e.target.value))}
            className="rounded-md bg-transparent px-1 py-1 text-sm text-ink-body hover:bg-paper-alt focus:outline-none focus:ring-2 focus:ring-blue-500/25"
          >
            <option value={0.5}>0,5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
      </Kelompok>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Kelompok label="Papan">
          <button type="button" onClick={onReset} className={TOMBOL} title="Kosongkan papan">
            <Ikon d={IKON.reset} />
            <span className="hidden xl:inline">Reset</span>
          </button>
          <button type="button" onClick={onPresentasi} className={TOMBOL} title="Mode presentasi (Esc untuk keluar)">
            <Ikon d={presentasi ? IKON.keluar : IKON.layar} />
            <span className="hidden sm:inline">{presentasi ? "Keluar" : "Presentasi"}</span>
          </button>
        </Kelompok>
        {anak}
      </div>
    </div>
  );
}
