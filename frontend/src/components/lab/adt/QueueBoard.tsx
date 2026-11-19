"use client";
import type { LabBoardProps } from "../labKit";
import { indeksTampil, type QueueLabState, type QueueOp } from "@/lib/lab/queueLab";
import { BarisVariabel, JudulBagian, KotakKeluaran, MulaiCepat, PanelPita, kelasSel } from "./AdtBagian";
import { cn } from "@/lib/cn";

const MULAI: { label: string; op: () => QueueOp }[] = [
  { label: "Isi 12, 7, 9", op: () => ({ kind: "isiDariTeks", teks: "12 7 9" }) },
  { label: "Antrean loket", op: () => ({ kind: "loket", kejadian: "+Ani +Budi - +Cici - -" }) },
  { label: "Kenapa linear bisa penuh?", op: () => ({ kind: "penuhSemu" }) },
];

/** Posisi slot ke-i dalam satuan lebar sel (CSS `--sel`, berganti menurut lebar layar). */
const slot = (i: number) => `calc(${i} * (var(--sel) + 4px))`;

/**
 * Papan Lab Queue: antrean (gambaran) dan `Queue[0:MaxSize-1]` dengan
 * FrontPointer di atas dan RearPointer di bawah - satu keadaan, dua gambar.
 *
 * Deret memori menyisakan satu slot kosong di KIRI (RearPointer = -1) dan satu
 * di KANAN (penunjuk yang sesaat melewati indeks terakhir, sebelum queue
 * melingkar membawanya kembali ke 0), supaya penunjuk tidak pernah melompat
 * keluar papan. Queue melingkar menggambar panah "kembali ke 0" di bawahnya.
 */
export default function QueueBoard({ state, fokus, peran, terpilih, onPilih, onMulai }: LabBoardProps<QueueLabState, number, QueueOp>) {
  const kap = state.kapasitas;
  const melingkar = state.jenis === "melingkar";
  const tampil = indeksTampil(state);
  const dalam = new Set(tampil);
  const kosongTotal = state.jumlah === 0 && state.memori.every((c) => c === null) && !state.pita;
  const penuhSemu = !melingkar && state.rear === kap - 1 && state.front > 0;

  return (
    <div className="bg-paper-card p-4 [--sel:34px] sm:p-6 sm:[--sel:48px]">
      {kosongTotal && (
        <div className="mb-5">
          <p className="mb-3 text-sm text-ink-muted">Queue {state.jenis} masih kosong. Coba salah satu:</p>
          <MulaiCepat pilihan={MULAI} onMulai={onMulai} />
        </div>
      )}

      {/* ── Gambaran: antrean ───────────────────────────────── */}
      <figure className="min-w-0">
        <JudulBagian judul="Gambaran" ket="yang pertama masuk, pertama keluar (FIFO)" />
        <div className="overflow-x-auto pb-1">
          <div className="flex w-max items-center gap-3">
            <span className="t-label w-14 shrink-0 text-right text-blue-300">Depan</span>
            <div className="relative h-[42px] bg-white/[0.03]" style={{ width: `calc(${kap} * (var(--sel) + 4px) + 4px)` }}>
              {tampil.map((idx, urut) => {
                const sel = state.memori[idx];
                const pr = sel ? peran?.[sel.id] : undefined;
                const bayang = !sel || pr === "luar";
                return (
                  <div
                    key={sel && pr !== "luar" ? `q${sel.id}` : `kosong${idx}`}
                    className="lab-posisi absolute top-1 h-[34px]"
                    style={{ width: "var(--sel)", translate: `calc(${slot(urut)} + 4px) ${pr === "hapus" ? -6 : 0}px` }}
                  >
                    <div
                      className={cn(
                        "lab-enter flex h-full items-center justify-center font-mono text-[14px] font-semibold",
                        kelasSel({ peran: pr, fokus: fokus.includes(idx), jumlahFokus: fokus.length, dalam: true, kosong: bayang }),
                      )}
                    >
                      {bayang ? "?" : sel!.nilai}
                    </div>
                  </div>
                );
              })}
              {tampil.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-xs text-ink-faint">antrean kosong</span>}
            </div>
            <span className="t-label shrink-0 text-ink-muted">Belakang</span>
          </div>
        </div>
      </figure>

      {/* ── Memori array ───────────────────────────────────── */}
      <figure className="mt-6 min-w-0">
        <JudulBagian judul="Memori array" ket={`Queue[0:${kap - 1}] · ${melingkar ? "melingkar" : "linear"}`} />
        <div className="overflow-x-auto pb-1">
          <div className="relative" style={{ width: `calc(${kap + 2} * (var(--sel) + 4px))`, height: melingkar ? 158 : 132 }}>
            {/* Front (atas) */}
            <span
              className="lab-posisi absolute top-0 flex flex-col items-center font-mono text-[11px] font-semibold text-white"
              style={{ width: "var(--sel)", translate: `${slot(state.front + 1)} 0` }}
            >
              <span className="whitespace-nowrap bg-blue-600 px-1.5 py-0.5">Front</span>
              <span aria-hidden="true" className="leading-3 text-blue-300">▼</span>
            </span>

            {/* Indeks + sel */}
            {state.memori.map((sel, i) => {
              const di = dalam.has(i);
              const pr = sel ? peran?.[sel.id] : undefined;
              const dipilih = terpilih === i;
              const terlewat = !melingkar && i < state.front && !di;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPilih(i)}
                  aria-pressed={dipilih}
                  aria-label={`Queue[${i}]: ${sel ? sel.nilai : "belum ditulis"}${sel && !di ? ", sisa di luar antrean" : ""}`}
                  className="absolute top-[30px] flex flex-col items-center gap-1 focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-blue-500)]"
                  style={{ left: slot(i + 1), width: "var(--sel)" }}
                >
                  <span className="font-mono text-[10px] tabular-nums text-ink-muted">[{i}]</span>
                  <span
                    className={cn(
                      "lab-posisi flex h-[38px] w-full items-center justify-center font-mono text-[13px] font-semibold sm:text-[14px]",
                      kelasSel({ peran: pr, fokus: fokus.includes(i), jumlahFokus: fokus.length, dalam: di, kosong: sel === null }),
                      dipilih && "shadow-[inset_0_-3px_0_var(--color-blue-400)]",
                    )}
                  >
                    <span key={sel?.id ?? "x"} className={cn(sel && "lab-pop", sel && !di && "line-through decoration-white/30")}>
                      {sel ? sel.nilai : "-"}
                    </span>
                  </span>
                  <span className="h-3 text-[9px] leading-3 text-ink-faint">{terlewat && penuhSemu ? "terbuang" : sel && !di ? "sisa" : ""}</span>
                </button>
              );
            })}

            {/* Rear (bawah) */}
            <span
              className="lab-posisi absolute top-[98px] flex flex-col items-center font-mono text-[11px] font-semibold text-white"
              style={{ width: "var(--sel)", translate: `${slot(state.rear + 1)} 0` }}
            >
              <span aria-hidden="true" className="leading-3 text-blue-300">▲</span>
              <span className="whitespace-nowrap bg-ink px-1.5 py-0.5 text-paper">Rear</span>
            </span>

            {/* Queue melingkar: dari indeks terakhir kembali ke indeks 0. */}
            {melingkar && (
              <div
                aria-hidden="true"
                className="absolute top-[134px] flex items-center gap-1 text-[10px] text-blue-300"
                style={{ left: `calc(${slot(1)} + var(--sel) / 2)`, width: `calc(${kap - 1} * (var(--sel) + 4px))` }}
              >
                <span>◀</span>
                <span className="h-px flex-1 bg-blue-400/60" />
                <span className="whitespace-nowrap px-1">setelah [{kap - 1}] kembali ke [0]</span>
                <span className="h-px flex-1 bg-blue-400/60" />
              </div>
            )}
          </div>
        </div>
        {penuhSemu && (
          <p className="mt-2 bg-amber-500/15 px-3 py-2 text-xs text-warn-text">
            Queue linear &quot;penuh&quot;: RearPointer di indeks terakhir, padahal {state.front} slot di depan sudah kosong dan tidak bisa dipakai lagi.
          </p>
        )}
      </figure>

      <div className="mt-5 flex flex-col gap-3">
        <BarisVariabel
          isi={[
            { nama: "FrontPointer", nilai: String(state.front), sorot: true },
            { nama: "RearPointer", nilai: String(state.rear), sorot: true },
            { nama: "NumberInQueue", nilai: String(state.jumlah) },
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
