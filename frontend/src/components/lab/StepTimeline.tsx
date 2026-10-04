"use client";
import type { LabStep } from "@/lib/lab/labTypes";
import { LAB_KELOMPOK_CLASS, LAB_PERAN_CLASS, LAB_PERAN_LABEL, LAB_PERAN_URUT } from "./labTone";
import { cn } from "@/lib/cn";

type LangkahRingkas = Pick<LabStep<unknown>, "narasi" | "kelompok" | "jalur" | "peran">;

/**
 * Narasi langkah sekarang, dipasang TEPAT DI ATAS papan (dan ikut menempel
 * bersama bilah alat saat panel digulir).
 *
 * Dulu narasinya ada di bawah papan; di kisi 2D dan kubus 3D yang tinggi,
 * siswa harus memilih antara membaca kalimatnya atau melihat selnya bergerak
 * — dan selalu ketinggalan salah satu. Di sini keduanya terlihat bersamaan.
 *
 * Hanya kalimatnya yang `aria-live`; legenda warna dan nomor langkah tidak
 * dibacakan ulang setiap frame.
 */
export function LangkahSekarang({
  steps,
  frame,
  memutar,
}: {
  steps: readonly LangkahRingkas[];
  frame: number;
  memutar: boolean;
}) {
  const sekarang = steps[frame];
  const total = steps.length;
  const persen = total > 1 ? (frame / (total - 1)) * 100 : total === 1 ? 100 : 0;
  const kelompok = sekarang?.kelompok;
  const adaPeran = new Set(Object.values(sekarang?.peran ?? {}));
  const peranTampil = LAB_PERAN_URUT.filter((r) => adaPeran.has(r));

  return (
    <div className="rounded-2xl border border-rule bg-paper-card px-4 py-3 shadow-soft">
      <div className="flex items-start gap-3">
        {total > 0 && (
          <span
            className={cn(
              "t-numeral mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              memutar ? "bg-blue-600 text-white" : "bg-paper-alt text-ink-muted",
            )}
          >
            {frame + 1}/{total}
          </span>
        )}
        {/* Kunci = frame: kalimatnya masuk ulang setiap langkah berganti, jadi
            perubahan narasi terlihat, bukan cuma terbaca. */}
        <p
          key={`${frame}-${sekarang?.narasi ?? ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="lab-fade-up min-w-0 flex-1 text-[15px] leading-relaxed text-ink"
        >
          {sekarang?.narasi ?? "Belum ada operasi yang dijalankan. Pilih operasi di panel kanan."}
        </p>
      </div>

      {kelompok && (
        <div className="lab-fade-up mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-dashed border-rule pt-2.5 text-[11px]">
          <span className="text-ink-muted">Warna = asal sel:</span>
          {kelompok.label.map((label, n) => (
            <span key={n} className={cn("rounded-md border-2 px-1.5 py-px font-medium", LAB_KELOMPOK_CLASS[n % LAB_KELOMPOK_CLASS.length])}>
              {label}
            </span>
          ))}
        </div>
      )}

      {peranTampil.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-dashed border-rule pt-2.5 text-[11px]">
          {peranTampil.map((r) => (
            // Kelas sel "luar" memakai opacity; di legenda chip-nya harus tetap terbaca.
            <span key={r} className={cn("rounded-md border-2 px-1.5 py-px font-medium", LAB_PERAN_CLASS[r].replace("opacity-40", "border-dashed"))}>
              {LAB_PERAN_LABEL[r]}
            </span>
          ))}
        </div>
      )}

      {sekarang?.jalur && sekarang.jalur.length > 0 && (
        <p className="mt-2 border-t border-dashed border-rule pt-2 text-[11px] text-ink-muted">
          Angka kecil di pojok sel = urutan kunjungan; panah menunjukkan arah. Sudah {sekarang.jalur.length} sel dikunjungi.
        </p>
      )}

      {/* Bilah kemajuan: lebar dianimasikan CSS, bukan ditulis per frame. */}
      {total > 1 && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-paper-alt" aria-hidden="true">
          <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out-soft" style={{ width: `${persen}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * Daftar semua langkah operasi terakhir, bisa diklik untuk melompat.
 *
 * Daftarnya SENGAJA tidak `aria-live`: kalau live, pembaca layar membacakan
 * ulang seluruh riwayat setiap kali satu langkah bertambah. Narasi langkah
 * yang sedang berjalan dibacakan oleh `LangkahSekarang`.
 */
export default function StepTimeline({
  steps,
  frame,
  label,
  onPilihLangkah,
}: {
  steps: readonly Pick<LabStep<unknown>, "narasi">[];
  frame: number;
  label: string;
  onPilihLangkah: (i: number) => void;
}) {
  const total = steps.length;
  if (total <= 1) return null;
  // Pengurutan bisa menghasilkan ratusan langkah. Daftar penuh berarti ratusan
  // tombol dirender ulang setiap langkah berganti — pemutar tersendat tepat
  // saat diputar cepat. Yang ditampilkan hanya jendela di sekitar langkah ini.
  const JENDELA = 60;
  const dari = total <= JENDELA ? 0 : Math.min(Math.max(frame - 15, 0), total - JENDELA);
  const sampai = Math.min(dari + JENDELA, total);

  return (
    <section className="rounded-3xl border border-rule bg-paper-card px-5 py-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-label text-ink">Semua langkah</h2>
        <span className="text-xs text-ink-muted">{label}</span>
      </div>

      {dari > 0 && (
        <button type="button" onClick={() => onPilihLangkah(0)} className="mt-2 text-xs text-blue-700 hover:underline">
          ↑ ke langkah pertama ({dari} langkah sebelumnya disembunyikan)
        </button>
      )}
      <ol start={dari + 1} className="mt-3 space-y-0.5">
        {steps.slice(dari, sampai).map((s, k) => {
          const i = dari + k;
          return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPilihLangkah(i)}
              aria-current={i === frame ? "step" : undefined}
              className={cn(
                "flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-200",
                i === frame
                  ? "bg-blue-50 text-blue-700"
                  : i < frame
                    ? "text-ink-body hover:bg-paper-alt"
                    : "text-ink-faint hover:bg-paper-alt hover:text-ink-muted",
              )}
            >
              <span
                className={cn(
                  "t-numeral flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums",
                  i === frame ? "bg-blue-600 text-white" : i < frame ? "bg-paper-alt text-ink-muted" : "border border-rule",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{s.narasi}</span>
            </button>
          </li>
          );
        })}
      </ol>
      {sampai < total && (
        <button type="button" onClick={() => onPilihLangkah(total - 1)} className="mt-2 text-xs text-blue-700 hover:underline">
          ↓ lompat ke hasil akhir ({total - sampai} langkah berikutnya disembunyikan)
        </button>
      )}
    </section>
  );
}
