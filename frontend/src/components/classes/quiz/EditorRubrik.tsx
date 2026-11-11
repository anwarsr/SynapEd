"use client";
import {
  MAX_JUDUL_RUBRIK,
  MAX_KRITERIA_RUBRIK,
  MAX_RUBRIK,
  MIN_RUBRIK,
  MAX_TEKS_KRITERIA,
  SKALA_RUBRIK,
  daftarKriteria,
  idBaru,
  type RubrikQuiz,
  type TabelRubrik,
} from "@/lib/classQuizRules";
import { cn } from "@/lib/cn";

const KOLOM =
  "block w-full bg-white/[0.06] px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] disabled:opacity-60";

/**
 * Editor rubrik penilaian quiz KELOMPOK: jumlah tabel bebas (1 sampai 10; mulai dari 3), tiap tabel berisi poin
 * penilaian yang ditambah sendiri oleh pengajar. Skala tetap 1 sampai 4 (sangat kurang, kurang, baik, sangat baik). Pengajar memberi skor per
 * siswa di halaman Pantau setelah quiz dikumpulkan.
 *
 * `terkunci` (sudah ada yang mengerjakan): tabel & poin penilaian tak bisa ditambah/dihapus karena skor tersimpan per poin;
 * judul dan teks masih bisa diubah.
 */
export default function EditorRubrik({
  rubrik,
  ubah,
  disabled,
  terkunci,
}: {
  rubrik: RubrikQuiz;
  ubah: (r: RubrikQuiz) => void;
  disabled: boolean;
  terkunci: boolean;
}) {
  const semuaId = [...daftarKriteria(rubrik).map((k) => k.id), ...rubrik.tables.map((t) => t.id)];

  function tambahTabel() {
    const id = idBaru(semuaId);
    const kid = idBaru([...semuaId, id]);
    ubah({ ...rubrik, tables: [...rubrik.tables, { id, title: `Rubrik ${rubrik.tables.length + 1}`, criteria: [{ id: kid, text: "" }] }] });
  }

  function ubahTabel(id: string, fn: (t: TabelRubrik) => TabelRubrik) {
    ubah({ ...rubrik, tables: rubrik.tables.map((t) => (t.id === id ? fn(t) : t)) });
  }

  return (
    <section className="mt-4 bg-paper-card p-6" aria-labelledby="rubrik-judul">
      <p id="rubrik-judul" className="t-label text-ink-muted">
        Rubrik penilaian kelompok
      </p>
      <p className="mt-2 text-sm leading-[1.7] text-ink-body">
        Isi tabel rubrik (tambah atau hapus sesuai kebutuhan) untuk menilai tiap anggota kelompok SATU PER SATU. Setelah siswa mengumpulkan, Anda memberi skor tiap poin penilaian untuk tiap
        siswa: {SKALA_RUBRIK.map((s) => `${s.n} = ${s.label.toLowerCase()}`).join(", ")}. Hasilnya menjadi <strong>nilai individu</strong> (persen rubrik) yang
        berdiri sendiri; <strong>nilai kelompok</strong> tetap dari poin soal yang Anda atur. Soal esai dan tabel pada quiz kelompok juga dinilai manual oleh
        Anda (nilai menunggu persetujuan), sedangkan pilihan ganda otomatis. Keduanya tampil di Pantau dan di ekspor spreadsheet.
      </p>

      <div className="mt-5 space-y-5">
        {rubrik.tables.map((tb, i) => (
          <div key={tb.id} className="bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`rb-${tb.id}`} className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-muted">
                Rubrik {i + 1}
              </label>
              <button
                type="button"
                disabled={disabled || terkunci || rubrik.tables.length <= MIN_RUBRIK}
                onClick={() => ubah({ ...rubrik, tables: rubrik.tables.filter((t) => t.id !== tb.id) })}
                title={terkunci ? "Tidak bisa dihapus: sudah ada yang mengerjakan" : rubrik.tables.length <= MIN_RUBRIK ? "Minimal satu rubrik" : "Hapus rubrik ini"}
                className="bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-white/[0.14] hover:text-ink disabled:opacity-35"
              >
                Hapus rubrik
              </button>
            </div>
            <input
              id={`rb-${tb.id}`}
              value={tb.title}
              maxLength={MAX_JUDUL_RUBRIK}
              disabled={disabled}
              placeholder="Judul rubrik, mis. Kerja sama"
              onChange={(e) => ubahTabel(tb.id, (t) => ({ ...t, title: e.target.value }))}
              className={cn(KOLOM, "mt-2 font-semibold")}
            />

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-y-1.5 text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                    <th className="pb-1 pr-3 font-semibold">Poin yang dinilai</th>
                    {SKALA_RUBRIK.map((s) => (
                      <th key={s.n} className="w-[64px] px-1 pb-1 text-center font-semibold">
                        {s.n}
                        <span className="block text-[9px] font-medium normal-case tracking-normal">{s.label}</span>
                      </th>
                    ))}
                    <th className="w-9" aria-label="Hapus" />
                  </tr>
                </thead>
                <tbody>
                  {tb.criteria.map((k, j) => (
                    <tr key={k.id}>
                      <td className="pr-3">
                        <label htmlFor={`rk-${k.id}`} className="sr-only">
                          Poin penilaian {j + 1} rubrik {i + 1}
                        </label>
                        <input
                          id={`rk-${k.id}`}
                          value={k.text}
                          maxLength={MAX_TEKS_KRITERIA}
                          disabled={disabled}
                          placeholder="Hal yang dinilai, mis. Membagi tugas dengan adil"
                          onChange={(e) =>
                            ubahTabel(tb.id, (t) => ({ ...t, criteria: t.criteria.map((c) => (c.id === k.id ? { ...c, text: e.target.value } : c)) }))
                          }
                          className={KOLOM}
                        />
                      </td>
                      {SKALA_RUBRIK.map((s) => (
                        <td key={s.n} className="px-1 text-center" aria-hidden="true">
                          <span className="inline-block h-4 w-4 rounded-full border border-white/25" />
                        </td>
                      ))}
                      <td className="text-right">
                        <button
                          type="button"
                          disabled={disabled || terkunci || tb.criteria.length <= 1}
                          onClick={() => ubahTabel(tb.id, (t) => ({ ...t, criteria: t.criteria.filter((c) => c.id !== k.id) }))}
                          aria-label={`Hapus poin penilaian ${j + 1} rubrik ${i + 1}`}
                          title={terkunci ? "Tidak bisa dihapus: sudah ada yang mengerjakan" : tb.criteria.length <= 1 ? "Minimal satu poin" : "Hapus poin"}
                          className="h-9 w-9 bg-white/[0.06] text-ink-muted transition-colors hover:bg-white/[0.14] hover:text-ink disabled:opacity-35"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={disabled || terkunci || tb.criteria.length >= MAX_KRITERIA_RUBRIK}
              onClick={() => ubahTabel(tb.id, (t) => ({ ...t, criteria: [...t.criteria, { id: idBaru(semuaId), text: "" }] }))}
              className="mt-2 bg-white/[0.08] px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-white/[0.14] disabled:opacity-40"
            >
              + Tambah poin penilaian
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || terkunci || rubrik.tables.length >= MAX_RUBRIK}
        onClick={tambahTabel}
        className="mt-4 bg-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-white/[0.14] disabled:opacity-40"
      >
        + Tambah rubrik
      </button>
      <p className="mt-2 text-xs text-ink-muted">
        {rubrik.tables.length} dari maksimal {MAX_RUBRIK} rubrik.
      </p>
    </section>
  );
}
