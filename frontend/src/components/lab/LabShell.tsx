"use client";
import { useCallback, useState } from "react";
import LabWorkspace from "./LabWorkspace";
import { KIT_ARRAY_1D, KIT_ARRAY_2D, KIT_ARRAY_3D, KIT_ARRAY_ND } from "./labKits";
import type { LabSnapshot } from "@/lib/lab/labUrl";
import type { LabId } from "@/lib/lab/labTypes";
import { cn } from "@/lib/cn";

const URUTAN: readonly { id: LabId; nama: string; ringkas: string }[] = [
  KIT_ARRAY_1D,
  KIT_ARRAY_2D,
  KIT_ARRAY_3D,
  KIT_ARRAY_ND,
];

/**
 * Pengalih antar lab array (1D · 2D · 3D · N-D) beserta kepala halamannya.
 *
 * Setiap lab punya ruang kerjanya sendiri. Ruang kerja dipasang saat pertama
 * kali dibuka lalu DIBIARKAN terpasang (hanya disembunyikan) — berpindah ke 2D
 * untuk menunjukkan sesuatu lalu kembali ke 1D tidak boleh menghapus papan
 * dan riwayat 1D yang sedang dipakai mengajar.
 */
export default function LabShell({ awal, tautanRusak }: { awal: LabSnapshot | null; tautanRusak: boolean }) {
  const [aktif, setAktif] = useState<LabId>(awal?.lab ?? "array1d");
  const [dibuka, setDibuka] = useState<ReadonlySet<LabId>>(() => new Set([awal?.lab ?? "array1d"]));
  const [beritahuRusak, setBeritahuRusak] = useState(tautanRusak);

  const pilih = useCallback((id: LabId) => {
    setAktif(id);
    setDibuka((s) => (s.has(id) ? s : new Set([...s, id])));
  }, []);

  const sembunyikanPemberitahuan = useCallback(() => setBeritahuRusak(false), []);

  const lab = URUTAN.find((l) => l.id === aktif) ?? URUTAN[0];

  const judul = (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            Lab 01 · Array {lab.nama}
          </p>
          <h1 className="t-h3 mt-1 text-2xl lg:text-[1.75rem]">
            Synap<span className="text-blue-600">Lab</span>
          </h1>
        </div>

        <div role="tablist" aria-label="Dimensi array" className="flex rounded-full border border-rule bg-paper-card p-1 shadow-soft">
          {URUTAN.map((l) => {
            const dipilih = l.id === aktif;
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={dipilih}
                onClick={() => pilih(l.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums transition-all duration-200 ease-out-soft",
                  dipilih ? "bg-blue-600 text-white shadow-soft" : "text-ink-body hover:bg-blue-50 hover:text-blue-700",
                )}
              >
                {/* Kunci = pilihan: label yang baru dipilih berdenyut sekali. */}
                <span key={String(dipilih)} className={cn("inline-block", dipilih && "lab-pop")}>
                  {l.nama}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p key={aktif} className="lab-fade-up text-sm text-ink-muted">
        {lab.ringkas}
      </p>

      {beritahuRusak && (
        <p role="status" className="lab-fade-up rounded-xl border border-amber-500/30 bg-amber-100 px-4 py-3 text-sm text-amber-700">
          Tautan papan tidak dapat dibaca, jadi lab dibuka kosong.
        </p>
      )}
    </header>
  );

  // Satu cabang per lab, bukan peta kit generik: tiap `LabWorkspace` harus
  // tahu tipe keadaan lab-nya sendiri, dan peta heterogen hanya bisa diketik
  // dengan membuang tipe itu.
  return (
    <>
      {dibuka.has("array1d") && (
        <div hidden={aktif !== "array1d"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_1D}
            awal={awal?.lab === "array1d" ? awal.state : KIT_ARRAY_1D.kosong()}
            judul={judul}
            aktif={aktif === "array1d"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("array2d") && (
        <div hidden={aktif !== "array2d"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_2D}
            awal={awal?.lab === "array2d" ? awal.state : KIT_ARRAY_2D.kosong()}
            judul={judul}
            aktif={aktif === "array2d"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("array3d") && (
        <div hidden={aktif !== "array3d"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_3D}
            awal={awal?.lab === "array3d" ? awal.state : KIT_ARRAY_3D.kosong()}
            judul={judul}
            aktif={aktif === "array3d"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("arrayNd") && (
        <div hidden={aktif !== "arrayNd"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_ND}
            awal={awal?.lab === "arrayNd" ? awal.state : KIT_ARRAY_ND.kosong()}
            judul={judul}
            aktif={aktif === "arrayNd"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
    </>
  );
}
