"use client";
import { useEffect, useRef } from "react";
import type { ArrayLabState, ArrayOp } from "@/lib/lab/arrayLab";
import type { LabRange } from "@/lib/lab/labTypes";
import type { LabBoardProps } from "./labKit";
import {
  kelasFokus,
  kelasKelompok,
  kelasPeran,
  LAB_CELL_NETRAL,
  LAB_PERAN_LABEL,
  LAB_POINTER_CLASS,
  LAB_POINTER_LABEL,
  LAB_TONE_CLASS,
  LAB_TONE_LABEL,
} from "./labTone";
import { urutStabil } from "./urutStabil";
import { cn } from "@/lib/cn";

/**
 * Papan array: lajur penunjuk, pita indeks, deretan sel, dan catatan.
 *
 * Digambar dengan DOM + CSS, bukan SVG. Isi sel adalah teks yang butuh layout
 * dan pemotongan; sel juga harus bisa menjadi tombol sungguhan agar keyboard
 * dan pembaca layar bekerja tanpa diakali.
 *
 * Setiap sel adalah SATU elemen sepanjang umurnya, diposisikan dari indeksnya
 * lewat properti `translate`, dan dirender dalam urutan id (`urutStabil`).
 * Saat dua sel ditukar — puluhan kali dalam satu bubble sort — yang berubah
 * hanya koordinatnya: keduanya meluncur bersilangan, dan sel lain diam. (Versi
 * lama memakai flexbox + FLIP; React memindahkan node DOM-nya dan peramban
 * memutar ulang animasi "muncul" pada sel yang hanya ditukar.)
 *
 * Ukuran sel diterbitkan sebagai `--lab-cell`/`--lab-gap`, jadi penunjuk dan
 * label variabel algoritma bisa bergerak dengan `translateX` murni-CSS.
 */

/** Sorotan yang menyelimuti sebuah indeks, kalau ada. */
function nadaDi(ranges: readonly LabRange[], indeks: number): LabRange | undefined {
  return ranges.find((r) => indeks >= r.from && indeks <= r.to);
}

/** Pilihan mulai cepat di papan kosong — satu klik, bukan mengisi form dulu. */
const MULAI_CEPAT: { label: string; op: () => ArrayOp }[] = [
  { label: "5, 3, 8, 1, 9", op: () => ({ kind: "isiDariTeks", teks: "5, 3, 8, 1, 9" }) },
  // Benih diambil saat diklik (di event handler), BUKAN saat render: nilai
  // acak di jalur render memicu hydration mismatch.
  { label: "8 angka acak", op: () => ({ kind: "acak", panjang: 8, maks: 99, benih: Date.now() % 100000 }) },
  { label: "A sampai F", op: () => ({ kind: "isiDariTeks", teks: "A B C D E F" }) },
];

const posisi = (i: number) => `calc(${i} * (var(--lab-cell) + var(--lab-gap))) 0`;

export default function ArrayBoard({
  state,
  fokus,
  kelompok,
  peran,
  labelSel,
  terpilih,
  onPilih,
  onMulai,
  presentasi = false,
}: LabBoardProps<ArrayLabState, number, ArrayOp>) {
  const n = state.items.length;
  const selRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Sel yang menjadi fokus langkah dibawa ke dalam pandangan. `block: "nearest"`
  // WAJIB: tanpa itu, `html { scroll-behavior: smooth }` ikut menggulir seluruh
  // halaman setiap langkah animasi — sangat mengganggu saat sedang mengajar.
  const fokusKunci = fokus.join(",");
  useEffect(() => {
    const target = fokus[0];
    if (target === undefined) return;
    selRef.current.get(target)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [fokusKunci, fokus]);

  // Label variabel algoritma (j, min, pivot, …) → indeks sel yang ditandainya.
  const indeksId = new Map(state.items.map((it, i) => [it.id, i]));
  const labelVariabel = Object.entries(labelSel ?? {})
    .map(([id, teks]) => ({ teks, i: indeksId.get(Number(id)) }))
    .filter((x): x is { teks: string; i: number } => x.i !== undefined);

  return (
    <div
      className={cn(
        // Papan dibuat setinggi kanvas di layar lebar dan isinya dipusatkan:
        // ia pusat perhatian halaman, bukan satu kartu kecil di antara kartu
        // lain — dan ruang kosong di sekeliling deret sel membuat penunjuk
        // serta sorotannya mudah dibaca dari jauh.
        "lab-board relative flex flex-col   bg-paper-card",
        presentasi ? "min-h-[55vh] rounded-none  px-6 py-10" : "px-5 pt-5 pb-6  lg:min-h-[40vh]",
      )}
      style={presentasi ? ({ "--lab-cell": "5.5rem" } as React.CSSProperties) : undefined}
    >
      {/* Kepala papan: ringkasan yang selalu benar tanpa harus menghitung sel. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="t-label text-ink">Papan</span>
        <span>
          panjang <span className="t-numeral text-ink tabular-nums">{n}</span>
        </span>
        {state.pointers.length > 0 && (
          <span>
            penunjuk{" "}
            {state.pointers.map((p) => (
              <span key={p.name} className="ml-1 t-numeral tabular-nums text-ink">
                {p.name}={p.index}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="my-auto py-2">
        <div className="lab-scroller overflow-x-auto scrollbar-hide">
          {/* `w-max` + `mx-auto`: dipusatkan selama muat, dan saat deretnya lebih
              panjang dari papan, margin otomatis jatuh ke 0 sehingga guliran
              dimulai dari indeks 0 — bukan dari tengah yang memotong kedua ujung.
              `pb-4`: wadah gulir mendatar ikut memotong ke arah tegak, dan cincin
              fokus, denyut, serta bayangan sel menonjol beberapa piksel di luar
              sel — tanpa ruang ini bagian bawahnya terpangkas. */}
          <div className="mx-auto w-max px-2 pt-1 pb-4">
            {/* ── Lajur variabel algoritma (hanya selama pengurutan) ── */}
            {peran && (
              <div className="relative h-9" aria-hidden="true">
                {labelVariabel.map(({ teks, i }) => (
                  <span
                    key={`v-${teks}`}
                    className="lab-pointer absolute top-0 flex w-[var(--lab-cell)] flex-col items-center"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <span className="bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-500">
                      {teks}
                    </span>
                    <span className="mt-0.5 text-[10px] leading-none text-amber-700">▼</span>
                  </span>
                ))}
              </div>
            )}

            {/* ── Lajur penunjuk ─────────────────────────────── */}
            <div className="relative h-12">
              {state.pointers.map((p) => (
                <span
                  key={p.name}
                  className="lab-pointer absolute top-0 flex w-[var(--lab-cell)] flex-col items-center"
                  style={{ "--i": p.index } as React.CSSProperties}
                >
                  {/* Kunci berganti setiap indeks berganti, jadi chip ini
                      dipasang ulang dan memantul sekali saat mendarat. Pembungkus
                      luarnya tetap - dialah yang meluncur dengan translateX. */}
                  <span
                    key={p.index}
                    className={cn(
                      "lab-land rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ",
                      LAB_POINTER_CLASS[p.tone],
                    )}
                  >
                    {p.name}
                  </span>
                  <span aria-hidden="true" className="mt-0.5 h-3.5 w-0.5 rounded-full bg-blue-500/60" />
                </span>
              ))}
            </div>

            {/* ── Pita indeks ────────────────────────────────── */}
            <div className="flex gap-[var(--lab-gap)]">
              {Array.from({ length: n + 1 }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={cn(
                    "t-numeral flex h-6 w-[var(--lab-cell)] shrink-0 items-center justify-center",
                    "text-[11px] tabular-nums transition-colors duration-200",
                    i === n
                      ? "text-ink-faint"
                      : i === terpilih
                        ? "bg-ink text-paper"
                        : "bg-white/15 text-white-muted",
                  )}
                >
                  {i}
                </span>
              ))}
            </div>

            {/* ── Sel: satu elemen per id, posisi dari indeks ── */}
            <div
              className="relative mt-2 h-[var(--lab-cell)]"
              style={{ width: `calc(${n + 1} * (var(--lab-cell) + var(--lab-gap)) - var(--lab-gap))` }}
            >
              {urutStabil(
                state.items.map((item, i) => {
                  const rentang = nadaDi(state.ranges, i);
                  const penunjuk = state.pointers.filter((p) => p.index === i);
                  const r = peran?.[item.id];
                  const keterangan = [
                    `Indeks ${i}`,
                    `nilai ${item.value}`,
                    r ? LAB_PERAN_LABEL[r] : rentang ? LAB_TONE_LABEL[rentang.tone] : null,
                    penunjuk.length > 0
                      ? penunjuk.map((p) => `${LAB_POINTER_LABEL[p.tone]} ${p.name} di sini`).join(", ")
                      : null,
                    item.note ? `catatan: ${item.note}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  const difokus = fokus.includes(i);

                  return (
                    <button
                      key={item.id}
                      data-lab-id={item.id}
                      ref={(el) => {
                        if (el) selRef.current.set(i, el);
                        else selRef.current.delete(i);
                      }}
                      type="button"
                      // Roving tabindex: satu perhentian Tab untuk seluruh papan.
                      // Tanpa ini, array 24 elemen memakan 24 kali Tab sebelum
                      // pengguna keyboard sampai ke panel operasi.
                      tabIndex={i === (terpilih ?? 0) ? 0 : -1}
                      aria-label={keterangan}
                      aria-current={i === terpilih ? "true" : undefined}
                      onClick={() => onPilih(i)}
                      className={cn(
                        "lab-cell lab-posisi lab-enter t-numeral absolute left-0 top-0 flex h-[var(--lab-cell)] w-[var(--lab-cell)]",
                        "items-center justify-center  text-lg tabular-nums lg:text-xl",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        "focus-visible:ring-offset-2 focus-visible:ring-offset-paper-card",
                        kelasPeran(peran, item.id) ??
                          kelasKelompok(kelompok, item.id) ??
                          (rentang ? LAB_TONE_CLASS[rentang.tone] : LAB_CELL_NETRAL),
                        difokus && kelasFokus(fokus.length),
                        i === terpilih && !difokus && !r && "shadow-[inset_0_-3px_0_0_var(--color-white)]",
                      )}
                      // Masuk bertingkat saat papan pertama kali terisi; sel yang
                      // ditambah belakangan hanya satu, jadi jedanya tak terasa.
                      style={{ translate: posisi(i), "--d": `${Math.min(i, 12) * 35}ms` } as React.CSSProperties}
                    >
                      {/* Kunci = nilai: saat nilainya berubah, span ini dipasang
                          ulang dan berdenyut sekali. */}
                      <span key={item.value} className="lab-pop truncate px-1">
                        {item.value}
                      </span>
                    </button>
                  );
                }),
              )}

              {/* Slot "lepas" di indeks n. Justru posisi inilah yang menjelaskan
                  kenapa `i < n` berhenti di sana - jadi ia digambar. */}
              <span
                aria-hidden="true"
                className={cn(
                  "lab-posisi absolute left-0 top-0 flex h-[var(--lab-cell)] w-[var(--lab-cell)] items-center justify-center",
                  "bg-white/[0.06] text-xs italic text-ink-faint",
                )}
                style={{ translate: posisi(n) }}
              >
                n
              </span>
            </div>

            {/* ── Catatan: ikut selnya, jadi ikut meluncur ────── */}
            {state.items.some((i) => i.note) && (
              <div className="relative mt-2 h-4">
                {urutStabil(
                  state.items.map((item, i) => (
                    <span
                      key={item.id}
                      className="lab-posisi absolute left-0 top-0 w-[var(--lab-cell)] truncate text-center text-[11px] text-ink-muted"
                      style={{ translate: posisi(i) }}
                      title={item.note ?? undefined}
                    >
                      {item.note ?? ""}
                    </span>
                  )),
                )}
              </div>
            )}
          </div>
        </div>

        {n === 0 && (
          <div className="lab-fade-up mt-8 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-ink-muted">Papan masih kosong. Mulai dengan salah satu contoh ini:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {MULAI_CEPAT.map((m, i) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => onMulai(m.op())}
                  className={cn(
                    "lab-fade-up rounded-full   bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700",
                    "transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-100 hover:",
                  )}
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
