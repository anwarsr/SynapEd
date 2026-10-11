"use client";
import {
  FORMAT_TUGAS,
  INFO_FORMAT,
  KELOMPOK_FORMAT,
  MAX_POINTS_LIMIT,
  type FormatTugas,
} from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

export const KOLOM_KELAS = cn(
  "w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-[15px] text-ink",
  "transition-colors duration-200 placeholder:text-ink-faint",
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
);

export interface NilaiIsianTugas {
  formats: FormatTugas[];
  pakaiTenggat: boolean;
  /** Nilai input datetime-local, dibaca sebagai WIB. */
  tenggat: string;
  terimaTerlambat: boolean;
  poin: string;
}

/**
 * Isian pengaturan tugas — format, tenggat, izin terlambat, nilai maksimal.
 *
 * Dipakai kotak tulis (membuat) DAN formulir edit. Satu komponen supaya
 * keduanya tidak melenceng: dulu hanya ada di kotak tulis, dan formulir lain
 * yang menyalinnya pasti tertinggal begitu satu isian ditambah.
 *
 * `idAwalan` membedakan id input ketika dua formulir ada di halaman yang sama.
 */
export default function IsianTugas({
  nilai,
  ubah,
  disabled,
  idAwalan,
  catatanEdit,
}: {
  nilai: NilaiIsianTugas;
  ubah: (patch: Partial<NilaiIsianTugas>) => void;
  disabled: boolean;
  idAwalan: string;
  /** Hanya di formulir edit: menjelaskan akibat perubahan pada kiriman yang sudah masuk. */
  catatanEdit?: boolean;
}) {
  /** Menyalakan/mematikan sederet format sekaligus; urutan disimpan selalu urutan baku. */
  function setel(daftar: readonly FormatTugas[], aktif: boolean) {
    ubah({
      formats: FORMAT_TUGAS.filter((x) => (daftar.includes(x) ? aktif : nilai.formats.includes(x))),
    });
  }

  return (
    <div className="grid gap-5 rounded-xl border border-rule bg-paper p-4 sm:grid-cols-2">
      <fieldset className="min-w-0 sm:col-span-2">
        <legend className="t-label mb-2 text-ink-muted">Format yang boleh dikumpulkan</legend>
        {/* Satu kotak centang per JENIS berkas, dikelompokkan supaya mudah
            dipindai; tombol per kelompok untuk memilih/melepas sekaligus. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {KELOMPOK_FORMAT.map((k) => {
            const semua = k.formats.every((f) => nilai.formats.includes(f));
            return (
              <div key={k.label} className="min-w-0 rounded-lg border border-rule px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{k.label}</span>
                  {k.formats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setel(k.formats, !semua)}
                      disabled={disabled}
                      className="text-xs font-medium text-blue-700 hover:underline underline-offset-4 disabled:opacity-50"
                    >
                      {semua ? "Lepas semua" : "Pilih semua"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {k.formats.map((f) => {
                    const aktif = nilai.formats.includes(f);
                    return (
                      <label
                        key={f}
                        title={INFO_FORMAT[f].ket}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                          aktif ? "border-blue-300 bg-blue-50/60 text-ink" : "border-rule text-ink-body hover:border-rule-strong",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={aktif}
                          onChange={(e) => setel([f], e.target.checked)}
                          disabled={disabled}
                          className="accent-blue-600"
                        />
                        <span className="font-medium">{INFO_FORMAT[f].label}</span>
                        {f !== "text" && <span className="text-xs text-ink-muted">{INFO_FORMAT[f].ket}</span>}
                      </label>
                    );
                  })}
                </div>
                {k.formats.includes("text") && <p className="mt-1.5 text-xs text-ink-muted">{INFO_FORMAT.text.ket}</p>}
              </div>
            );
          })}
        </div>
        {nilai.formats.length === 0 && <p className="mt-2 text-xs text-rust-700">Pilih minimal satu format.</p>}
        {catatanEdit && (
          <p className="mt-2 text-xs text-ink-muted">Kiriman yang sudah masuk tidak berubah; format baru berlaku untuk kiriman berikutnya.</p>
        )}
      </fieldset>

      <div className="min-w-0">
        <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={nilai.pakaiTenggat}
            onChange={(e) => ubah({ pakaiTenggat: e.target.checked })}
            disabled={disabled}
            className="accent-blue-600"
          />
          Pakai tenggat
        </label>
        {nilai.pakaiTenggat ? (
          <>
            <label htmlFor={`${idAwalan}-tenggat`} className="sr-only">
              Tenggat (WIB)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id={`${idAwalan}-tenggat`}
                type="datetime-local"
                value={nilai.tenggat}
                onChange={(e) => ubah({ tenggat: e.target.value })}
                disabled={disabled}
                className={cn(KOLOM_KELAS, "text-sm")}
              />
              <span className="shrink-0 text-xs font-semibold text-ink-muted">WIB</span>
            </div>
            <label className="mt-3 flex items-start gap-2.5 text-sm text-ink-body">
              <input
                type="checkbox"
                checked={nilai.terimaTerlambat}
                onChange={(e) => ubah({ terimaTerlambat: e.target.checked })}
                disabled={disabled}
                className="mt-1 accent-blue-600"
              />
              <span>
                Terima pengumpulan setelah tenggat
                <span className="block text-xs text-ink-muted">
                  {catatanEdit
                    ? "Tenggat yang dimundurkan ke masa lalu menutup pengumpulan. Status “Terlambat” kiriman lama tidak berubah."
                    : "Ditandai “Terlambat”."}
                </span>
              </span>
            </label>
          </>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">Tanpa tenggat: pengumpulan selalu dibuka.</p>
        )}
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idAwalan}-poin`} className="block text-sm font-medium text-ink">
          Nilai maksimal
        </label>
        <input
          id={`${idAwalan}-poin`}
          type="number"
          min={1}
          max={MAX_POINTS_LIMIT}
          inputMode="numeric"
          value={nilai.poin}
          onChange={(e) => ubah({ poin: e.target.value })}
          disabled={disabled}
          className={cn(KOLOM_KELAS, "mt-2 w-28 text-sm")}
        />
        {catatanEdit && (
          <p className="mt-2 text-xs text-ink-muted">Tidak bisa diturunkan di bawah nilai tertinggi yang sudah diberikan.</p>
        )}
      </div>
    </div>
  );
}
