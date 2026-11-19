"use client";
import type { LabBoardProps } from "../labKit";
import type { StackLabState, StackOp } from "@/lib/lab/stackLab";
import { BarisVariabel, JudulBagian, KotakKeluaran, MulaiCepat, PanelPita, kelasSel } from "./AdtBagian";
import { cn } from "@/lib/cn";

/** Tinggi satu sel + celah, px. Posisi dihitung dari indeks, bukan dari urutan DOM. */
const SEL = 34;
const JARAK = 4;
const LANGKAH = SEL + JARAK;

const MULAI: { label: string; op: () => StackOp }[] = [
  { label: "Isi 12, 7, 9", op: () => ({ kind: "isiDariTeks", teks: "12 7 9" }) },
  { label: "Cek kurung {[()]}", op: () => ({ kind: "cekKurung", teks: "{[()]}" }) },
  { label: "Balik kata KASUR", op: () => ({ kind: "balikKata", kata: "KASUR" }) },
];

/**
 * Papan Lab Stack: dua gambaran dari keadaan yang SAMA, bergerak bersamaan.
 *
 * - Kiri, "Gambaran": tumpukan seperti piring - hanya isi stack (indeks 0 sampai
 *   TopPointer), yang di atas adalah puncak.
 * - Kanan, "Memori array": seluruh `Stack[0:MaxSize-1]` berdiri tegak dengan
 *   penunjuk TopPointer, termasuk SISA nilai di atas TopPointer yang sudah
 *   di-pop tetapi belum ditimpa (pudar).
 *
 * Sel dikunci id-nya dan diposisikan lewat `translate` (pelajaran lab lain:
 * urutan DOM tetap, kalau tidak sel "muncul lagi" alih-alih bergerak).
 */
export default function StackBoard({ state, fokus, peran, terpilih, onPilih, onMulai }: LabBoardProps<StackLabState, number, StackOp>) {
  const kap = state.kapasitas;
  const tinggi = kap * LANGKAH - JARAK;
  const kosongTotal = state.top === -1 && state.memori.every((c) => c === null) && !state.pita;
  const puncak = state.top >= 0 ? state.memori[state.top] : null;

  // Isi tumpukan: indeks 0..TopPointer. Sel kosong / sisa yang akan ditimpa = bayangan "?".
  const isi = Array.from({ length: state.top + 1 }, (_, i) => ({ i, sel: state.memori[i] }));

  return (
    <div className="bg-paper-card p-4 sm:p-6">
      {kosongTotal && (
        <div className="mb-5">
          <p className="mb-3 text-sm text-ink-muted">Stack masih kosong (TopPointer = -1). Coba salah satu:</p>
          <MulaiCepat pilihan={MULAI} onMulai={onMulai} />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* ── Gambaran ─────────────────────────────────────────── */}
        <figure className="min-w-0">
          <JudulBagian judul="Gambaran" ket="yang masuk terakhir keluar pertama (LIFO)" />
          <div className="mx-auto w-[150px]">
            <div className="relative" style={{ height: tinggi + 8 }}>
              {/* Wadah terbuka di atas: dua dinding dan alas. */}
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-white/25" />
              <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[3px] bg-white/25" />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25" />
              {isi.map(({ i, sel }) => {
                const pr = sel ? peran?.[sel.id] : undefined;
                const bayang = sel === null || pr === "luar";
                return (
                  <div
                    key={sel && pr !== "luar" ? `s${sel.id}` : `kosong${i}`}
                    className="lab-posisi absolute left-[9px] right-[9px]"
                    style={{ height: SEL, translate: `0 ${tinggi - (i + 1) * LANGKAH + JARAK + 2 - (pr === "hapus" ? 10 : 0)}px` }}
                  >
                    <div
                      className={cn(
                        "lab-enter flex h-full items-center justify-center font-mono text-[15px] font-semibold",
                        kelasSel({ peran: pr, fokus: fokus.includes(i), jumlahFokus: fokus.length, dalam: true, kosong: bayang }),
                      )}
                    >
                      {bayang ? "?" : sel!.nilai}
                    </div>
                  </div>
                );
              })}
              {puncak && (
                <span
                  className="lab-posisi absolute -right-[64px] w-[58px] text-[11px] font-semibold text-blue-300"
                  style={{ top: 0, translate: `0 ${tinggi - (state.top + 1) * LANGKAH + JARAK + 2 + SEL / 2 - 8}px` }}
                >
                  ← puncak
                </span>
              )}
            </div>
          </div>
        </figure>

        {/* ── Memori array ─────────────────────────────────────── */}
        <figure className="min-w-0">
          <JudulBagian judul="Memori array" ket={`Stack[0:${kap - 1}]`} />
          <div className="mx-auto flex w-max gap-2">
            <div className="relative w-[168px]" style={{ height: tinggi + LANGKAH }}>
              {state.memori.map((sel, i) => {
                const dalam = i <= state.top;
                const pr = sel ? peran?.[sel.id] : undefined;
                const dipilih = terpilih === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPilih(i)}
                    aria-label={`Stack[${i}]: ${sel ? sel.nilai : "belum ditulis"}${sel && !dalam ? ", sisa di luar stack" : ""}`}
                    aria-pressed={dipilih}
                    className="absolute left-0 flex w-full items-center gap-2 text-left focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-blue-500)]"
                    style={{ top: (kap - 1 - i) * LANGKAH, height: SEL }}
                  >
                    <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-muted">[{i}]</span>
                    <span
                      className={cn(
                        "lab-posisi flex h-full flex-1 items-center justify-between px-3 font-mono text-[14px] font-semibold",
                        kelasSel({ peran: pr, fokus: fokus.includes(i), jumlahFokus: fokus.length, dalam, kosong: sel === null }),
                        dipilih && "shadow-[inset_0_-3px_0_var(--color-blue-400)]",
                      )}
                    >
                      <span key={sel?.id ?? "x"} className={cn(sel && "lab-pop", sel && !dalam && "line-through decoration-white/30")}>
                        {sel ? sel.nilai : "-"}
                      </span>
                      {sel && !dalam && <span className="text-[10px] font-normal not-italic text-ink-faint">sisa</span>}
                    </span>
                  </button>
                );
              })}
              {/* TopPointer = -1 berdiri di bawah sel 0: tempat "di luar" array. */}
              <span
                aria-hidden="true"
                className="absolute left-9 flex w-[calc(100%-2.25rem)] items-center justify-center pl-2 text-[11px] text-ink-faint"
                style={{ top: kap * LANGKAH, height: SEL }}
              >
                {state.top === -1 ? "(di bawah indeks 0)" : ""}
              </span>
            </div>
            <div className="relative w-[96px]" style={{ height: tinggi + LANGKAH }}>
              <span
                className="lab-posisi absolute left-0 flex items-center gap-1 bg-blue-600 px-2 py-1 font-mono text-[11px] font-semibold text-white"
                style={{ top: 0, translate: `0 ${(kap - 1 - state.top) * LANGKAH + SEL / 2 - 11}px` }}
              >
                ← Top
              </span>
            </div>
          </div>
        </figure>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <BarisVariabel
          isi={[
            { nama: "TopPointer", nilai: String(state.top), sorot: true },
            { nama: "MaxSize", nilai: String(kap) },
            ...(state.item !== null ? [{ nama: "kembali", nilai: state.item === "" ? '""' : state.item }] : []),
          ]}
        />
        <KotakKeluaran baris={state.keluaran} />
        <PanelPita pita={state.pita} />
      </div>
    </div>
  );
}
