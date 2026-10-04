"use client";
import { useEffect, useId, useRef, useState } from "react";
import { alamatSimpul, labelAlamat, urutanList, type ListLabState, type ListOp } from "@/lib/lab/listLab";
import type { LabBoardProps } from "./labKit";
import { NomorKunjungan } from "./JejakPanah";
import { kelasPeran, LAB_CELL_NETRAL, LAB_PERAN_LABEL } from "./labTone";
import { urutStabil } from "./urutStabil";
import { cn } from "@/lib/cn";

/** Ukuran gambar (px, sebelum diskalakan): simpul, celah panah, tinggi baris, ruang kepala. */
const W = 108;
const NEXT_W = 44;
const H = 58;
const G = 54;
const BARIS = 124;
const X0 = 100;
const Y0 = 92;

const MULAI_CEPAT: { label: string; op: () => ListOp }[] = [
  { label: "3 → 8 → 1 → 5", op: () => ({ kind: "isiDariTeks", teks: "3 8 1 5" }) },
  // Benih diambil saat diklik (event handler), BUKAN saat render.
  { label: "5 angka acak", op: () => ({ kind: "acak", panjang: 5, maks: 99, benih: Date.now() % 100000 }) },
  { label: "A → B → C", op: () => ({ kind: "isiDariTeks", teks: "A B C" }) },
];

type Titik = { x: number; y: number };

/**
 * Lengkung panah dari titik `a` ke `b`. SELALU satu perintah `M … C …` dengan
 * jumlah angka yang sama, supaya peramban bisa menganimasikan perubahan
 * bentuknya (transisi properti CSS `d`): panah yang dibelokkan terlihat
 * berbelok, bukan hilang lalu muncul di tempat lain.
 */
function lengkung(a: Titik, b: Titik): string {
  const maju = b.x > a.x + 8;
  // Toleransi lebar: titik asal (bulatan di kotak next) sedikit lebih rendah
  // dari titik tujuan (tengah sisi kiri simpul). Dengan toleransi sempit, panah
  // yang menunjuk ke belakang dianggap "beda baris" dan menembus simpul lurus.
  const sebaris = Math.abs(a.y - b.y) < BARIS / 2;
  let c1: Titik;
  let c2: Titik;
  if (sebaris && maju) {
    c1 = { x: a.x + (b.x - a.x) * 0.45, y: a.y };
    c2 = { x: b.x - (b.x - a.x) * 0.45, y: b.y };
  } else if (sebaris) {
    // Panah yang menunjuk ke belakang (saat list dibalik) melengkung di bawah rantai.
    c1 = { x: a.x + 46, y: a.y + 84 };
    c2 = { x: b.x - 46, y: b.y + 84 };
  } else {
    c1 = { x: a.x + 56, y: a.y };
    c2 = { x: b.x - 56, y: b.y };
  }
  const f = (t: Titik) => `${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
  return `M ${f(a)} C ${f(c1)}, ${f(c2)}, ${f(b)}`;
}

/**
 * Panah yang "mengerut" ke titik asalnya — bentuk saat pointer null. Semua
 * titik kendalinya di titik asal, jadi panah yang menjadi null menyusut lurus
 * ke kotak next-nya, tidak mengayun melengkung lebih dulu.
 */
const kerut = (a: Titik) => {
  const f = `${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
  return `M ${f} C ${f}, ${f}, ${f}`;
};

/**
 * Kanvas linked list (singly).
 *
 * Setiap simpul digambar `[nilai | next]` dengan alamat memorinya, dan
 * disambung panah dari kotak `next` ke simpul yang ditunjuknya. Simpul
 * diposisikan dari letaknya di rantai (atau dari `posisiSimpul` langkah itu)
 * lewat `translate`, dalam urutan DOM yang tetap — simpul yang naik masuk
 * rantai atau turun keluar rantai meluncur, simpul lain diam.
 *
 * Panah dan variabel penunjuk (`cur`, `prev`, `baru`, …) dikunci menurut
 * identitasnya (id simpul asal, nama variabel), jadi saat pointer berubah
 * yang terlihat adalah panah yang BERBELOK dan chip yang MELUNCUR.
 *
 * Gambar dibuat dalam piksel tetap lalu diskalakan agar muat lebar papan;
 * di layar sangat sempit skalanya berhenti di batas bawah dan papan bisa
 * digulir ke samping, supaya tulisannya tidak menjadi terlalu kecil.
 */
export default function ListBoard({
  state,
  peran,
  jalur,
  variabel,
  posisiSimpul,
  terpilih,
  onPilih,
  onMulai,
  presentasi = false,
}: LabBoardProps<ListLabState, number, ListOp>) {
  const urut = urutanList(state);
  const n = urut.length;
  const peta = new Map(state.nodes.map((x) => [x.id, x]));
  const idPanah = `panah${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // ── Letak simpul ────────────────────────────────────────────────────────
  const posisi = new Map<number, { kolom: number; baris: number }>();
  urut.forEach((id, k) => posisi.set(id, { kolom: k, baris: 0 }));
  if (posisiSimpul) for (const [id, p] of Object.entries(posisiSimpul)) posisi.set(Number(id), p);
  let lepas = 0;
  for (const x of state.nodes) if (!posisi.has(x.id)) posisi.set(x.id, { kolom: n + lepas++, baris: 1 });
  const xy = (id: number) => {
    const p = posisi.get(id)!;
    return { x: X0 + p.kolom * (W + G), y: Y0 + p.baris * BARIS };
  };

  // Kotak "null" untuk variabel yang bernilai null: tepat sesudah ekor.
  const slotNull = { x: X0 + n * (W + G), y: Y0 };
  const adaNull = (variabel ?? []).some((v) => v.id === null);
  const maksKolom = Math.max(n, ...[...posisi.values()].map((p) => p.kolom + 1));
  const maksBaris = Math.max(0, ...[...posisi.values()].map((p) => p.baris));
  const lebar = X0 + maksKolom * (W + G) + 70;
  const tinggi = Y0 + maksBaris * BARIS + H + 70;

  // ── Skala agar muat ─────────────────────────────────────────────────────
  const wadahRef = useRef<HTMLDivElement>(null);
  const [lebarTersedia, setLebarTersedia] = useState<number | null>(null);
  useEffect(() => {
    const el = wadahRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLebarTersedia(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const skala = presentasi ? 1.15 : lebarTersedia === null ? 1 : Math.max(0.6, Math.min(1, lebarTersedia / lebar));

  // ── Variabel penunjuk: ditumpuk bila menunjuk simpul yang sama ──────────
  const tumpukan = new Map<string, number>();
  const chipVariabel = (variabel ?? []).map((v) => {
    const kunci = v.id === null ? "null" : String(v.id);
    const ke = tumpukan.get(kunci) ?? 0;
    tumpukan.set(kunci, ke + 1);
    const p = v.id === null ? slotNull : xy(v.id);
    const bawah = v.id !== null && (posisi.get(v.id)?.baris ?? 0) > 0;
    return { nama: v.nama, x: p.x, y: bawah ? p.y + H + 10 + ke * 26 : p.y - 34 - ke * 26, bawah };
  });

  const headTitik = { x: 16 + 64, y: Y0 + H / 2 };

  return (
    <div
      className={cn(
        "lab-board relative flex flex-col border border-rule bg-paper-card",
        presentasi ? "min-h-[55vh] rounded-none border-0 px-6 py-10" : "rounded-3xl px-5 pt-5 pb-6 shadow-soft lg:min-h-[40vh]",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="t-label text-ink">Papan</span>
        {/* Jumlah SIMPUL, bukan panjang rantai dari head: di tengah operasi
            (mis. saat list dibalik) rantai dari head sementara lebih pendek. */}
        <span>
          simpul <span className="t-numeral tabular-nums text-ink">{state.nodes.length}</span>
        </span>
        <span>
          head = <span className="t-numeral tabular-nums text-ink">{labelAlamat(state.head)}</span>
        </span>
        {terpilih !== null && urut[terpilih] !== undefined && (
          <span className="lab-fade-up rounded-full bg-ink px-2 py-0.5 text-paper">
            simpul {terpilih} = {peta.get(urut[terpilih])!.value}
          </span>
        )}
      </div>

      <div className="my-auto py-1">
        <div ref={wadahRef} className="lab-scroller overflow-x-auto scrollbar-hide">
          <div className="relative mx-auto" style={{ width: lebar * skala, height: tinggi * skala }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: lebar, height: tinggi, transform: `scale(${skala})` }}>
              {/* ── Kotak head ─────────────────────────────── */}
              <div
                className="absolute flex h-[30px] w-16 items-center justify-center rounded-lg border-2 border-ink bg-ink text-xs font-semibold text-paper"
                style={{ left: 16, top: Y0 + H / 2 - 15 }}
              >
                head
              </div>
              {state.head === null && (
                <span className="absolute text-xs text-ink-muted" style={{ left: 88, top: Y0 + H / 2 - 9 }}>
                  = null (list kosong)
                </span>
              )}

              {/* ── Panah ─────────────────────────────────── */}
              <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={lebar} height={tinggi}>
                <defs>
                  <marker id={idPanah} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="var(--color-ink)" />
                  </marker>
                </defs>
                <path
                  className="lab-panah"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth={2.5}
                  markerEnd={`url(#${idPanah})`}
                  style={
                    {
                      d: `path("${state.head === null ? kerut(headTitik) : lengkung(headTitik, { x: xy(state.head).x - 3, y: xy(state.head).y + H / 2 })}")`,
                      opacity: state.head === null ? 0 : 1,
                    } as React.CSSProperties
                  }
                />
                {urutStabil(
                  state.nodes.map((x) => {
                    const a = xy(x.id);
                    const asal = { x: a.x + W - NEXT_W / 2, y: a.y + H / 2 + 6 };
                    const tujuan = x.next === null || !peta.has(x.next) ? null : xy(x.next);
                    return (
                      <path
                        key={x.id}
                        className="lab-panah"
                        fill="none"
                        stroke="var(--color-ink)"
                        strokeWidth={2.5}
                        markerEnd={`url(#${idPanah})`}
                        style={
                          {
                            d: `path("${
                              tujuan === null
                                ? kerut(asal)
                                : tujuan.y === a.y && tujuan.x < a.x
                                  ? // Menunjuk ke belakang (list dibalik): masuk dari BAWAH simpul,
                                    // supaya tidak bertumpuk dengan panah head di sisi kirinya.
                                    lengkung(asal, { x: tujuan.x + 34, y: tujuan.y + H + 3 })
                                  : lengkung(asal, { x: tujuan.x - 3, y: tujuan.y + H / 2 })
                            }")`,
                            opacity: tujuan === null ? 0 : 1,
                          } as React.CSSProperties
                        }
                      />
                    );
                  }),
                )}
              </svg>

              {/* ── Kotak null untuk variabel yang null ───── */}
              {adaNull && (
                <div
                  className="lab-fade-up absolute flex items-center justify-center rounded-xl border-2 border-dashed border-rule-strong text-xs italic text-ink-faint"
                  style={{ left: slotNull.x, top: slotNull.y, width: 64, height: H }}
                >
                  null
                </div>
              )}

              {/* ── Simpul ────────────────────────────────── */}
              {urutStabil(
                state.nodes.map((x) => {
                  const p = xy(x.id);
                  const k = urut.indexOf(x.id);
                  const lepasDariRantai = k < 0;
                  const r = peran?.[x.id];
                  return (
                    <button
                      key={x.id}
                      data-lab-id={x.id}
                      type="button"
                      tabIndex={k === (terpilih ?? 0) ? 0 : -1}
                      aria-label={[
                        lepasDariRantai ? "simpul lepas dari rantai" : `simpul ${k}`,
                        `nilai ${x.value}`,
                        `alamat ${labelAlamat(x.id)}`,
                        `next ${labelAlamat(x.next)}`,
                        r ? LAB_PERAN_LABEL[r] : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      onClick={() => k >= 0 && onPilih(k)}
                      className={cn(
                        "lab-cell lab-posisi lab-enter absolute left-0 top-0 flex overflow-visible rounded-xl border-2",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        kelasPeran(peran, x.id) ?? LAB_CELL_NETRAL,
                        k === terpilih && !r && "border-ink",
                      )}
                      style={{ width: W, height: H, translate: `${p.x}px ${p.y}px` } as React.CSSProperties}
                    >
                      <span className="flex h-full flex-1 flex-col items-center justify-center">
                        <span className="t-numeral text-[9px] leading-none tabular-nums opacity-70">@{alamatSimpul(x.id)}</span>
                        <span key={x.value} className="lab-pop t-numeral mt-0.5 text-lg leading-none tabular-nums">
                          {x.value}
                        </span>
                      </span>
                      <span
                        className="flex h-full flex-col items-center justify-start border-l-2 border-current/30 pt-1.5"
                        style={{ width: NEXT_W }}
                      >
                        <span className="t-numeral text-[9px] leading-none tabular-nums opacity-70">next</span>
                        {x.next === null ? (
                          <span className="mt-1.5 text-[10px] italic opacity-80">null</span>
                        ) : (
                          <span aria-hidden="true" className="mt-2 h-2 w-2 rounded-full bg-current" />
                        )}
                      </span>
                      <NomorKunjungan jalur={jalur} id={x.id} />
                    </button>
                  );
                }),
              )}

              {/* ── Variabel penunjuk ─────────────────────── */}
              {chipVariabel.map((c) => (
                <span
                  key={`v-${c.nama}`}
                  aria-hidden="true"
                  className="lab-posisi pointer-events-none absolute left-0 top-0 flex flex-col items-center"
                  style={{ width: W, translate: `${c.x}px ${c.y}px` } as React.CSSProperties}
                >
                  {c.bawah && <span className="text-[10px] leading-none text-amber-700">▲</span>}
                  <span key={c.nama} className="lab-land rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-500">
                    {c.nama}
                  </span>
                  {!c.bawah && <span className="text-[10px] leading-none text-amber-700">▼</span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {n === 0 && state.nodes.length === 0 && (
          <div className="lab-fade-up mt-2 flex flex-col items-center gap-3 text-center">
            <p className="max-w-[46ch] text-sm text-ink-muted">
              List masih kosong — head menunjuk null. Tambah simpul lewat panel kanan, atau mulai dari contoh:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {MULAI_CEPAT.map((m, i) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => onMulai(m.op())}
                  className="lab-fade-up rounded-full border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-soft"
                  style={{ "--d": `${120 + i * 70}ms` } as React.CSSProperties}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Memori: simpul diurutkan menurut alamat ──────── */}
        {state.nodes.length > 0 && (
          <div className="mt-4 border-t border-dashed border-rule pt-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-ink-muted">
              <span className="t-label text-ink">Memori</span>
              <span>diurutkan menurut alamat — simpul tersebar, tidak berderet seperti array</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...state.nodes]
                .sort((a, b) => alamatSimpul(a.id) - alamatSimpul(b.id))
                .map((x) => (
                  <span
                    key={x.id}
                    className={cn(
                      "t-numeral flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] tabular-nums transition-colors duration-300",
                      kelasPeran(peran, x.id) ?? "border-rule bg-paper text-ink-body",
                    )}
                  >
                    <span className="opacity-70">@{alamatSimpul(x.id)}</span>
                    <span className="font-semibold">{x.value}</span>
                    <span className="opacity-70">→ {labelAlamat(x.next)}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
