import type { AnalisisButir } from "@/lib/classQuizRules";
import { cn } from "@/lib/cn";

/**
 * Analisis soal (Pantau, pengelola saja): soal diurut dari yang paling banyak
 * salah; tiap pilihan ganda menampilkan berapa persen peserta memilihnya,
 * kunci jawaban ditandai, dan pilihan terfavorit diberi tanda. Semua persen
 * terhadap peserta yang sudah mengumpulkan. Warna HANYA keluarga biru.
 */
export default function AnalisisSoal({ butir, peserta }: { butir: readonly AnalisisButir[]; peserta: number }) {
  return (
    <section className="mt-14" aria-labelledby="analisis-judul">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <p id="analisis-judul" className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">
          Analisis soal
        </p>
        <p className="text-xs text-ink-muted">Dari {peserta} peserta yang sudah mengumpulkan, soal tersulit di atas.</p>
      </div>

      {peserta === 0 ? (
        <p className="mt-4 bg-white/5 px-6 py-8 text-sm leading-[1.7] text-ink-muted">
          Analisis muncul begitu ada peserta yang mengumpulkan jawaban.
        </p>
      ) : (
        <ol className="mt-4 space-y-1">
          {butir.map((b, urut) => (
            <li key={b.id} className="bg-paper-card px-5 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-300">
                    Soal {String(b.nomor).padStart(2, "0")} · {b.jenis === "essay" ? "Esai" : "Pilihan ganda"} · {b.poin} poin
                    {urut === 0 && b.persenSalah > 0 && <span className="ml-2 text-ink">paling sulit</span>}
                  </p>
                  <p className="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-sm font-semibold leading-[1.6] text-ink">{b.teks}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-[34px] font-semibold leading-none text-ink">{b.jenis === "essay" && b.rataSkorPersen === null ? "-" : `${b.persenSalah}%`}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{b.jenis === "essay" ? "kurang poin" : "tidak benar"}</span>
                </p>
              </div>

              {b.jenis === "mcq" ? (
                <>
                  <ul className="mt-4 space-y-2">
                    {b.opsi.map((o) => {
                      const favorit = o.id === b.terbanyakId;
                      return (
                        <li key={o.id} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_46px]">
                          <div className="min-w-0">
                            <p className="flex items-baseline gap-2 text-[13px] text-ink-body">
                              <span className="min-w-0 truncate">{o.teks || "(kosong)"}</span>
                              {o.benar && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Kunci</span>}
                              {favorit && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">Terbanyak</span>}
                            </p>
                            <div className="mt-1 h-2 w-full bg-white/10" role="img" aria-label={`${o.persen}% memilih (${o.jumlah} orang)`}>
                              <span
                                className={cn("block h-full", o.benar ? "bg-blue-500" : favorit ? "bg-blue-300/70" : "bg-white/30")}
                                style={{ width: `${o.persen}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-right text-[15px] font-semibold text-ink">{o.persen}%</p>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-ink-muted">
                    Benar {b.benar} · Salah {b.salah} · Tidak menjawab {b.kosong}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs leading-[1.7] text-ink-muted">
                  {b.rataSkorPersen === null
                    ? "Belum ada jawaban yang dinilai."
                    : `Rata-rata skor ${b.rataSkorPersen}% dari poin soal (${b.dinilai} jawaban dinilai).`}
                  {b.kosong > 0 && ` ${b.kosong} peserta tidak menjawab.`}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
