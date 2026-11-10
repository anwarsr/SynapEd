"use client";
import { MAX_TEKS_SEL, susunJawabanTabel, uraiJawabanTabel } from "@/lib/classQuizRules";
import type { SoalSiswa } from "@/lib/classQuizzes";

/**
 * Tabel yang diisi siswa. Sel tetap = teks, sel isian = kolom ketik. Nilainya disimpan sebagai SATU teks JSON
 * (lihat `uraiJawabanTabel`); tak ada isian sama sekali = "" sehingga soal dihitung belum dijawab.
 * Tabel lebar menggulir mendatar di dalam kotaknya sendiri (halaman tidak ikut melebar di ponsel).
 */
export default function TabelPengerja({
  idDasar,
  tabel,
  nilai,
  ubah,
  disabled,
}: {
  idDasar: string;
  tabel: NonNullable<SoalSiswa["table"]>;
  nilai: string;
  ubah: (v: string) => void;
  disabled?: boolean;
}) {
  const jawab = uraiJawabanTabel(nilai);

  function isi(i: number, teks: string) {
    ubah(susunJawabanTabel({ ...jawab, [i]: teks }));
  }

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <table className="w-full border-separate border-spacing-[3px]">
        <tbody>
          {Array.from({ length: tabel.rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: tabel.cols }, (_, c) => {
                const i = r * tabel.cols + c;
                const sel = tabel.cells[i];
                return sel.fill ? (
                  <td key={c} className="min-w-[128px] p-0">
                    <input
                      id={`${idDasar}-sel-${i}`}
                      aria-label={`Isian baris ${r + 1}, kolom ${c + 1}`}
                      value={jawab[i] ?? ""}
                      onChange={(e) => isi(i, e.target.value)}
                      maxLength={MAX_TEKS_SEL}
                      disabled={disabled}
                      autoComplete="off"
                      className="block w-full bg-white/[0.06] px-3 py-2.5 text-[15px] text-ink outline-none shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] disabled:opacity-60"
                    />
                  </td>
                ) : (
                  <td key={c} className="min-w-[96px] whitespace-pre-line break-words bg-white/[0.11] px-3 py-2.5 text-[15px] font-semibold text-ink">
                    {sel.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
