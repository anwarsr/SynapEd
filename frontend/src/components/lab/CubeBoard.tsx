"use client";
import { useEffect, useRef, useState } from "react";
import {
  cubeDalamKotak,
  cubeKoord,
  cubeLabel,
  cubeOffset,
  type CubeBox,
  type CubeLabState,
  type CubeOp,
  type Koord3,
} from "@/lib/lab/cubeLab";
import { useFlip } from "@/lib/useFlip";
import type { LabBoardProps } from "./labKit";
import JejakPanah, { LabelSel, NomorKunjungan } from "./JejakPanah";
import { urutStabil } from "./urutStabil";
import { kelasFokus, kelasKelompok, kelasPeran, LAB_POINTER_CLASS, LAB_POINTER_LABEL, LAB_TONE_CLASS, LAB_TONE_LABEL } from "./labTone";
import { cn } from "@/lib/cn";

/**
 * Sel netral sedikit tembus pandang: di tampilan kubus, lapisan di belakang
 * samar terlihat menembus lapisan depan — petunjuk kedalaman yang paling murah.
 */
const SEL_NETRAL = " bg-white/[0.1] text-white";

const SUDUT_AWAL = { x: -20, y: 38 };
const BATAS_X = 60;
const BATAS_Y = 78;

const MULAI_CEPAT: { label: string; op: () => CubeOp }[] = [
  { label: "3×3×3 berurutan", op: () => ({ kind: "buat", jumlahLapisan: 3, jumlahBaris: 3, jumlahKolom: 3 }) },
  // Benih diambil saat diklik (event handler), BUKAN saat render.
  {
    label: "2×3×4 acak",
    op: () => ({ kind: "acak", jumlahLapisan: 2, jumlahBaris: 3, jumlahKolom: 4, maks: 9, benih: Date.now() % 100000 }),
  },
  { label: "2×2×2 huruf", op: () => ({ kind: "isiDariTeks", teks: "A B; C D | E F; G H" }) },
];

const jepit = (v: number, batas: number) => Math.min(Math.max(v, -batas), batas);

function kotakDi(boxes: readonly CubeBox[], at: Koord3): CubeBox | undefined {
  return boxes.find((b) => cubeDalamKotak(at, b));
}

/** Tata letak tampilan Lapisan (datar), dalam rem; `--langkah` = sel + celah. */
const DATAR = { pad: 0.75, label: 1.2, kepala: 1.4, pitaKolom: 1, celahBlok: 1 };

/**
 * Kanvas array 3D, dengan dua cara melihat kubus yang sama:
 *
 * - **Kubus** — ruang 3D sungguhan (CSS 3D) yang bisa diputar dengan diseret
 *   atau lewat tombol. Setiap sel adalah anak LANGSUNG ruang 3D itu, dengan
 *   posisi `translate` tiga sumbu yang dihitung dari `[k][i][j]`; bingkai
 *   lapisan hanyalah latar di kedalaman yang sama. Akibatnya saat urutan
 *   lapisan dibalik atau sumbu ditukar, sel benar-benar TERBANG menembus
 *   kubus ke tempat barunya — bukan hilang lalu muncul di lapisan lain.
 * - **Lapisan** — lapisan yang sama dijajarkan datar, mudah dibaca. Sel di
 *   sini juga diposisikan dari koordinatnya, jadi berpindah lapisan pun
 *   meluncur.
 *
 * Di bawah keduanya ada pita MEMORI (urutan row-major + rumus offset),
 * supaya beda "telusur lapisan" (berurutan di memori) dan "telusur pilar"
 * (melompat-lompat) kelihatan, bukan cuma dinarasikan.
 */
export default function CubeBoard({
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
}: LabBoardProps<CubeLabState, Koord3, CubeOp>) {
  const [D, R, C] = state.shape;
  const kosong = D === 0;
  const total = kosong ? 0 : D * R * C;

  const [tampilan, setTampilan] = useState<"kubus" | "lapisan">("kubus");
  const [sudut, setSudut] = useState(SUDUT_AWAL);
  const [renggang, setRenggang] = useState(2);
  const [menyeret, setMenyeret] = useState(false);
  const seret = useRef<{ x: number; y: number; ax: number; ay: number; bergerak: boolean } | null>(null);
  const abaikanKlik = useRef(false);

  const adeganRef = useRef<HTMLDivElement>(null);
  const datarRef = useRef<HTMLDivElement>(null);
  // Pita memori memakai FLIP: urutannya di memori berubah saat sumbu ditukar.
  const pitaRef = useRef<HTMLDivElement>(null);
  useFlip(pitaRef);

  // Lebar papan & ukuran sel (px) untuk menentukan berapa lapisan muat
  // sebaris di tampilan datar. Diukur sejak papan terpasang — bukan saat
  // tampilan datar dibuka — supaya sel tidak meluncur dari tata letak tebakan.
  const akarRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [ukur, setUkur] = useState<{ lebar: number; sel: number } | null>(null);
  useEffect(() => {
    const akar = akarRef.current;
    if (!akar) return;
    const ro = new ResizeObserver(() => {
      setUkur({ lebar: akar.clientWidth - 40, sel: probeRef.current?.offsetWidth ?? 44 });
    });
    ro.observe(akar);
    return () => ro.disconnect();
  }, []);

  const offsetTerpilih = terpilih && !kosong ? cubeOffset(terpilih, state.shape) : null;
  const koordFokus = kosong ? [] : fokus.map((o) => cubeKoord(o, state.shape));
  const lapisanFokus = new Set(koordFokus.map((k) => k[0]));
  const fokusTunggal = koordFokus.length === 1 ? koordFokus[0] : null;

  function renderSel(o: number, translate: string, opacity = 1, datar = false) {
    const at = cubeKoord(o, state.shape);
    const sel = state.cells[o];
    const kotak = kotakDi(state.boxes, at);
    const warnaAsal = kelasKelompok(kelompok, sel.id);
    const penunjuk = state.pointers.filter((p) => p.at[0] === at[0] && p.at[1] === at[1] && p.at[2] === at[2]);
    const difokus = fokus.includes(o);
    const dipilih = o === offsetTerpilih;
    return (
      <button
        key={sel.id}
        data-lab-id={sel.id}
        type="button"
        tabIndex={dipilih || (offsetTerpilih === null && o === 0) ? 0 : -1}
        aria-label={[
          `arr${cubeLabel(at)}`,
          `nilai ${sel.value}`,
          kotak ? LAB_TONE_LABEL[kotak.tone] : null,
          penunjuk.length > 0 ? penunjuk.map((p) => `${LAB_POINTER_LABEL[p.tone]} ${p.name}`).join(", ") : null,
        ]
          .filter(Boolean)
          .join(", ")}
        aria-current={dipilih ? "true" : undefined}
        title={`arr${cubeLabel(at)} · offset ${o}`}
        onClick={() => onPilih(at)}
        className={cn(
          "lab-cell lab-posisi lab-enter t-numeral absolute flex h-[var(--kubus-sel)] w-[var(--kubus-sel)] items-center justify-center",
          datar ? "left-0 top-0" : "left-1/2 top-1/2",
          " tabular-nums",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          // Warna asal mengalahkan sorotan selama transformasi.
          kelasPeran(peran, sel.id) ?? warnaAsal ?? (kotak ? LAB_TONE_CLASS[kotak.tone] : SEL_NETRAL),
          difokus && kelasFokus(fokus.length),
          dipilih && !difokus && "shadow-[inset_0_-3px_0_0_var(--color-white)]",
        )}
        style={
          {
            translate,
            // Gaya `opacity` sebaris mengalahkan kelas, jadi peran "luar"
            // (sel yang sedang tidak dikerjakan) diredupkan di sini.
            opacity: peran?.[sel.id] === "luar" ? 0.3 : opacity,
            margin: datar ? undefined : "calc(var(--kubus-sel) / -2)",
            "--d": `${Math.min(o, 40) * 10}ms`,
            // Huruf mengecil bersama selnya: di ponsel sel kubus 5×5×5 hanya
            // ±24px, dan ukuran tetap memotong angka tiga digit jadi "1…".
            fontSize: "min(0.875rem, calc(var(--kubus-sel) * 0.38))",
          } as React.CSSProperties
        }
      >
        <span key={sel.value} className="lab-pop truncate px-0.5">
          {sel.value}
        </span>
        {penunjuk.length > 0 && (
          <span className="absolute -top-2 -right-2 flex gap-0.5">
            {penunjuk.map((p) => (
              <span key={p.name} className={cn("lab-land rounded-full px-1 py-px text-[9px] font-semibold ", LAB_POINTER_CLASS[p.tone])}>
                {p.name}
              </span>
            ))}
          </span>
        )}
        <NomorKunjungan jalur={jalur} id={sel.id} />
        <LabelSel labelSel={labelSel} id={sel.id} />
      </button>
    );
  }

  // ── Tampilan kubus: posisi 3D setiap sel ───────────────────────────────
  const langkah3 = "(var(--kubus-sel) + var(--kubus-gap))";
  const zLapisan = (k: number) => `calc(${(D - 1) / 2 - k} * var(--kubus-sel) * ${renggang})`;
  const posisi3d = (k: number, i: number, j: number) =>
    `calc(${j - (C - 1) / 2} * ${langkah3}) calc(${i - (R - 1) / 2} * ${langkah3}) ${zLapisan(k)}`;
  const redup = (k: number) => (lapisanFokus.has(k) || terpilih?.[0] === k ? 1 : Math.max(0.62, 1 - k * 0.1));

  // ── Tampilan datar: blok lapisan berjajar, dibungkus sesuai lebar papan ─
  const lebarBlokPx = ukur ? 16 * (DATAR.pad * 2 + DATAR.label) + C * (ukur.sel + 4.8) - 4.8 : 0;
  const perBaris =
    !ukur || kosong ? Math.max(1, Math.min(D, 2)) : Math.max(1, Math.min(D, Math.floor((ukur.lebar + 16) / (lebarBlokPx + 16))));
  const barisBlok = Math.max(1, Math.ceil(D / perBaris));
  const lebarBlok = `(${DATAR.pad * 2 + DATAR.label}rem + ${C} * var(--langkah) - var(--kubus-gap))`;
  const tinggiBlok = `(${DATAR.pad + DATAR.kepala + DATAR.pitaKolom}rem + ${R} * var(--langkah) - var(--kubus-gap))`;
  const asalBlok = (k: number) => {
    const kol = k % perBaris;
    const bar = Math.floor(k / perBaris);
    return {
      x: `(${kol} * (${lebarBlok} + ${DATAR.celahBlok}rem))`,
      y: `(${bar} * (${tinggiBlok} + ${DATAR.celahBlok}rem))`,
    };
  };
  const posisiDatar = (k: number, i: number, j: number) => {
    const b = asalBlok(k);
    return `calc(${b.x} + ${DATAR.pad + DATAR.label}rem + ${j} * var(--langkah)) calc(${b.y} + ${DATAR.kepala + DATAR.pitaKolom}rem + ${i} * var(--langkah))`;
  };

  // ── Seret untuk memutar ──────────────────────────────────────────────────
  // Klik biasa di sel tetap memilih sel; baru dianggap menyeret setelah
  // penunjuk bergerak lebih dari 5px, dan klik yang menutup seretan ditelan.
  function mulaiSeret(e: React.PointerEvent) {
    if (e.button !== 0) return;
    seret.current = { x: e.clientX, y: e.clientY, ax: sudut.x, ay: sudut.y, bergerak: false };
  }
  function lanjutSeret(e: React.PointerEvent<HTMLDivElement>) {
    const s = seret.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.bergerak) {
      if (Math.hypot(dx, dy) < 5) return;
      s.bergerak = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setMenyeret(true);
    }
    setSudut({ x: jepit(s.ax - dy * 0.4, BATAS_X), y: jepit(s.ay + dx * 0.4, BATAS_Y) });
  }
  function akhiriSeret() {
    const s = seret.current;
    seret.current = null;
    if (s?.bergerak) {
      setMenyeret(false);
      abaikanKlik.current = true;
      window.setTimeout(() => {
        abaikanKlik.current = false;
      }, 0);
    }
  }

  const tombolKecil =
    "inline-flex h-8 items-center justify-center   bg-paper-card px-2.5 text-xs font-medium text-ink-body transition-all duration-200 ease-out-soft hover:-translate-y-0.5  hover:text-blue-700";
  const kelasPita = (aktifFokus: boolean, aktifPilih: boolean) =>
    cn(
      "lab-posisi t-numeral absolute flex items-center justify-center rounded text-[10px] tabular-nums",
      aktifFokus ? "bg-blue-600 font-semibold text-white" : aktifPilih ? "bg-ink text-paper" : "text-ink-faint",
    );

  return (
    <div
      ref={akarRef}
      className={cn(
        "lab-board lab-kubus relative flex flex-col   bg-paper-card",
        presentasi ? "min-h-[55vh] rounded-none  px-6 py-10" : "px-5 pt-5 pb-6  lg:min-h-[40vh]",
      )}
      style={presentasi ? ({ "--kubus-sel": "3.4rem", "--kubus-maks": "4.5rem" } as React.CSSProperties) : undefined}
    >
      <span ref={probeRef} aria-hidden="true" className="pointer-events-none invisible absolute h-0 w-[var(--kubus-sel)]" />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <span className="t-label text-ink">Papan</span>
        {!kosong ? (
          <>
            <span className="t-numeral tabular-nums text-ink">
              arr[{D}][{R}][{C}]
            </span>
            <span>
              {D} lapisan × {R} baris × {C} kolom · {total} elemen
            </span>
            {terpilih && offsetTerpilih !== null && state.cells[offsetTerpilih] && (
              <span className="lab-fade-up rounded-full bg-ink px-2 py-0.5 text-paper">
                arr{cubeLabel(terpilih)} = {state.cells[offsetTerpilih].value}
              </span>
            )}
            <span role="group" aria-label="Cara melihat" className="ml-auto flex rounded-full   bg-white/10 p-0.5">
              {(["kubus", "lapisan"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tampilan === t}
                  onClick={() => setTampilan(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all duration-200",
                    tampilan === t ? "bg-blue-600 text-white " : "text-ink-body hover:text-blue-700",
                  )}
                >
                  {t}
                </button>
              ))}
            </span>
          </>
        ) : (
          <span>kosong</span>
        )}
      </div>

      <div className="my-auto py-1">
        {!kosong && tampilan === "kubus" && (
          <div
            className="lab-fade-up"
            // Ukuran sel diturunkan dari lebar papan (`cqw`) supaya kubus 5×5×5
            // tetap utuh di ponsel. Penyebutnya perkiraan lebar proyeksi kubus
            // dalam satuan sel pada sudut ±40°: lebar lapisan + kedalaman yang
            // tampak miring + ruang label. Sengaja TIDAK memakai sudut yang
            // sedang berlaku — kubus yang mengecil-membesar saat diputar
            // terasa seperti zoom, bukan putaran.
            style={
              {
                containerType: "inline-size",
                "--kubus-sel": `min(var(--kubus-maks), calc(100cqw / ${(0.85 * C + 0.65 * (D - 1) * renggang + 1.8).toFixed(2)}))`,
              } as React.CSSProperties
            }
          >
            <div
              ref={adeganRef}
              className="lab-kubus-adegan relative overflow-hidden select-none"
              style={{
                height: `calc(${R} * (var(--kubus-sel) + var(--kubus-gap)) + ${D} * var(--kubus-sel) * ${(renggang * 0.3).toFixed(2)} + 6.5rem)`,
                touchAction: "pan-y",
                cursor: menyeret ? "grabbing" : "grab",
              }}
              onPointerDown={mulaiSeret}
              onPointerMove={lanjutSeret}
              onPointerUp={akhiriSeret}
              onPointerCancel={akhiriSeret}
              onClickCapture={(e) => {
                if (abaikanKlik.current) {
                  e.stopPropagation();
                  e.preventDefault();
                  abaikanKlik.current = false;
                }
              }}
            >
              <div
                className="lab-kubus-badan absolute inset-0"
                data-menyeret={menyeret}
                style={{ transform: `rotateX(${sudut.x}deg) rotateY(${sudut.y}deg)` }}
              >
                {/* Bingkai lapisan: latar di kedalaman lapisannya, sedikit di
                    belakang selnya supaya tidak berebut tempat (z-fighting). */}
                {Array.from({ length: D }, (_, k) => {
                  const aktif = lapisanFokus.has(k) || terpilih?.[0] === k;
                  const lebar = `(${C} * ${langkah3} - var(--kubus-gap) + 1rem)`;
                  const tinggi = `(${R} * ${langkah3} - var(--kubus-gap) + 1rem)`;
                  return (
                    <div
                      key={`l${k}`}
                      className={cn(
                        "lab-bingkai absolute left-1/2 top-1/2 ",
                        aktif ? "bg-blue-500/15" : "bg-white/[0.05]",
                      )}
                      style={{
                        width: `calc${lebar}`,
                        height: `calc${tinggi}`,
                        margin: `calc(${tinggi} / -2) 0 0 calc(${lebar} / -2)`,
                        translate: `0 0 calc(${zLapisan(k)} - 2px)`,
                        opacity: redup(k),
                      }}
                    >
                      <span
                        className={cn(
                          "t-numeral absolute -top-2.5 left-2 rounded-full  px-1.5 py-px text-[10px] tabular-nums",
                          aktif ? " bg-blue-600 text-white" : " bg-chip text-white/70",
                        )}
                        title={`lapisan ${k}`}
                      >
                        [{k}]
                      </span>
                    </div>
                  );
                })}

                {/* Nomor kolom & baris di lapisan paling depan. */}
                {Array.from({ length: C }, (_, j) => (
                  <span
                    key={`c${j}`}
                    aria-hidden="true"
                    className={cn(kelasPita(fokusTunggal?.[2] === j, terpilih?.[2] === j), "left-1/2 top-1/2 h-4 w-[var(--kubus-sel)]")}
                    style={{
                      margin: "-0.5rem 0 0 calc(var(--kubus-sel) / -2)",
                      translate: `calc(${j - (C - 1) / 2} * ${langkah3}) calc(${-(R - 1) / 2} * ${langkah3} - var(--kubus-sel) * 0.5 - 1.1rem) ${zLapisan(0)}`,
                    }}
                  >
                    {j}
                  </span>
                ))}
                {Array.from({ length: R }, (_, i) => (
                  <span
                    key={`r${i}`}
                    aria-hidden="true"
                    className={cn(kelasPita(fokusTunggal?.[1] === i, terpilih?.[1] === i), "left-1/2 top-1/2 h-[var(--kubus-sel)] w-4")}
                    style={{
                      margin: "calc(var(--kubus-sel) / -2) 0 0 -0.5rem",
                      translate: `calc(${-(C - 1) / 2} * ${langkah3} - var(--kubus-sel) * 0.5 - 1.15rem) calc(${i - (R - 1) / 2} * ${langkah3}) ${zLapisan(0)}`,
                    }}
                  >
                    {i}
                  </span>
                ))}

                {urutStabil(
                  state.cells.map((_, o) => {
                    const [k, i, j] = cubeKoord(o, state.shape);
                    return renderSel(o, posisi3d(k, i, j), redup(k));
                  }),
                )}
              </div>
              <JejakPanah wadahRef={adeganRef} jalur={jalur} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={tombolKecil} aria-label="Putar ke kiri" onClick={() => setSudut((s) => ({ ...s, y: jepit(s.y - 20, BATAS_Y) }))}>
                ⟲
              </button>
              <button type="button" className={tombolKecil} aria-label="Putar ke kanan" onClick={() => setSudut((s) => ({ ...s, y: jepit(s.y + 20, BATAS_Y) }))}>
                ⟳
              </button>
              <button type="button" className={tombolKecil} aria-label="Lihat lebih dari atas" onClick={() => setSudut((s) => ({ ...s, x: jepit(s.x - 15, BATAS_X) }))}>
                ↑
              </button>
              <button type="button" className={tombolKecil} aria-label="Lihat lebih dari bawah" onClick={() => setSudut((s) => ({ ...s, x: jepit(s.x + 15, BATAS_X) }))}>
                ↓
              </button>
              <button type="button" className={tombolKecil} onClick={() => setSudut({ x: 0, y: 0 })}>
                Depan
              </button>
              <button type="button" className={tombolKecil} onClick={() => setSudut(SUDUT_AWAL)}>
                Miring
              </button>
              <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
                Renggang
                <input
                  type="range"
                  min={0.4}
                  max={2.6}
                  step={0.1}
                  value={renggang}
                  onChange={(e) => setRenggang(Number(e.target.value))}
                  className="w-24 accent-blue-600"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              Seret kubus untuk memutarnya · lapisan k ke belakang, baris i ke bawah, kolom j ke kanan.
            </p>
          </div>
        )}

        {!kosong && tampilan === "lapisan" && (
          // `pb-4`: wadah gulir mendatar ikut memotong ke arah tegak; tanpa
          // ruang ini cincin fokus sel di baris paling bawah terpangkas.
          <div className="lab-scroller overflow-x-auto scrollbar-hide pb-4">
            <div
              ref={datarRef}
              className="lab-fade-up relative mx-auto mt-3"
              style={
                {
                  "--langkah": "calc(var(--kubus-sel) + var(--kubus-gap))",
                  width: `calc(${perBaris} * (${lebarBlok} + ${DATAR.celahBlok}rem) - ${DATAR.celahBlok}rem)`,
                  height: `calc(${barisBlok} * (${tinggiBlok} + ${DATAR.celahBlok}rem) - ${DATAR.celahBlok}rem)`,
                } as React.CSSProperties
              }
            >
              {Array.from({ length: D }, (_, k) => {
                const aktif = lapisanFokus.has(k) || terpilih?.[0] === k;
                const b = asalBlok(k);
                return (
                  <div
                    key={`l${k}`}
                    className={cn(
                      "lab-bingkai absolute left-0 top-0 ",
                      aktif ? "bg-blue-500/15" : "bg-white/[0.05]",
                    )}
                    style={{ width: `calc${lebarBlok}`, height: `calc${tinggiBlok}`, translate: `calc${b.x} calc${b.y}` }}
                  >
                    <span
                      className={cn(
                        "t-numeral absolute -top-2.5 left-3 rounded-full  px-2 py-0.5 text-[10px] tabular-nums",
                        aktif ? " bg-blue-600 text-white" : " bg-chip text-white/70",
                      )}
                    >
                      arr[{k}]
                    </span>
                  </div>
                );
              })}
              {Array.from({ length: D }, (_, k) =>
                Array.from({ length: C }, (_, j) => {
                  const b = asalBlok(k);
                  return (
                    <span
                      key={`c${k}-${j}`}
                      aria-hidden="true"
                      className={cn(
                        kelasPita(fokusTunggal?.[0] === k && fokusTunggal[2] === j, terpilih?.[0] === k && terpilih[2] === j),
                        "left-0 top-0 h-4 w-[var(--kubus-sel)]",
                      )}
                      style={{ translate: `calc(${b.x} + ${DATAR.pad + DATAR.label}rem + ${j} * var(--langkah)) calc(${b.y} + ${DATAR.kepala - 0.1}rem)` }}
                    >
                      {j}
                    </span>
                  );
                }),
              )}
              {Array.from({ length: D }, (_, k) =>
                Array.from({ length: R }, (_, i) => {
                  const b = asalBlok(k);
                  return (
                    <span
                      key={`r${k}-${i}`}
                      aria-hidden="true"
                      className={cn(
                        kelasPita(fokusTunggal?.[0] === k && fokusTunggal[1] === i, terpilih?.[0] === k && terpilih[1] === i),
                        "left-0 top-0 h-[var(--kubus-sel)] w-4",
                      )}
                      style={{ translate: `calc(${b.x} + ${DATAR.pad}rem) calc(${b.y} + ${DATAR.kepala + DATAR.pitaKolom}rem + ${i} * var(--langkah))` }}
                    >
                      {i}
                    </span>
                  );
                }),
              )}
              {urutStabil(
                state.cells.map((_, o) => {
                  const [k, i, j] = cubeKoord(o, state.shape);
                  return renderSel(o, posisiDatar(k, i, j), 1, true);
                }),
              )}
              <JejakPanah wadahRef={datarRef} jalur={jalur} />
            </div>
          </div>
        )}

        {/* ── Pita memori ──────────────────────────────────── */}
        {!kosong && (
          <div className="mt-5    pt-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-ink-muted">
              <span className="t-label text-ink">Memori</span>
              <span>
                urutan row-major · offset = k×{R * C} + i×{C} + j
              </span>
            </div>
            <div ref={pitaRef} className="flex flex-wrap gap-1">
              {state.cells.map((sel, o) => {
                const at = cubeKoord(o, state.shape);
                const kotak = kotakDi(state.boxes, at);
                const warnaAsal = kelasKelompok(kelompok, sel.id);
                const difokus = fokus.includes(o);
                return (
                  <button
                    key={sel.id}
                    data-lab-id={sel.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => onPilih(at)}
                    title={`offset ${o} · arr${cubeLabel(at)}`}
                    className={cn("lab-cell flex flex-col items-center gap-0.5", at[2] === 0 && at[1] === 0 && o > 0 && "ml-2")}
                  >
                    <span
                      className={cn(
                        "t-numeral flex h-7 w-7 items-center justify-center  text-[11px] tabular-nums transition-colors duration-200",
                        kelasPeran(peran, sel.id) ?? warnaAsal ?? (kotak ? LAB_TONE_CLASS[kotak.tone] : " bg-white/[0.08] text-white"),
                        difokus && kelasFokus(fokus.length),
                        o === offsetTerpilih && !difokus && "shadow-[inset_0_-3px_0_0_var(--color-white)]",
                      )}
                    >
                      {sel.value}
                    </span>
                    <span className="t-numeral text-[9px] tabular-nums text-ink-faint">{o}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {kosong && (
          <div className="lab-fade-up flex flex-col items-center gap-3 text-center">
            <div aria-hidden="true" className="relative h-20 w-24">
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="absolute h-14 w-14 bg-white/[0.06]"
                  style={{ left: `${k * 14}px`, top: `${k * 8}px` }}
                />
              ))}
            </div>
            <p className="max-w-[46ch] text-sm text-ink-muted">
              Kubus masih kosong. Array 3D adalah tumpukan lapisan - mulai dengan salah satu contoh ini:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {MULAI_CEPAT.map((m, i) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => onMulai(m.op())}
                  className="lab-fade-up bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold tracking-[0.02em] text-ink-body transition-colors duration-300 ease-out-soft hover:bg-white/10 hover:text-white hover:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
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
