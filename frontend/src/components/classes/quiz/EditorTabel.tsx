"use client";
import {
  MAX_BARIS_TABEL,
  MAX_KOLOM_TABEL,
  MAX_TEKS_SEL,
  hapusBarisTabel,
  hapusKolomTabel,
  ubahUkuranTabel,
  type SelTabel,
  type TabelSoal,
} from "@/lib/classQuizRules";
import { cn } from "@/lib/cn";

const TOMBOL_KECIL =
  "flex h-7 w-7 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35";

/**
 * Editor soal tabel (sisi pengajar): ukuran baris & kolom diatur bebas, tiap sel dipilih jadi
 * TEKS TETAP (tampil ke siswa, mis. judul baris/kolom) atau ISIAN SISWA (kosong untuk diisi siswa; tanpa kunci jawaban,
 * jawabannya diperiksa pengajar sendiri). Mengecilkan ukuran membuang baris/kolom di ujung; tombol silang
 * di tepi membuang baris/kolom tertentu.
 *
 * `disabled` (quiz sudah dikerjakan): seluruh struktur terkunci, sama seperti soal lain.
 */
export default function EditorTabel({
  idDasar,
  tabel,
  ubah,
  disabled,
}: {
  idDasar: string;
  tabel: TabelSoal;
  ubah: (t: TabelSoal) => void;
  disabled?: boolean;
}) {
  function ubahSel(i: number, patch: Partial<SelTabel>) {
    ubah({ ...tabel, cells: tabel.cells.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  }

  /** Tetap ↔ isian. Sel isian tidak menyimpan teks maupun kunci. */
  function gantiMode(i: number) {
    const c = tabel.cells[i];
    ubahSel(i, c.fill ? { fill: false, text: "", key: "" } : { fill: true, text: "", key: "" });
  }

  const isian = tabel.cells.filter((c) => c.fill).length;

  return (
    <div className="mt-4" role="group" aria-label="Pengaturan tabel">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Pengatur
          label="Baris"
          nilai={tabel.rows}
          min={1}
          maks={MAX_BARIS_TABEL}
          ubah={(n) => ubah(ubahUkuranTabel(tabel, n, tabel.cols))}
          disabled={disabled}
        />
        <Pengatur
          label="Kolom"
          nilai={tabel.cols}
          min={1}
          maks={MAX_KOLOM_TABEL}
          ubah={(n) => ubah(ubahUkuranTabel(tabel, tabel.rows, n))}
          disabled={disabled}
        />
        <p className="text-xs text-ink-muted">
          {isian} sel isian dari {tabel.cells.length} sel
        </p>
      </div>

      <div className="mt-3 overflow-x-auto pb-2">
        <table className="border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <td className="w-7" />
              {Array.from({ length: tabel.cols }, (_, c) => (
                <td key={c} className="text-center">
                  <button
                    type="button"
                    aria-label={`Hapus kolom ${c + 1}`}
                    title={`Hapus kolom ${c + 1}`}
                    disabled={disabled || tabel.cols <= 1}
                    onClick={() => ubah(hapusKolomTabel(tabel, c))}
                    className={cn(TOMBOL_KECIL, "mx-auto h-6 hover:!text-rust-700")}
                  >
                    <Silang />
                  </button>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: tabel.rows }, (_, r) => (
              <tr key={r}>
                <td className="align-middle">
                  <button
                    type="button"
                    aria-label={`Hapus baris ${r + 1}`}
                    title={`Hapus baris ${r + 1}`}
                    disabled={disabled || tabel.rows <= 1}
                    onClick={() => ubah(hapusBarisTabel(tabel, r))}
                    className={cn(TOMBOL_KECIL, "hover:!text-rust-700")}
                  >
                    <Silang />
                  </button>
                </td>
                {Array.from({ length: tabel.cols }, (_, c) => {
                  const i = r * tabel.cols + c;
                  const sel = tabel.cells[i];
                  return (
                    <td key={c} className="relative min-w-[132px] p-0 align-top">
                      <input
                        id={`${idDasar}-sel-${i}`}
                        aria-label={sel.fill ? `Isian siswa baris ${r + 1} kolom ${c + 1}` : `Teks baris ${r + 1} kolom ${c + 1}`}
                        value={sel.fill ? "" : sel.text}
                        onChange={(e) => ubahSel(i, { text: e.target.value })}
                        maxLength={MAX_TEKS_SEL}
                        readOnly={sel.fill}
                        disabled={disabled}
                        placeholder={sel.fill ? "Diisi siswa" : "Teks tetap"}
                        className={cn(
                          "block w-full py-2.5 pl-3 pr-9 text-sm text-ink outline-none placeholder:text-ink-muted disabled:opacity-60",
                          sel.fill
                            ? "bg-blue-600/15 shadow-[inset_0_-2px_0_var(--color-blue-500)] placeholder:text-blue-300/70"
                            : "bg-white/[0.07] shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]",
                        )}
                      />
                      <button
                        type="button"
                        aria-label={sel.fill ? `Jadikan sel baris ${r + 1} kolom ${c + 1} teks tetap` : `Jadikan sel baris ${r + 1} kolom ${c + 1} isian siswa`}
                        title={sel.fill ? "Isian siswa (klik untuk jadikan teks tetap)" : "Teks tetap (klik untuk jadikan isian siswa)"}
                        aria-pressed={sel.fill}
                        disabled={disabled}
                        onClick={() => gantiMode(i)}
                        className={cn(
                          "absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          sel.fill ? "bg-blue-600 text-[#fff]" : "bg-white/10 text-ink-muted hover:bg-white/20 hover:text-ink",
                        )}
                      >
                        {sel.fill ? <IkonPensil /> : <IkonTeks />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-[1.7] text-ink-muted">
        Tombol di ujung kanan tiap sel mengganti jenisnya: <strong className="font-semibold text-ink-body">teks tetap</strong> (tampil ke siswa, mis. judul)
        atau <strong className="font-semibold text-blue-300">isian siswa</strong> (dikosongkan untuk diisi siswa). Soal tabel
        tidak punya kunci jawaban: Anda memeriksa isiannya dan memberi poin sendiri di Pantau.
      </p>
    </div>
  );
}

function Pengatur({
  label,
  nilai,
  min,
  maks,
  ubah,
  disabled,
}: {
  label: string;
  nilai: number;
  min: number;
  maks: number;
  ubah: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Jumlah ${label.toLowerCase()}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</span>
      <button type="button" aria-label={`Kurangi ${label.toLowerCase()}`} disabled={disabled || nilai <= min} onClick={() => ubah(nilai - 1)} className={cn(TOMBOL_KECIL, "bg-white/[0.07]")}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>
      <span className="w-6 text-center text-[15px] font-semibold tabular-nums text-ink" aria-live="polite">
        {nilai}
      </span>
      <button type="button" aria-label={`Tambah ${label.toLowerCase()}`} disabled={disabled || nilai >= maks} onClick={() => ubah(nilai + 1)} className={cn(TOMBOL_KECIL, "bg-white/[0.07]")}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </button>
    </div>
  );
}

function Silang() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IkonTeks() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M5 6h14M12 6v13" />
    </svg>
  );
}

function IkonPensil() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.86 4.49l1.69-1.69a1.88 1.88 0 112.65 2.65L10.58 16.07a4.5 4.5 0 01-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 011.13-1.9l8.93-8.92z" />
    </svg>
  );
}
