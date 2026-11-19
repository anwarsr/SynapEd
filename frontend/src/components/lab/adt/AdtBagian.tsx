"use client";
import type { PitaAdt } from "@/lib/lab/adtBersama";
import type { LabPeran } from "@/lib/lab/labTypes";
import { LAB_TONE_CLASS, kelasFokus } from "../labTone";
import { cn } from "@/lib/cn";

/**
 * Potongan papan yang dipakai bersama Lab Stack & Lab Queue: kelas warna sel,
 * baris variabel penunjuk, kotak OUTPUT, pita penerapan, dan tombol mulai cepat.
 */

/** Warna satu sel menurut peran langkah ini, fokus, dan apakah ia masih di dalam struktur. */
export function kelasSel(o: { peran?: LabPeran; fokus: boolean; jumlahFokus: number; dalam: boolean; kosong: boolean }): string {
  if (o.peran === "hapus") return LAB_TONE_CLASS.buang;
  if (o.peran === "hasil") return LAB_TONE_CLASS.hasil;
  if (o.peran === "luar") return "bg-white/[0.03] text-ink-faint";
  if (o.fokus) return kelasFokus(o.jumlahFokus);
  if (o.kosong) return "bg-white/[0.03] text-ink-faint";
  return o.dalam ? "bg-white/[0.10] text-white" : "bg-white/[0.03] text-ink-faint";
}

export function BarisVariabel({ isi }: { isi: readonly { nama: string; nilai: string; sorot?: boolean }[] }) {
  return (
    <dl className="flex flex-wrap gap-1.5" aria-label="Variabel">
      {isi.map((v) => (
        <div key={v.nama} className={cn("flex items-baseline gap-2 px-3 py-1.5 font-mono text-[12px]", v.sorot ? "bg-blue-600 text-white" : "bg-white/[0.06] text-ink-body")}>
          <dt className={v.sorot ? "text-white/80" : "text-ink-muted"}>{v.nama}</dt>
          {/* Kunci = nilai: angka yang berubah berdenyut sekali. */}
          <dd key={v.nilai} className="lab-pop font-semibold tabular-nums">
            {v.nilai}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function KotakKeluaran({ baris }: { baris: readonly string[] }) {
  if (baris.length === 0) return null;
  return (
    <div className="lab-fade-up bg-white/[0.04] px-4 py-3 shadow-[inset_3px_0_0_var(--color-amber-500)]">
      <p className="t-label mb-1 text-ink-muted">OUTPUT</p>
      <ul className="space-y-0.5 font-mono text-[12.5px] text-ink">
        {baris.slice(-6).map((b, i) => (
          <li key={`${i}-${b}`}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

export function PanelPita({ pita }: { pita: PitaAdt | null }) {
  if (!pita) return null;
  return (
    <section aria-label={pita.judul} className="lab-fade-up bg-white/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="t-label text-ink">{pita.judul}</h3>
        <span className="text-[11px] text-ink-muted">
          {pita.posisi < 0 ? "belum mulai" : pita.posisi >= pita.token.length ? "selesai dibaca" : `membaca ke-${pita.posisi + 1} dari ${pita.token.length}`}
        </span>
      </div>
      <ol className="flex flex-wrap gap-1">
        {pita.token.map((t, i) => (
          <li
            key={i}
            className={cn(
              "min-w-7 px-2 py-1 text-center font-mono text-[13px] font-semibold transition-colors duration-300",
              i === pita.posisi ? "bg-blue-600 text-white" : i < pita.posisi ? "bg-white/[0.04] text-ink-faint" : "bg-white/[0.08] text-ink",
            )}
          >
            {t}
          </li>
        ))}
      </ol>
      {pita.hasil && (
        <p className="mt-3 text-sm text-ink-body">
          Hasil: <span className="font-mono font-semibold text-ink">{pita.hasil}</span>
        </p>
      )}
      {pita.simpulan && (
        <p
          role="status"
          className={cn("lab-pop mt-3 px-3 py-2 text-sm font-semibold", pita.simpulan.baik ? "bg-blue-500/20 text-blue-200" : "bg-[#E0795A]/20 text-error-text")}
        >
          {pita.simpulan.teks}
        </p>
      )}
    </section>
  );
}

export function MulaiCepat<Op>({ pilihan, onMulai }: { pilihan: readonly { label: string; op: () => Op }[]; onMulai: (op: Op) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {pilihan.map((m, i) => (
        <button
          key={m.label}
          type="button"
          onClick={() => onMulai(m.op())}
          className="lab-fade-up bg-white/[0.06] px-4 py-2 text-[13px] font-semibold tracking-[0.02em] text-ink-body transition-colors duration-300 ease-out-soft hover:bg-white/10 hover:text-white hover:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
          style={{ "--d": `${120 + i * 70}ms` } as React.CSSProperties}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Judul kecil sebuah bagian papan ("Gambaran", "Memori array"). */
export function JudulBagian({ judul, ket }: { judul: string; ket?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="t-label text-ink">{judul}</span>
      {ket && <span className="text-[11px] text-ink-muted">{ket}</span>}
    </div>
  );
}
