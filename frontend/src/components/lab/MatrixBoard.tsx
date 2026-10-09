"use client";
import { useEffect, useRef } from "react";
import { matrixCols, type MatrixLabState, type MatrixOp, type MatrixRange } from "@/lib/lab/matrixLab";
import type { LabBoardProps } from "./labKit";
import JejakPanah, { LabelSel, NomorKunjungan } from "./JejakPanah";
import { urutStabil } from "./urutStabil";
import {
  kelasFokus,
  kelasKelompok,
  kelasPeran,
  LAB_CELL_NETRAL,
  LAB_POINTER_CLASS,
  LAB_POINTER_LABEL,
  LAB_TONE_CLASS,
  LAB_TONE_LABEL,
} from "./labTone";
import { cn } from "@/lib/cn";

/** Sel terpilih di kisi 2D. */
export interface SelMatriks {
  baris: number;
  kolom: number;
}

function sorotanDi(ranges: readonly MatrixRange[], r: number, c: number): MatrixRange | undefined {
  return ranges.find((x) => r >= x.r1 && r <= x.r2 && c >= x.c1 && c <= x.c2);
}

const MULAI_CEPAT: { label: string; op: () => MatrixOp }[] = [
  { label: "3×3 berurutan", op: () => ({ kind: "isiDariTeks", teks: "1 2 3; 4 5 6; 7 8 9" }) },
  // Benih diambil saat diklik (event handler), BUKAN saat render.
  { label: "4×5 acak", op: () => ({ kind: "acak", jumlahBaris: 4, jumlahKolom: 5, maks: 9, benih: Date.now() % 100000 }) },
  { label: "2×4 huruf", op: () => ({ kind: "isiDariTeks", teks: "A B C D; E F G H" }) },
];

/** Posisi pojok kiri-atas sel `[r][c]` di dalam wadah (pita label ada di kiri & atas). */
const posisi = (r: number, c: number) =>
  `calc(var(--x0) + ${c} * var(--langkah)) calc(var(--y0) + ${r} * var(--langkah))`;

/**
 * Kanvas array 2D.
 *
 * Setiap sel adalah SATU elemen yang hidup sepanjang umurnya; posisinya
 * dihitung dari `[i][j]` dan ditulis ke properti `translate`. Saat transpose,
 * putar, atau balik memindahkan sel, yang terjadi hanyalah koordinatnya
 * berubah — selnya meluncur ke tempat baru, dan sel yang tidak berpindah
 * diam sepenuhnya. (Versi lama menaruh sel di dalam elemen baris; sel yang
 * pindah baris dibuat ulang React dan memutar ulang animasi "muncul", sehingga
 * sel yang hanya berpindah tampak seperti sel baru.)
 *
 * Pita nomor baris di kiri dan nomor kolom di atas menyala mengikuti sel yang
 * sedang dibahas (biru) dan sel terpilih (hitam), supaya pasangan `[i][j]`
 * terbaca tanpa menghitung.
 */
export default function MatrixBoard({
  state,
  fokus,
  kelompok,
  jalur,
  peran,
  labelSel,
  terpilih,
  onPilih,
  onMulai,
  presentasi = false,
}: LabBoardProps<MatrixLabState, SelMatriks, MatrixOp>) {
  const R = state.rows.length;
  const C = matrixCols(state);
  const wadahRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Sel fokus dibawa ke pandangan tanpa menggulir halaman (`block: "nearest"`).
  const fokusKunci = fokus.join(",");
  useEffect(() => {
    const target = fokus[0];
    if (target === undefined) return;
    selRef.current.get(target)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [fokusKunci, fokus]);

  const nilaiTerpilih = terpilih && R > 0 ? state.rows[terpilih.baris]?.[terpilih.kolom]?.value : undefined;
  // Sel tunggal yang sedang dibahas langkah ini → nomor baris & kolomnya menyala.
  const fokusTunggal = fokus.length === 1 && C > 0 ? { r: Math.floor(fokus[0] / C), c: fokus[0] % C } : null;

  const kelasLabel = (aktifFokus: boolean, aktifPilih: boolean) =>
    cn(
      "lab-posisi t-numeral absolute left-0 top-0 flex items-center justify-center text-[11px] tabular-nums",
      aktifFokus ? "bg-blue-600 font-semibold text-white" : aktifPilih ? "bg-ink text-paper" : "bg-white/15 text-white-muted",
    );

  return (
    <div
      className={cn(
        "lab-board relative flex flex-col   bg-paper-card",
        presentasi ? "min-h-[55vh] rounded-none  px-6 py-10" : "px-5 pt-5 pb-6  lg:min-h-[40vh]",
      )}
      style={presentasi ? ({ "--lab-cell": "4.75rem" } as React.CSSProperties) : undefined}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="t-label text-ink">Papan</span>
        <span className="t-numeral tabular-nums text-ink">
          arr[{R}][{C}]
        </span>
        <span>
          {R} baris × {C} kolom · {R * C} elemen
        </span>
        {terpilih && nilaiTerpilih !== undefined && (
          <span className="lab-fade-up rounded-full bg-ink px-2 py-0.5 text-paper">
            arr[{terpilih.baris}][{terpilih.kolom}] = {nilaiTerpilih}
          </span>
        )}
      </div>

      <div className="my-auto py-2">
        {R > 0 && (
          <div className="lab-scroller overflow-x-auto scrollbar-hide">
            <div
              ref={wadahRef}
              className="relative mx-auto"
              style={
                {
                  "--x0": "3rem",
                  "--y0": "2rem",
                  "--langkah": "calc(var(--lab-cell) + var(--lab-gap))",
                  width: `calc(var(--x0) + ${C} * var(--langkah) - var(--lab-gap) + 0.75rem)`,
                  height: `calc(var(--y0) + ${R} * var(--langkah) - var(--lab-gap) + 0.75rem)`,
                } as React.CSSProperties
              }
            >
              {/* ── Pita nomor kolom (j) ──────────────────────── */}
              {Array.from({ length: C }, (_, c) => (
                <span
                  key={`c${c}`}
                  aria-hidden="true"
                  className={cn(kelasLabel(fokusTunggal?.c === c, terpilih?.kolom === c), "h-6 w-[var(--lab-cell)]")}
                  style={{ translate: `calc(var(--x0) + ${c} * var(--langkah)) 0` }}
                >
                  {c}
                </span>
              ))}

              {/* ── Pita nomor baris (i) ──────────────────────── */}
              {Array.from({ length: R }, (_, r) => (
                <span
                  key={`r${r}`}
                  aria-hidden="true"
                  className={cn(kelasLabel(fokusTunggal?.r === r, terpilih?.baris === r), "h-[var(--lab-cell)] w-10")}
                  style={{ translate: `0 calc(var(--y0) + ${r} * var(--langkah))` }}
                >
                  [{r}]
                </span>
              ))}

              {/* ── Sel: satu elemen per id, posisi dari [i][j] ── */}
              {urutStabil(state.rows.flatMap((row, r) =>
                row.map((sel, c) => {
                  const datar = r * C + c;
                  const sorot = sorotanDi(state.ranges, r, c);
                  const warnaAsal = kelasKelompok(kelompok, sel.id);
                  const penunjuk = state.pointers.filter((p) => p.row === r && p.col === c);
                  const difokus = fokus.includes(datar);
                  const dipilih = terpilih?.baris === r && terpilih.kolom === c;
                  const keterangan = [
                    `arr[${r}][${c}]`,
                    `nilai ${sel.value}`,
                    sorot ? LAB_TONE_LABEL[sorot.tone] : null,
                    penunjuk.length > 0 ? penunjuk.map((p) => `${LAB_POINTER_LABEL[p.tone]} ${p.name}`).join(", ") : null,
                    sel.note ? `catatan: ${sel.note}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <button
                      key={sel.id}
                      data-lab-id={sel.id}
                      ref={(el) => {
                        if (el) selRef.current.set(datar, el);
                        else selRef.current.delete(datar);
                      }}
                      type="button"
                      tabIndex={dipilih || (!terpilih && datar === 0) ? 0 : -1}
                      aria-label={keterangan}
                      aria-current={dipilih ? "true" : undefined}
                      onClick={() => onPilih({ baris: r, kolom: c })}
                      className={cn(
                        "lab-cell lab-posisi lab-enter t-numeral absolute left-0 top-0 flex h-[var(--lab-cell)] w-[var(--lab-cell)]",
                        "items-center justify-center  text-lg tabular-nums",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-card",
                        // Warna asal mengalahkan sorotan: selama transformasi,
                        // yang perlu diikuti mata adalah ASAL setiap sel.
                        kelasPeran(peran, sel.id) ?? warnaAsal ?? (sorot ? LAB_TONE_CLASS[sorot.tone] : LAB_CELL_NETRAL),
                        difokus && kelasFokus(fokus.length),
                        dipilih && !difokus && "shadow-[inset_0_-3px_0_0_var(--color-white)]",
                        difokus && "z-10",
                      )}
                      style={
                        {
                          translate: posisi(r, c),
                          "--d": `${Math.min(datar, 24) * 18}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <span key={sel.value} className="lab-pop truncate px-1">
                        {sel.value}
                      </span>

                      {penunjuk.length > 0 && (
                        <span className="absolute -top-2 -right-2 flex gap-0.5">
                          {penunjuk.map((p) => (
                            <span
                              key={p.name}
                              className={cn("lab-land rounded-full px-1.5 py-px text-[10px] font-semibold ", LAB_POINTER_CLASS[p.tone])}
                            >
                              {p.name}
                            </span>
                          ))}
                        </span>
                      )}

                      {sel.note && (
                        <span className="absolute inset-x-1 bottom-0.5 truncate text-center text-[9px] leading-none text-ink-muted">
                          {sel.note}
                        </span>
                      )}

                      <NomorKunjungan jalur={jalur} id={sel.id} />
                      <LabelSel labelSel={labelSel} id={sel.id} />
                    </button>
                  );
                }),
              ))}

              <JejakPanah wadahRef={wadahRef} jalur={jalur} />
            </div>
          </div>
        )}

        {R === 0 && (
          <div className="lab-fade-up flex flex-col items-center gap-3 text-center">
            <div aria-hidden="true" className="grid grid-cols-3 gap-1.5 opacity-60">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="h-8 w-8 bg-white/[0.06]" />
              ))}
            </div>
            <p className="text-sm text-ink-muted">Kisi masih kosong. Mulai dengan salah satu contoh ini:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {MULAI_CEPAT.map((m, i) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => onMulai(m.op())}
                  className="lab-fade-up rounded-full   bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-100 hover:"
                  style={{ "--d": `${120 + i * 70}ms` } as React.CSSProperties}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
