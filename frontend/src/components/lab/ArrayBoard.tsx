"use client";
import { useEffect, useRef } from "react";
import type { ArrayLabState, ArrayOp } from "@/lib/lab/arrayLab";
import type { LabRange } from "@/lib/lab/labTypes";
import { useFlip } from "@/lib/useFlip";
import type { LabBoardProps } from "./labKit";
import {
  LAB_CELL_NETRAL,
  LAB_POINTER_CLASS,
  LAB_POINTER_LABEL,
  LAB_TONE_CLASS,
  LAB_TONE_LABEL,
} from "./labTone";
import { cn } from "@/lib/cn";

/**
 * Papan array: pita indeks, deretan sel, penunjuk, dan catatan.
 *
 * Digambar dengan DOM + CSS, bukan SVG. Isi sel adalah teks yang butuh layout
 * dan pemotongan; sel juga harus bisa menjadi tombol sungguhan agar keyboard
 * dan pembaca layar bekerja tanpa diakali. Yang hilang dari SVG — garis
 * penghubung bebas untuk linked list atau pohon — belum dibutuhkan array, dan
 * nanti bisa ditumpuk sebagai lapisan absolut di atas papan yang sama.
 *
 * Ukuran sel diterbitkan sebagai variabel CSS `--lab-cell`/`--lab-gap` supaya
 * penunjuk bisa bergerak dengan satu `translateX` murni-CSS.
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

export default function ArrayBoard({
  state,
  fokus,
  terpilih,
  onPilih,
  onMulai,
  presentasi = false,
}: LabBoardProps<ArrayLabState, number, ArrayOp>) {
  const n = state.items.length;
  const barisRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Sel yang bertukar tempat meluncur dari posisi lamanya (lihat useFlip).
  useFlip(barisRef);

  // Sel yang menjadi fokus langkah dibawa ke dalam pandangan. `block: "nearest"`
  // WAJIB: tanpa itu, `html { scroll-behavior: smooth }` ikut menggulir seluruh
  // halaman setiap langkah animasi — sangat mengganggu saat sedang mengajar.
  const fokusKunci = fokus.join(",");
  useEffect(() => {
    const target = fokus[0];
    if (target === undefined) return;
    selRef.current[target]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [fokusKunci, fokus]);

  return (
    <div
      className={cn(
        // Papan dibuat setinggi kanvas di layar lebar dan isinya dipusatkan:
        // ia pusat perhatian halaman, bukan satu kartu kecil di antara kartu
        // lain — dan ruang kosong di sekeliling deret sel membuat penunjuk
        // serta sorotannya mudah dibaca dari jauh.
        "lab-board relative flex flex-col border border-rule bg-paper-card",
        presentasi ? "min-h-[55vh] rounded-none border-0 px-6 py-10" : "rounded-3xl px-5 pt-5 pb-6 shadow-soft lg:min-h-[40vh]",
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
              dimulai dari indeks 0 — bukan dari tengah yang memotong kedua ujung. */}
          <div className="mx-auto w-max px-2">
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
                      luarnya tetap — dialah yang meluncur dengan translateX. */}
                  <span
                    key={p.index}
                    className={cn(
                      "lab-land rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums shadow-soft",
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
                    "rounded-md text-[11px] tabular-nums transition-colors duration-200",
                    i === n
                      ? "text-ink-faint"
                      : i === terpilih
                        ? "bg-ink text-paper"
                        : "bg-paper-alt text-ink-muted",
                  )}
                >
                  {i}
                </span>
              ))}
            </div>

            {/* ── Sel ────────────────────────────────────────── */}
            <div ref={barisRef} className="mt-2 flex gap-[var(--lab-gap)]">
              {state.items.map((item, i) => {
                const rentang = nadaDi(state.ranges, i);
                const penunjuk = state.pointers.filter((p) => p.index === i);
                const keterangan = [
                  `Indeks ${i}`,
                  `nilai ${item.value}`,
                  rentang ? LAB_TONE_LABEL[rentang.tone] : null,
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
                      selRef.current[i] = el;
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
                      "lab-cell lab-enter t-numeral relative flex h-[var(--lab-cell)] w-[var(--lab-cell)] shrink-0",
                      "items-center justify-center rounded-xl border-2 text-lg tabular-nums lg:text-xl",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      "focus-visible:ring-offset-2 focus-visible:ring-offset-paper-card",
                      rentang ? LAB_TONE_CLASS[rentang.tone] : LAB_CELL_NETRAL,
                      difokus && "lab-glow border-blue-500",
                      i === terpilih && !difokus && "border-ink",
                    )}
                    // Masuk bertingkat saat papan pertama kali terisi; sel yang
                    // ditambah belakangan hanya satu, jadi jedanya tak terasa.
                    style={{ "--d": `${Math.min(i, 12) * 35}ms` } as React.CSSProperties}
                  >
                    {/* Kunci = nilai: saat nilainya berubah, span ini dipasang
                        ulang dan berdenyut sekali. */}
                    <span key={item.value} className="lab-pop truncate px-1">
                      {item.value}
                    </span>
                  </button>
                );
              })}

              {/* Slot "lepas" di indeks n. Justru posisi inilah yang menjelaskan
                  kenapa `i < n` berhenti di sana — jadi ia digambar. */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-[var(--lab-cell)] w-[var(--lab-cell)] shrink-0 items-center justify-center",
                  "rounded-xl border-2 border-dashed border-rule-strong text-xs italic text-ink-faint",
                )}
              >
                n
              </span>
            </div>

            {/* ── Catatan ────────────────────────────────────── */}
            {state.items.some((i) => i.note) && (
              <div className="mt-2 flex gap-[var(--lab-gap)]">
                {state.items.map((item) => (
                  <span
                    key={item.id}
                    className="w-[var(--lab-cell)] shrink-0 truncate text-center text-[11px] text-ink-muted"
                    title={item.note ?? undefined}
                  >
                    {item.note ?? ""}
                  </span>
                ))}
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
                    "lab-fade-up rounded-full border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700",
                    "transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-soft",
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
