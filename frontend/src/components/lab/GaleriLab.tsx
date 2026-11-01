"use client";
import IlustrasiLab from "./IlustrasiLab";
import type { BagianNavigasi } from "./LabNavigasi";
import { cn } from "@/lib/cn";

/**
 * Galeri kartu semua lab SynapLab — dipakai di halaman depan `/lab` DAN di
 * lapisan layar penuh tombol ☰ (`LabNavigasi`), supaya seluruh materi terlihat
 * sekaligus tanpa menggulir daftar sempit (permintaan pemilik, acuan VisuAlgo).
 *
 * Satu kartu per ITEM; nomor & nama bagian diambil dari bagiannya. Kartu
 * persegi tanpa border, terangkat 4px saat hover - sama dengan kartu kursus.
 */
export default function GaleriLab({
  bagian,
  aktif,
  onPilih,
}: {
  bagian: readonly BagianNavigasi[];
  /** Id item yang sedang dibuka; null di halaman depan. */
  aktif: string | null;
  onPilih: (id: string) => void;
}) {
  const kartu = bagian.flatMap((b) => b.item.map((it) => ({ ...it, nomor: b.nomor, materi: b.nama })));

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {kartu.map((k, i) => {
        const dipilih = k.id === aktif;
        return (
          <li key={k.id} className="lab-fade-up" style={{ "--d": `${i * 45}ms` } as React.CSSProperties}>
            <button
              type="button"
              aria-current={dipilih ? "page" : undefined}
              onClick={() => onPilih(k.id)}
              className={cn(
                "group flex h-full w-full flex-col bg-paper-card text-left transition-transform duration-300 ease-out-soft hover:-translate-y-1",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                dipilih && "shadow-[inset_0_-3px_0_var(--color-blue-500)]",
              )}
            >
              <span className="relative block aspect-[2/1] overflow-hidden bg-header px-6 py-3">
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-1 text-[3.2rem] font-black leading-none tracking-[-0.06em] tabular-nums text-white/[0.07]"
                >
                  {k.nomor}
                </span>
                <span className="relative block h-full transition-transform duration-500 ease-out-soft group-hover:scale-[1.04]">
                  <IlustrasiLab id={k.id} />
                </span>
              </span>
              <span className="flex flex-1 flex-col px-5 pb-4 pt-3.5">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">Lab {k.nomor}</span>
                  {dipilih && <span className="text-[11px] font-semibold text-ink-muted">Sedang dibuka</span>}
                </span>
                <span className="mt-1.5 block text-lg font-bold text-ink">{k.materi}</span>
                {/* Subjudul hanya bila berbeda dari nama materi ("Array / Array" tidak berguna). */}
                {k.nama !== k.materi && <span className="block text-sm font-medium text-ink-body">{k.nama}</span>}
                <span className="mt-1.5 line-clamp-2 text-xs leading-[1.6] text-ink-muted">{k.ket}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
