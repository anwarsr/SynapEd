"use client";
import type { Batang, LangkahMerge, SimpulMerge } from "@/lib/lab/sort/sortTypes";
import { cn } from "@/lib/cn";

/** Tinggi satu tingkat pohon (px). */
const TINGGI_TINGKAT = 104;

/**
 * Pohon bagi-gabung merge sort.
 *
 * Setiap simpul diletakkan tepat di bawah rentang induknya: kiri = lo/n,
 * lebar = (hi−lo+1)/n dari lebar papan, satu baris per tingkat. Karena memakai
 * persen, papan selalu muat selebar layar (12 elemen di ponsel 390px ≈ 28px
 * per sel) tanpa perlu diperkecil.
 *
 * Simpul yang baru terlihat dipasang dengan `lab-fade-up` (muncul turun dari
 * induknya). Selama penggabungan, simpul induk berisi slot kosong yang terisi
 * satu per satu (k), dan sel yang sudah diambil diredupkan di simpul anaknya
 * (sebelum i / sebelum j).
 */
export default function PohonMerge({ langkah }: { langkah: LangkahMerge }) {
  const akar = langkah.simpul[0];
  if (!akar) return null;
  const n = akar.hi + 1;
  const maks = Math.max(1, ...akar.isi.concat(langkah.simpul.flatMap((s) => s.isi)).map((b) => b?.nilai ?? 0));
  const tingkat = Math.max(...langkah.simpul.filter((s) => s.status !== "tersembunyi").map((s) => s.tingkat)) + 1;
  const kedalaman = Math.max(...langkah.simpul.map((s) => s.tingkat)) + 1;

  const aktif = langkah.aktif === null ? null : langkah.simpul[langkah.aktif];
  const menggabung = aktif?.status === "menggabung" ? aktif : null;

  return (
    <div className="bg-paper-card px-2 pb-4 pt-5 sm:px-4">
      <div
        className="relative transition-[height] duration-500 ease-out-soft"
        style={{ height: Math.max(tingkat, 1) * TINGGI_TINGKAT, minHeight: TINGGI_TINGKAT }}
        role="img"
        aria-label={`Pohon merge sort, ${kedalaman} tingkat`}
      >
        {langkah.simpul.map((s) =>
          s.status === "tersembunyi" ? null : (
            <Simpul
              key={s.id}
              s={s}
              n={n}
              maks={maks}
              aktif={langkah.aktif === s.id}
              penunjuk={penunjukUntuk(s, menggabung, langkah)}
              redupSebelum={redupUntuk(s, menggabung, langkah)}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Label penunjuk per indeks sel di simpul ini (i/j di anak, k di simpul yang digabung). */
function penunjukUntuk(s: SimpulMerge, g: SimpulMerge | null, l: LangkahMerge): Record<number, string> {
  if (!g) return {};
  const { i, j, k } = l.penunjuk;
  if (s.id === g.kiri && i !== null && i < s.isi.length) return { [i]: "i" };
  if (s.id === g.kanan && j !== null && j < s.isi.length) return { [j]: "j" };
  if (s.id === g.id && k !== null && k < s.isi.length) return { [k]: "k" };
  return {};
}

/** Berapa sel terdepan anak yang sudah diambil ke induk. */
function redupUntuk(s: SimpulMerge, g: SimpulMerge | null, l: LangkahMerge): number {
  if (!g) return 0;
  if (s.id === g.kiri) return l.penunjuk.i ?? 0;
  if (s.id === g.kanan) return l.penunjuk.j ?? 0;
  return 0;
}

function Simpul({
  s,
  n,
  maks,
  aktif,
  penunjuk,
  redupSebelum,
}: {
  s: SimpulMerge;
  n: number;
  maks: number;
  aktif: boolean;
  penunjuk: Record<number, string>;
  redupSebelum: number;
}) {
  const latar =
    s.status === "menggabung"
      ? "bg-blue-500/15 shadow-[inset_0_-2px_0_var(--color-blue-400)]"
      : aktif
        ? "bg-white/[0.08] shadow-[inset_0_-2px_0_var(--color-blue-400)]"
        : "bg-white/[0.04]";
  const pudar = s.status === "dibagi" || s.status === "terpakai";

  return (
    <div
      className="lab-fade-up absolute px-[2px] sm:px-1"
      style={{ left: `${(s.lo / n) * 100}%`, width: `${((s.hi - s.lo + 1) / n) * 100}%`, top: s.tingkat * TINGGI_TINGKAT }}
    >
      <div className={cn("flex h-[88px] items-end gap-px px-px pb-1 pt-4 transition-[background-color,opacity] duration-300", latar, pudar && "opacity-45")}>
        {s.isi.map((b, x) => (
          <Sel key={x} b={b} maks={maks} status={s.status} label={penunjuk[x]} redup={x < redupSebelum} />
        ))}
      </div>
    </div>
  );
}

function Sel({
  b,
  maks,
  status,
  label,
  redup,
}: {
  b: Batang | null;
  maks: number;
  status: SimpulMerge["status"];
  label: string | undefined;
  redup: boolean;
}) {
  const warna = status === "urut" ? "bg-blue-600" : status === "menggabung" ? "bg-blue-300" : "bg-white/[0.2]";
  return (
    <div className={cn("relative flex h-full min-w-0 flex-1 flex-col items-center justify-end transition-opacity duration-300", redup && "opacity-30")}>
      {label && (
        <span key={label} className="lab-pop absolute -top-4 text-[11px] font-bold leading-none text-blue-300">
          {label}
        </span>
      )}
      {b ? (
        <>
          <span className="mb-0.5 text-[10px] font-semibold tabular-nums leading-none text-ink sm:text-xs">{b.nilai}</span>
          <div key={b.id} className={cn("lab-pop w-full", warna)} style={{ height: `${Math.max(6, (b.nilai / maks) * 46)}px` }} />
        </>
      ) : (
        // Slot hasil yang belum terisi.
        <div className="h-[22px] w-full bg-white/[0.06] shadow-[inset_0_0_0_1px_var(--color-blue-400)] opacity-60" />
      )}
    </div>
  );
}
