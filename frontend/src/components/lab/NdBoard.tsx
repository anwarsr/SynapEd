"use client";
import { useRef } from "react";
import {
  ndKoordinat,
  ndLabelBentuk,
  ndLabelIndeks,
  ndStrides,
  ndTotal,
  type NdLabState,
  type NdOp,
  type NdSlice,
} from "@/lib/lab/ndLab";
import { useFlip } from "@/lib/useFlip";
import type { LabBoardProps } from "./labKit";
import JejakPanah, { LabelSel, NomorKunjungan } from "./JejakPanah";
import { urutStabil } from "./urutStabil";
import { kelasFokus, kelasKelompok, kelasPeran, LAB_CELL_NETRAL, LAB_TONE_CLASS, LAB_TONE_LABEL } from "./labTone";
import { cn } from "@/lib/cn";

/**
 * Warna label `[k]` per sumbu, berputar kalau dimensinya lebih banyak. Setiap
 * sumbu punya warnanya sendiri supaya `arr[1][2][0]` bisa dibaca dengan
 * menelusuri label berwarna dari kotak terluar ke dalam.
 */
const WARNA_SUMBU = [
  " bg-blue-500/20 text-blue-200",
  " bg-amber-500/25 text-warn-text",
  " bg-[#E0795A]/25 text-error-text",
  " bg-white/15 text-white",
  " bg-blue-500/35 text-white",
  " bg-white/10 text-white",
] as const;

const warnaSumbu = (sumbu: number) => WARNA_SUMBU[sumbu % WARNA_SUMBU.length];

const MULAI_CEPAT: { label: string; op: NdOp }[] = [
  { label: "3D · 2×3×4", op: { kind: "buat", bentuk: "2, 3, 4" } },
  { label: "4D · 2×2×2×3", op: { kind: "buat", bentuk: "2, 2, 2, 3" } },
  { label: "2D · 3×4", op: { kind: "buat", bentuk: "3, 4" } },
];

function irisanDi(slices: readonly NdSlice[], koordinat: readonly number[]): NdSlice | undefined {
  return slices.find((s) => koordinat[s.axis] === s.index);
}

// ---------------------------------------------------------------------------
// Tata letak kotak bersarang, dalam satuan "satu sel"
// ---------------------------------------------------------------------------

/** Celah antar sel, lebar label baris, padding kotak, ruang label kotak, celah antar kotak. */
const G = 0.14;
const LB = 0.8;
const P = 0.3;
const PT = 0.62;
const BG = 0.4;

interface SelTata {
  o: number;
  x: number;
  y: number;
}
interface KotakTata {
  kunci: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sumbu: number;
  k: number;
  awalan: number[];
}
interface Tata {
  w: number;
  h: number;
  sel: SelTata[];
  kotak: KotakTata[];
  label: KotakTata[];
}

function geser(t: Tata, dx: number, dy: number): Tata {
  return {
    w: t.w,
    h: t.h,
    sel: t.sel.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy })),
    kotak: t.kotak.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
    label: t.label.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
  };
}

/**
 * Posisi setiap sel, kotak, dan label untuk sebuah bentuk. Sumbu terakhir =
 * deret sel mendatar; sumbu sebelumnya = deret bertumpuk dengan label `[k]`;
 * sumbu yang lebih luar = kotak berbingkai, bergantian berjajar ke samping
 * dan bertumpuk ke bawah.
 *
 * Dihitung sebagai ANGKA (bukan diserahkan ke flexbox) supaya setiap sel
 * bisa diposisikan langsung lewat `translate`: reshape dan tukar sumbu lalu
 * cukup mengubah koordinat, dan selnya meluncur ke kotak barunya — elemennya
 * tidak dibuat ulang, jadi tidak ada sel yang "muncul lagi" padahal hanya
 * berpindah.
 */
function tataLetak(shape: readonly number[], strides: readonly number[], sumbu: number, basis: number, awalan: number[]): Tata {
  const dims = shape.length;
  if (sumbu === dims - 1) {
    const n = shape[sumbu];
    return {
      w: n + (n - 1) * G,
      h: 1,
      sel: Array.from({ length: n }, (_, j) => ({ o: basis + j, x: j * (1 + G), y: 0 })),
      kotak: [],
      label: [],
    };
  }

  const anak = Array.from({ length: shape[sumbu] }, (_, k) =>
    tataLetak(shape, strides, sumbu + 1, basis + k * strides[sumbu], [...awalan, k]),
  );
  const hasil: Tata = { w: 0, h: 0, sel: [], kotak: [], label: [] };
  const tambah = (t: Tata) => {
    hasil.sel.push(...t.sel);
    hasil.kotak.push(...t.kotak);
    hasil.label.push(...t.label);
  };

  const jarak = dims - 1 - sumbu;
  if (jarak === 1) {
    // Deret-deret di dalam satu kisi 2D: label di kiri, tanpa bingkai.
    let y = 0;
    anak.forEach((t, k) => {
      hasil.label.push({ kunci: [...awalan, k].join("-"), x: 0, y, w: LB, h: 1, sumbu, k, awalan: [...awalan, k] });
      tambah(geser(t, LB + G, y));
      y += t.h + G;
    });
    hasil.w = LB + G + anak[0].w;
    hasil.h = y - G;
    return hasil;
  }

  // Jarak genap → kotak berjajar ke samping; ganjil → bertumpuk ke bawah.
  const vertikal = jarak % 2 === 1;
  let pos = 0;
  let lintang = 0;
  anak.forEach((t, k) => {
    const fw = t.w + 2 * P;
    const fh = t.h + PT + P;
    const x = vertikal ? 0 : pos;
    const y = vertikal ? pos : 0;
    hasil.kotak.push({ kunci: [...awalan, k].join("-"), x, y, w: fw, h: fh, sumbu, k, awalan: [...awalan, k] });
    tambah(geser(t, x + P, y + PT));
    pos += (vertikal ? fh : fw) + BG;
    lintang = Math.max(lintang, vertikal ? fw : fh);
  });
  hasil.w = vertikal ? lintang : pos - BG;
  hasil.h = vertikal ? pos - BG : lintang;
  return hasil;
}

/** Awalan koordinat yang sama pada SEMUA sel fokus — kotak mana yang sedang dimasuki. */
function awalanBersama(koordinat: readonly number[][]): number[] | null {
  if (koordinat.length === 0) return null;
  const hasil: number[] = [];
  for (let k = 0; k < koordinat[0].length; k++) {
    const v = koordinat[0][k];
    if (!koordinat.every((c) => c[k] === v)) break;
    hasil.push(v);
  }
  return hasil;
}

const u = (n: number) => `calc(var(--lab-cell) * ${n.toFixed(3)})`;

/**
 * Kanvas array N-dimensi.
 *
 * Digambar sebagai kotak bersarang: `arr[1][2][0]` dibaca persis seperti
 * alamatnya — masuk kotak `[1]`, lalu deret `[2]`, lalu sel `[0]`. Kotak yang
 * sedang dimasuki langkah animasi menyala, dari luar ke dalam.
 *
 * Di bawahnya ada pita MEMORI — elemen yang sama dalam urutan row-major,
 * lengkap dengan offset-nya. Di sanalah terlihat bahwa reshape tidak
 * memindahkan apa pun di memori (pita diam, kotaknya yang berubah), sementara
 * tukar sumbu menyusun ulang deretnya (pita ikut bergeser).
 */
export default function NdBoard({
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
}: LabBoardProps<NdLabState, number[], NdOp>) {
  const { shape, cells, cursor, slices } = state;
  const dims = shape.length;
  const total = ndTotal(shape);
  const strides = ndStrides(shape);
  const wadahRef = useRef<HTMLDivElement>(null);
  const pitaRef = useRef<HTMLDivElement>(null);
  useFlip(pitaRef);

  const tata = dims > 0 ? tataLetak(shape, strides, 0, 0, []) : null;

  // Kotak yang menyala: awalan bersama sel-sel fokus langkah ini (mis. hanya
  // `[1]` saat langkah "masuk kotak [1]"), atau kursor kalau tidak ada fokus.
  const koordFokus = total > 0 ? fokus.map((o) => ndKoordinat(o, shape)) : [];
  const jalurAktif = awalanBersama(koordFokus) ?? cursor;
  const menyala = (awalan: readonly number[]) =>
    jalurAktif !== null && awalan.length <= jalurAktif.length && awalan.every((v, k) => jalurAktif[k] === v);

  const offsetKursor = cursor ? cursor.reduce((n, v, k) => n + v * strides[k], 0) : null;
  const offsetTerpilih = terpilih ? terpilih.reduce((n, v, k) => n + v * strides[k], 0) : null;

  function kelasSel(offset: number, id: number, koordinat: readonly number[]) {
    const irisan = irisanDi(slices, koordinat);
    const difokus = fokus.includes(offset);
    return cn(
      kelasPeran(peran, id) ?? kelasKelompok(kelompok, id) ?? (irisan ? LAB_TONE_CLASS[irisan.tone] : LAB_CELL_NETRAL),
      difokus && kelasFokus(fokus.length),
      offset === offsetKursor && !difokus && "ring-2 ring-blue-500/50",
      offset === offsetTerpilih && !difokus && offset !== offsetKursor && "shadow-[inset_0_-3px_0_0_var(--color-white)]",
    );
  }

  return (
    <div
      className={cn(
        "lab-board relative flex flex-col   bg-paper-card",
        presentasi ? "min-h-[55vh] rounded-none  px-6 py-10" : "px-5 pt-5 pb-6  lg:min-h-[40vh]",
      )}
      style={{ "--lab-cell": presentasi ? "3.5rem" : "2.6rem" } as React.CSSProperties}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="t-label text-ink">Papan</span>
        {dims > 0 ? (
          <>
            <span className="t-numeral tabular-nums text-ink">arr{ndLabelBentuk(shape)}</span>
            <span>
              {dims} dimensi · {total} elemen
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {shape.map((n, k) => (
                <span key={k} className={cn("rounded-full  px-2 py-px text-[10px]", warnaSumbu(k))}>
                  sumbu {k}: {n}
                </span>
              ))}
            </span>
            {cursor && (
              <span className="lab-fade-up rounded-full bg-blue-600 px-2 py-0.5 text-white">kursor arr{ndLabelIndeks(cursor)}</span>
            )}
            {terpilih && offsetTerpilih !== null && cells[offsetTerpilih] && (
              <span className="lab-fade-up rounded-full bg-ink px-2 py-0.5 text-paper">
                arr{ndLabelIndeks(terpilih)} = {cells[offsetTerpilih].value}
              </span>
            )}
          </>
        ) : (
          <span>kosong</span>
        )}
      </div>

      <div className="my-auto py-2">
        {tata && (
          <>
            <div className="lab-scroller overflow-x-auto scrollbar-hide">
              <div
                ref={wadahRef}
                className="lab-bingkai relative mx-auto mt-2"
                style={{ width: u(tata.w + 0.3), height: u(tata.h + 0.3) }}
              >
                {tata.kotak.map((b) => (
                  <div
                    key={`b${b.kunci}`}
                    className={cn(
                      "lab-bingkai absolute left-0 top-0 ",
                      menyala(b.awalan) ? "bg-blue-500/15" : "bg-white/[0.05]",
                    )}
                    style={{ width: u(b.w), height: u(b.h), translate: `${u(b.x)} ${u(b.y)}` }}
                  >
                    <span
                      className={cn("t-numeral absolute -top-2.5 left-3 rounded-full  px-2 py-0.5 text-[10px] tabular-nums", warnaSumbu(b.sumbu))}
                      title={`sumbu ${b.sumbu}`}
                    >
                      [{b.k}]
                    </span>
                  </div>
                ))}

                {tata.label.map((l) => (
                  <span
                    key={`l${l.kunci}`}
                    className={cn(
                      "lab-posisi t-numeral absolute left-0 top-0 flex items-center justify-center  text-[10px] tabular-nums",
                      warnaSumbu(l.sumbu),
                      menyala(l.awalan) ? "scale-110 " : "opacity-80",
                    )}
                    style={{ width: u(l.w), height: u(1), translate: `${u(l.x)} ${u(l.y)}` }}
                    title={`sumbu ${l.sumbu}`}
                  >
                    [{l.k}]
                  </span>
                ))}

                {urutStabil(tata.sel.map(({ o, x, y }) => {
                  const koordinat = ndKoordinat(o, shape);
                  const sel = cells[o];
                  const irisan = irisanDi(slices, koordinat);
                  return (
                    <button
                      key={sel.id}
                      data-lab-id={sel.id}
                      type="button"
                      tabIndex={o === (offsetTerpilih ?? 0) ? 0 : -1}
                      aria-label={[
                        `arr${ndLabelIndeks(koordinat)}`,
                        `nilai ${sel.value}`,
                        `offset ${o}`,
                        irisan ? LAB_TONE_LABEL[irisan.tone] : null,
                        o === offsetKursor ? "kursor di sini" : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      title={`arr${ndLabelIndeks(koordinat)} · offset ${o}`}
                      onClick={() => onPilih(koordinat)}
                      className={cn(
                        "lab-cell lab-posisi lab-enter t-numeral absolute left-0 top-0 flex h-[var(--lab-cell)] w-[var(--lab-cell)]",
                        "items-center justify-center  text-sm tabular-nums",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        kelasSel(o, sel.id, koordinat),
                      )}
                      style={{ translate: `${u(x)} ${u(y)}`, "--d": `${Math.min(o, 30) * 12}ms` } as React.CSSProperties}
                    >
                      <span key={sel.value} className="lab-pop truncate px-0.5">
                        {sel.value}
                      </span>
                      <NomorKunjungan jalur={jalur} id={sel.id} />
                      <LabelSel labelSel={labelSel} id={sel.id} />
                    </button>
                  );
                }))}

                <JejakPanah wadahRef={wadahRef} jalur={jalur} />
              </div>
            </div>

            {/* ── Pita memori ──────────────────────────────────── */}
            <div className="mt-5    pt-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-ink-muted">
                <span className="t-label text-ink">Memori</span>
                <span>
                  urutan row-major · langkah alamat{" "}
                  <span className="t-numeral tabular-nums text-ink">{strides.join(" · ")}</span>
                </span>
              </div>
              <div ref={pitaRef} className="flex flex-wrap gap-1">
                {cells.map((sel, offset) => {
                  const koordinat = ndKoordinat(offset, shape);
                  return (
                    <button
                      key={sel.id}
                      data-lab-id={sel.id}
                      type="button"
                      tabIndex={-1}
                      onClick={() => onPilih(koordinat)}
                      title={`offset ${offset} · arr${ndLabelIndeks(koordinat)}`}
                      className="lab-cell flex flex-col items-center gap-0.5"
                    >
                      <span
                        className={cn(
                          "t-numeral flex h-7 w-7 items-center justify-center  text-[11px] tabular-nums transition-colors duration-200",
                          kelasSel(offset, sel.id, koordinat),
                        )}
                      >
                        {sel.value}
                      </span>
                      <span className="t-numeral text-[9px] tabular-nums text-ink-faint">{offset}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {dims === 0 && (
          <div className="lab-fade-up flex flex-col items-center gap-3 text-center">
            <div aria-hidden="true" className="flex gap-2 opacity-60">
              {[0, 1].map((b) => (
                <div key={b} className="grid grid-cols-2 gap-1 bg-white/[0.06] p-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="h-5 w-5 bg-white/[0.06]" />
                  ))}
                </div>
              ))}
            </div>
            <p className="max-w-[46ch] text-sm text-ink-muted">
              Buat array dengan berapa pun dimensinya - tulis panjang tiap dimensi di panel kanan, atau mulai dari contoh:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {MULAI_CEPAT.map((m, i) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => onMulai(m.op)}
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
