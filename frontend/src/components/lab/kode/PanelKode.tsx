"use client";
import type { GalatKode, LangkahKode, VariabelKode } from "@/lib/lab/kodeTypes";
import { cn } from "@/lib/cn";

export const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted";
const TOMBOL = "inline-flex items-center justify-center px-2.5 py-1.5 text-sm text-ink-body transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

/** Pemutar langkah demi langkah ala Python Tutor. */
export function PemutarKode({
  ke,
  jumlah,
  memutar,
  kecepatan,
  terpotong,
  onKe,
  onPutar,
  onJeda,
  onKecepatan,
  onSunting,
}: {
  ke: number;
  jumlah: number;
  memutar: boolean;
  kecepatan: number;
  terpotong: boolean;
  onKe: (i: number) => void;
  onPutar: () => void;
  onJeda: () => void;
  onKecepatan: (v: number) => void;
  onSunting: () => void;
}) {
  const akhir = jumlah - 1;
  return (
    <div className="flex flex-col gap-2 bg-paper-card p-3">
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={TOMBOL} onClick={() => onKe(0)} disabled={ke === 0} title="Ke awal (Home)" aria-label="Ke awal">
          ⏮
        </button>
        <button type="button" className={TOMBOL} onClick={() => onKe(ke - 1)} disabled={ke === 0} title="Langkah sebelumnya (←)" aria-label="Langkah sebelumnya">
          ‹
        </button>
        <button
          type="button"
          className={cn(TOMBOL, "min-w-[4.5rem] bg-blue-600 font-semibold text-white hover:bg-blue-700")}
          onClick={memutar ? onJeda : onPutar}
          disabled={!memutar && ke >= akhir}
        >
          {memutar ? "Jeda" : "Putar"}
        </button>
        <button type="button" className={TOMBOL} onClick={() => onKe(ke + 1)} disabled={ke >= akhir} title="Langkah berikutnya (→)" aria-label="Langkah berikutnya">
          ›
        </button>
        <button type="button" className={TOMBOL} onClick={() => onKe(akhir)} disabled={ke >= akhir} title="Ke akhir (End)" aria-label="Ke akhir">
          ⏭
        </button>
        <select
          aria-label="Kecepatan"
          value={kecepatan}
          onChange={(e) => onKecepatan(Number(e.target.value))}
          className="bg-transparent px-1 py-1 text-sm text-ink-body focus:outline-none"
        >
          {[0.5, 1, 2, 4].map((x) => (
            <option key={x} value={x}>
              {x}×
            </option>
          ))}
        </select>
        <button type="button" className={cn(TOMBOL, "ml-auto")} onClick={onSunting}>
          Sunting
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={akhir}
        value={ke}
        onChange={(e) => onKe(Number(e.target.value))}
        aria-label="Geser ke langkah"
        className="range-tipis w-full"
      />
      <p className="text-xs tabular-nums text-ink-muted">
        Langkah {ke + 1} dari {jumlah}
        {terpotong && " · rekaman dipotong (program terlalu panjang untuk direkam seluruhnya; langkah terakhir = keadaan akhir)"}
      </p>
    </div>
  );
}

export function KotakGalat({ galat, basi, onKeBaris }: { galat: GalatKode; basi: boolean; onKeBaris?: (n: number) => void }) {
  return (
    <div role="alert" className="kode-baris-galat p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-error-text">
        {galat.jenis}
        {galat.baris !== null && (
          <>
            {" · "}
            {onKeBaris && !basi ? (
              <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => onKeBaris(galat.baris!)}>
                baris {galat.baris}
              </button>
            ) : (
              `baris ${galat.baris}`
            )}
          </>
        )}
      </p>
      <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">{galat.pesan}</pre>
      {galat.saran && <p className="mt-2 text-sm leading-relaxed text-ink-body">{galat.saran}</p>}
      {basi && <p className="mt-2 text-xs text-ink-muted">Kode sudah diubah sejak dijalankan - jalankan lagi untuk memeriksa.</p>}
    </div>
  );
}

export function KonsolKode({ teks, kosong }: { teks: string; kosong: string }) {
  return (
    <div className="bg-paper-card p-4">
      <p className={LABEL}>Keluaran</p>
      <pre
        aria-live="polite"
        className="max-h-64 min-h-[3rem] overflow-auto whitespace-pre-wrap break-words bg-white/[0.06] p-3 font-mono text-[13px] leading-relaxed text-ink"
      >
        {teks.length > 0 ? teks : <span className="text-ink-muted">{kosong}</span>}
      </pre>
    </div>
  );
}

const kunciVar = (v: VariabelKode) => `${v.lingkup}\u0000${v.nama}`;

/** Variabel per lingkup (global, lalu bingkai fungsi terdalam terakhir); yang baru berubah disorot. */
export function PanelVariabel({ langkah, sebelumnya }: { langkah: LangkahKode; sebelumnya: LangkahKode | null }) {
  const lama = new Map((sebelumnya?.vars ?? []).map((v) => [kunciVar(v), v.nilai]));
  const kelompok: { lingkup: string; vars: VariabelKode[] }[] = [];
  for (const v of langkah.vars) {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir && akhir.lingkup === v.lingkup) akhir.vars.push(v);
    else kelompok.push({ lingkup: v.lingkup, vars: [v] });
  }
  return (
    <div className="bg-paper-card p-4">
      <p className={LABEL}>Variabel</p>
      {langkah.tumpukan.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <span>Pemanggilan:</span>
          {langkah.tumpukan.map((n, i) => (
            <span key={i} className={cn("bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]", i === langkah.tumpukan.length - 1 && "bg-blue-500/20 text-ink")}>
              {n}
            </span>
          ))}
        </p>
      )}
      {kelompok.length === 0 ? (
        <p className="text-xs text-ink-muted">Belum ada variabel.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {kelompok.map((k) => (
            <div key={k.lingkup}>
              <p className="mb-1 text-[11px] font-semibold text-ink-muted">{k.lingkup === "global" ? "Global" : k.lingkup}</p>
              <table className="w-full table-fixed text-sm">
                <tbody>
                  {k.vars.map((v) => {
                    const sebelum = lama.get(kunciVar(v));
                    const berubah = sebelumnya !== null && sebelum !== v.nilai;
                    return (
                      <tr key={v.nama} className={cn("border-t border-white/5 transition-colors", berubah && "bg-blue-500/15")}>
                        <td className="w-[30%] truncate py-1 pr-2 font-mono text-ink" title={v.nama}>
                          {v.nama}
                        </td>
                        <td className="break-all py-1 pr-2 font-mono text-ink-body">{v.nilai}</td>
                        <td className="w-[28%] py-1 text-right text-[11px] leading-tight text-ink-muted">{v.jenis}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
