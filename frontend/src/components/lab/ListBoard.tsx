"use client";
import { useEffect, useId, useRef, useState } from "react";
import { alamatSimpul, labelAlamat, urutanList, type ListLabState, type ListOp } from "@/lib/lab/listLab";
import type { LabBoardProps } from "./labKit";
import { NomorKunjungan } from "./JejakPanah";
import { kelasPeran, LAB_PERAN_LABEL } from "./labTone";
import { urutStabil } from "./urutStabil";
import { cn } from "@/lib/cn";

/**
 * Ukuran gambar (px, sebelum diskalakan): lebar simpul & bagian next-nya,
 * tinggi simpul, celah antarsimpul (tempat panah), tinggi baris, dan titik
 * awal rantai (sesudah pointer head).
 */
const W = 100;
const NEXT_W = 40;
const DATA_W = W - NEXT_W;
const H = 58;
const G = 42;
const BARIS = 150;
/** Pointer head = satu kotak pointer, selebar bagian next sebuah simpul. */
const HEAD_W = NEXT_W + 4;
const X0 = 10 + HEAD_W + 34;
const Y0 = 70;

/** Sel netral simpul (data); bagian next diberi latar sendiri di dalamnya. */
const SIMPUL_NETRAL = "border-ink/70 bg-paper-card text-ink";

const MULAI_CEPAT: { label: string; op: () => ListOp }[] = [
  { label: "3 → 8 → 1 → 5", op: () => ({ kind: "isiDariTeks", teks: "3 8 1 5" }) },
  // Benih diambil saat diklik (event handler), BUKAN saat render.
  { label: "5 angka acak", op: () => ({ kind: "acak", panjang: 5, maks: 99, benih: Date.now() % 100000 }) },
  { label: "A → B → C", op: () => ({ kind: "isiDariTeks", teks: "A B C" }) },
];

type Titik = { x: number; y: number };

const f = (t: Titik) => `${t.x.toFixed(1)} ${t.y.toFixed(1)}`;

/**
 * Lengkung panah dari titik `a` ke `b`. SELALU satu perintah `M … C …` dengan
 * jumlah angka yang sama, supaya peramban bisa menganimasikan perubahan
 * bentuknya (transisi properti CSS `d`): panah yang dibelokkan terlihat
 * berbelok, bukan hilang lalu muncul di tempat lain.
 */
function lengkung(a: Titik, b: Titik): string {
  const maju = b.x > a.x + 8;
  // Toleransi lebar: titik tujuan panah ke belakang (bawah simpul) lebih
  // rendah dari titik asal, tapi tetap "sebaris" — dengan toleransi sempit,
  // panah itu dianggap beda baris dan menembus simpul lurus.
  const sebaris = Math.abs(a.y - b.y) < BARIS / 2;
  let c1: Titik;
  let c2: Titik;
  if (sebaris && maju) {
    c1 = { x: a.x + (b.x - a.x) * 0.4, y: a.y };
    c2 = { x: b.x - (b.x - a.x) * 0.4, y: b.y };
  } else if (sebaris) {
    // Panah yang menunjuk ke belakang (saat list dibalik) melengkung di bawah rantai.
    c1 = { x: a.x + 30, y: a.y + 92 };
    c2 = { x: b.x, y: b.y + 70 };
  } else {
    c1 = { x: a.x + 60, y: a.y };
    c2 = { x: b.x - 60, y: b.y };
  }
  return `M ${f(a)} C ${f(c1)}, ${f(c2)}, ${f(b)}`;
}

/**
 * Panah yang "mengerut" ke titik asalnya — bentuk saat pointer null. Semua
 * titik kendalinya di titik asal, jadi panah yang menjadi null menyusut lurus
 * ke titiknya, tidak mengayun melengkung lebih dulu.
 */
const kerut = (a: Titik) => `M ${f(a)} C ${f(a)}, ${f(a)}, ${f(a)}`;

/** Garis miring di kotak pointer null — lambang null yang lazim di buku teks. */
function CoretNull() {
  return (
    <svg aria-hidden="true" className="absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)]" viewBox="0 0 10 10" preserveAspectRatio="none">
      <line x1="0.5" y1="9.5" x2="9.5" y2="0.5" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke" opacity="0.55" />
    </svg>
  );
}

/**
 * Kanvas linked list (singly).
 *
 * Simpul = kartu `[data | next]`; `head` digambar dengan bentuk yang sama
 * (`[head | ●]`) karena ia juga sebuah pointer. Setiap panah keluar TEPAT dari
 * bulatan pointer-nya dan berakhir di tengah sisi kiri simpul tujuan, jadi
 * rantai yang lurus benar-benar lurus. Pointer null digambar dengan coretan
 * miring di kotaknya. Indeks dan alamat memori ditulis di bawah kartu, supaya
 * kartunya bersih dan ruang di atasnya bebas untuk variabel `cur`/`prev`/….
 *
 * Simpul diposisikan dari letaknya di rantai (atau dari `posisiSimpul`
 * langkah itu) lewat `translate`, dalam urutan DOM yang tetap — simpul yang
 * naik masuk rantai atau turun keluar rantai meluncur, simpul lain diam.
 * Panah dan variabel dikunci menurut identitasnya (id simpul asal, nama
 * variabel), jadi pointer yang berubah terlihat BERBELOK dan chip MELUNCUR.
 *
 * Gambar dibuat dalam piksel tetap lalu diskalakan agar muat lebar papan; di
 * layar sangat sempit skalanya berhenti di batas bawah dan papan bisa
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
  const lebar = X0 + maksKolom * (W + G) + 40;
  const tinggi = Y0 + maksBaris * BARIS + H + 110;

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
  // Di bawah 0,72 tulisan alamat terlalu kecil untuk dibaca; lebih baik digulir.
  const skala = presentasi ? 1.15 : lebarTersedia === null ? 1 : Math.max(0.72, Math.min(1, lebarTersedia / lebar));

  // ── Variabel penunjuk: ditumpuk bila menunjuk simpul yang sama ──────────
  const tumpukan = new Map<string, number>();
  const chipVariabel = (variabel ?? []).map((v) => {
    const kunci = v.id === null ? "null" : String(v.id);
    const ke = tumpukan.get(kunci) ?? 0;
    tumpukan.set(kunci, ke + 1);
    const p = v.id === null ? slotNull : xy(v.id);
    const bawah = v.id !== null && (posisi.get(v.id)?.baris ?? 0) > 0;
    // Simpul di baris bawah: chip di bawahnya, melewati label indeks/alamat.
    return { nama: v.nama, x: p.x, y: bawah ? p.y + H + 30 + ke * 26 : p.y - 36 - ke * 26, bawah };
  });

  // Pusat isi bagian next yang SEBENARNYA: kartu bergaris tepi 2px dan bagian
  // next punya garis kiri 2px — tanpa memperhitungkannya, pangkal panah meleset
  // dari tengah kotak.
  const titikPointer = (x: number, y: number) => ({ x: x + W - 2 - (NEXT_W - 2) / 2, y: y + H / 2 });
  const headPos = { x: 10, y: Y0 };
  const headTitik = { x: headPos.x + HEAD_W / 2, y: Y0 + H / 2 };
  const masuk = (t: { x: number; y: number }) => ({ x: t.x - 2, y: t.y + H / 2 });

  const panah = (asal: Titik, tujuan: Titik | null, mundur: boolean) =>
    tujuan === null ? kerut(asal) : mundur ? lengkung(asal, { x: tujuan.x + DATA_W / 2, y: tujuan.y + H + 2 }) : lengkung(asal, masuk(tujuan));

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
              {/* ── Pointer head: kotak pointer yang sama dengan bagian next, berlabel di atasnya ── */}
              <span
                className="absolute text-center text-xs font-bold uppercase tracking-wider text-ink"
                style={{ left: headPos.x - 10, top: headPos.y - 22, width: HEAD_W + 20 }}
              >
                head
              </span>
              <div
                className="absolute flex items-center justify-center rounded-xl border-2 border-ink bg-paper-alt text-ink shadow-soft"
                style={{ left: headPos.x, top: headPos.y, width: HEAD_W, height: H }}
              >
                {/* Bulatan pointer digambar oleh panahnya sendiri (penanda pangkal). */}
                {state.head === null && <CoretNull />}
              </div>
              <span
                className="t-numeral absolute text-center text-[11px] tabular-nums text-ink-muted"
                style={{ left: headPos.x - 20, top: headPos.y + H + 6, width: HEAD_W + 40 }}
              >
                {state.head === null ? "null" : labelAlamat(state.head)}
              </span>

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
                      // flex + justify-start: <button> bawaannya memusatkan isi secara
                      // tegak, yang menggeser kartu dari posisi hitungan panah.
                      className="group lab-posisi lab-enter absolute left-0 top-0 flex flex-col items-stretch justify-start focus-visible:outline-none"
                      style={{ width: W, height: H + 22, translate: `${p.x}px ${p.y}px` } as React.CSSProperties}
                    >
                      <span className="relative block" style={{ width: W, height: H }}>
                      <span
                        className={cn(
                          "flex h-full w-full overflow-hidden rounded-xl border-2 shadow-soft transition-[background-color,border-color,box-shadow] duration-300",
                          "group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-blue-500",
                          kelasPeran(peran, x.id) ?? SIMPUL_NETRAL,
                          k === terpilih && !r && "ring-2 ring-ink ring-offset-2 ring-offset-paper-card",
                        )}
                      >
                        <span className="flex flex-1 items-center justify-center">
                          <span key={x.value} className="lab-pop t-numeral text-[22px] leading-none tabular-nums">
                            {x.value}
                          </span>
                        </span>
                        {/* Bagian next: latar sedikit berbeda, bulatan pointer tepat di tengahnya. */}
                        <span className="relative flex h-full items-center justify-center border-l-2 border-current/25 bg-current/[0.06]" style={{ width: NEXT_W }}>
                          <span className="absolute left-0 right-0 top-1 text-center text-[8px] font-semibold uppercase tracking-wider opacity-55">next</span>
                          {x.next === null && <CoretNull />}
                        </span>
                      </span>
                      <NomorKunjungan jalur={jalur} id={x.id} />
                      </span>
                      {/* Indeks di rantai & alamat memori, di bawah kartu. */}
                      <span className="t-numeral mt-1.5 block text-center text-[11px] tabular-nums text-ink-muted">
                        {/* Simpul yang (sementara) tidak tercapai dari head — mis. saat list
                            dibalik — tidak punya indeks; alamatnya saja yang ditampilkan. */}
                        {lepasDariRantai ? "" : `[${k}] · `}@{alamatSimpul(x.id)}
                      </span>
                    </button>
                  );
                }),
              )}

              {/* ── Panah: digambar DI ATAS simpul, jadi terlihat keluar dari bulatan pointer ── */}
              <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={lebar} height={tinggi}>
                <defs>
                  <marker id={idPanah} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                    <path d="M0,0.8 L9,5 L0,9.2 z" fill="var(--color-ink)" />
                  </marker>
                  {/* Bulatan pointer = penanda PANGKAL panah. Dengan begitu bulatan dan
                      garisnya satu benda: selalu menyatu tepat, juga saat simpul
                      meluncur dan panahnya berubah bentuk. Pointer null tidak
                      punya bulatan — panahnya transparan, kotaknya dicoret. */}
                  <marker id={`${idPanah}-titik`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
                    <circle cx="5" cy="5" r="4.2" fill="var(--color-ink)" />
                  </marker>
                </defs>
                <path
                  className="lab-panah"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  markerEnd={`url(#${idPanah})`}
                  markerStart={`url(#${idPanah}-titik)`}
                  style={
                    {
                      d: `path("${panah(headTitik, state.head === null ? null : xy(state.head), false)}")`,
                      opacity: state.head === null ? 0 : 1,
                    } as React.CSSProperties
                  }
                />
                {urutStabil(
                  state.nodes.map((x) => {
                    const a = xy(x.id);
                    const asal = titikPointer(a.x, a.y);
                    const tujuan = x.next === null || !peta.has(x.next) ? null : xy(x.next);
                    const mundur = tujuan !== null && tujuan.y === a.y && tujuan.x < a.x;
                    return (
                      <path
                        key={x.id}
                        className="lab-panah"
                        fill="none"
                        stroke="var(--color-ink)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        markerEnd={`url(#${idPanah})`}
                        markerStart={`url(#${idPanah}-titik)`}
                        style={{ d: `path("${panah(asal, tujuan, mundur)}")`, opacity: tujuan === null ? 0 : 1 } as React.CSSProperties}
                      />
                    );
                  }),
                )}
              </svg>

              {/* ── Variabel penunjuk ─────────────────────── */}
              {chipVariabel.map((c) => (
                <span
                  key={`v-${c.nama}`}
                  aria-hidden="true"
                  className="lab-posisi pointer-events-none absolute left-0 top-0 flex flex-col items-center"
                  style={{ width: W, translate: `${c.x}px ${c.y}px` } as React.CSSProperties}
                >
                  {c.bawah && <span className="h-2.5 w-0.5 rounded-full bg-amber-500" />}
                  <span key={c.nama} className="lab-land rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-500">
                    {c.nama}
                  </span>
                  {!c.bawah && <span className="h-2.5 w-0.5 rounded-full bg-amber-500" />}
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
                  className="lab-fade-up bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold tracking-[0.02em] text-ink-body transition-colors duration-300 ease-out-soft hover:bg-white/10 hover:text-white hover:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
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
