import { formatDurasi, durasiDetik, hitungNilai, TOTAL_POIN, type PercobaanQuiz, type Quiz } from "@/lib/classQuizRules";
import { soalUntukSiswa } from "@/lib/classQuizzes";
import { cn } from "@/lib/cn";

const ALASAN = {
  siswa: "Dikumpulkan",
  waktu: "Waktu habis - jawaban yang tersimpan dikumpulkan otomatis",
  ditutup: "Dikumpulkan karena quiz ditutup pengajar",
} as const;

/**
 * Hasil pengerjaan SATU siswa (miliknya sendiri).
 *
 * Nilai tampil begitu terkumpul. KUNCI JAWABAN baru tampil setelah quiz
 * DITUTUP pengajar - kalau tidak, siswa yang selesai lebih dulu bisa membagi
 * kuncinya ke teman yang masih mengerjakan. Kunci hanya dibaca dari `quiz`
 * di komponen server ini; tak pernah dikirim ke komponen klien.
 */
export default function QuizHasil({ quiz, percobaan }: { quiz: Quiz; percobaan: PercobaanQuiz }) {
  const n = hitungNilai(quiz, percobaan);
  const soal = soalUntukSiswa(quiz, percobaan);
  const kunciTerbuka = quiz.closed;
  const lama = durasiDetik(percobaan);
  const asli = new Map(quiz.questions.map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-[760px] font-medium">
      <div className="bg-paper-card p-6 shadow-[inset_0_3px_0_var(--color-blue-500)]">
        <p className="t-label text-ink-muted">Hasil Anda</p>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-[56px] font-semibold leading-none text-ink">{n.total}</span>
          <span className="text-lg text-ink-muted">/ {TOTAL_POIN}</span>
        </p>
        {n.esaiBelumDinilai > 0 && (
          <p className="mt-3 text-sm leading-[1.7] text-blue-300">
            Nilai sementara. {n.esaiBelumDinilai} soal esai masih menunggu penilaian pengajar; nilai akhir menyusul.
          </p>
        )}
        <p className="mt-3 text-[13px] text-ink-muted">
          {percobaan.finalizedBy ? ALASAN[percobaan.finalizedBy] : "Dikumpulkan"}
          {lama !== null && ` · lama pengerjaan ${formatDurasi(lama)}`}
        </p>
      </div>

      {!kunciTerbuka && (
        <p className="mt-4 bg-white/[0.05] px-5 py-3.5 text-[13px] leading-[1.7] text-ink-muted">
          Kunci jawaban dibuka setelah pengajar menutup quiz, supaya teman yang belum selesai tidak ikut terbantu.
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {soal.map((s, i) => {
          const q = asli.get(s.id);
          const jawab = percobaan.answers[s.id];
          const dapat = n.perSoal[s.id] ?? 0;
          const benar = s.type === "mcq" && q?.correct !== null && jawab === q?.correct;
          const belumDinilai = s.type === "essay" && typeof percobaan.essayScores[s.id] !== "number";

          return (
            <li key={s.id} className="bg-paper-card p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center bg-white/[0.08] text-[13px] font-semibold text-ink">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xs text-ink-muted">
                  {belumDinilai ? `menunggu / ${s.points}` : `${dapat} / ${s.points}`} poin
                </span>
              </div>
              <p className="whitespace-pre-line break-words text-[15px] font-medium leading-[1.65] text-ink">{s.text}</p>

              {s.type === "mcq" ? (
                <ul className="mt-3 space-y-1.5">
                  {s.options.map((o) => {
                    const dipilih = jawab === o.id;
                    const kunci = kunciTerbuka && q?.correct === o.id;
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-center gap-3 px-3.5 py-2.5 text-sm",
                          kunci ? "bg-blue-600/25 text-ink" : dipilih ? "bg-white/[0.1] text-ink" : "bg-white/[0.04] text-ink-body",
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words">{o.text}</span>
                        {dipilih && <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Jawaban Anda</span>}
                        {kunci && <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">Kunci</span>}
                      </li>
                    );
                  })}
                  {kunciTerbuka && (
                    <li className={cn("pt-1 text-xs font-semibold", benar ? "text-blue-300" : "text-rust-700")}>
                      {jawab === undefined ? "Tidak dijawab" : benar ? "Benar" : "Kurang tepat"}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-3 whitespace-pre-line break-words bg-white/[0.05] px-3.5 py-3 text-sm leading-[1.7] text-ink-body">
                  {jawab || <span className="text-ink-muted">(tidak dijawab)</span>}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
