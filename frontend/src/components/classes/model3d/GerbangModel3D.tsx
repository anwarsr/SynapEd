"use client";
import { useId, useState } from "react";
import Model3DStage from "@/components/classes/model3d/Model3DStage";
import type { Anotasi3D } from "@/lib/model3dRules";
import { cn } from "@/lib/cn";

/**
 * Objek 3D yang tersembunyi di balik "gerbang": yang tampil hanya kotak
 * berjudul. Diklik → kotaknya memanjang ke bawah (inilah "pintunya")
 * dan memperlihatkan objek 3D-nya.
 *
 * Panggung (dan berkas model yang bisa belasan MB) baru dipasang pada klik
 * PERTAMA - sebelum itu tak ada unduhan atau konteks WebGL sama sekali. Setelah
 * itu panggung tetap terpasang saat ditutup (dijeda sendiri karena tak
 * terlihat), jadi membuka lagi tidak memuat ulang.
 */
export default function GerbangModel3D({
  url,
  judul,
  nama,
  annotations,
  className,
}: {
  url: string;
  judul: string;
  nama: string;
  annotations: readonly Anotasi3D[];
  className?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [pernah, setPernah] = useState(false);
  const idRuang = useId();

  function ketuk() {
    setPernah(true);
    setBuka((b) => !b);
  }

  return (
    <div className={cn("gerbang", className)} data-buka={buka}>
      <button
        type="button"
        onClick={ketuk}
        aria-expanded={buka}
        aria-controls={idRuang}
        className="gerbang-kepala group flex w-full items-center gap-4 bg-white/[0.06] px-5 py-4 text-left shadow-[inset_3px_0_0_var(--color-blue-500)]"
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-50 text-blue-700">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-blue-300">Objek 3D</span>
          <span className="mt-0.5 block break-words text-[17px] font-semibold text-ink">{judul}</span>
          <span className="mt-0.5 block text-[13px] text-ink-muted">
            {annotations.length > 0 ? `${annotations.length} keterangan komponen · ` : ""}
            {buka ? "Ketuk untuk menutup" : "Ketuk untuk membuka"}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className="gerbang-panah h-5 w-5 shrink-0 text-ink-muted transition-transform duration-500 group-hover:text-blue-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div id={idRuang} className="gerbang-ruang" inert={!buka}>
        <div className="gerbang-dalam">
          <div className="relative">
            {pernah && <Model3DStage url={url} nama={nama} annotations={annotations} />}
          </div>
        </div>
      </div>
    </div>
  );
}
