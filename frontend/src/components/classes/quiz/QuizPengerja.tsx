"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { saveQuizAnswers, submitQuiz } from "@/lib/classQuizActions";
import { MAX_JAWABAN_ESAI, formatDurasi } from "@/lib/classQuizRules";
import type { SoalSiswa } from "@/lib/classQuizzes";
import { cn } from "@/lib/cn";

/**
 * Lembar pengerjaan siswa.
 *
 * Penghitung mundur berbasis SISA DETIK dari server (`sisaAwal`) yang dikurangi
 * waktu monoton peramban (performance.now) - bukan jam dinding siswa, jadi
 * mengubah jam perangkat tak memperpanjang waktu. Server tetap yang berwenang:
 * ia menolak kiriman setelah batas dan menilai jawaban yang tersimpan.
 *
 * Jawaban disimpan otomatis (debounce) agar waktu habis di tengah jalan tidak
 * menghilangkan pekerjaan; di nol, quiz dikumpulkan otomatis.
 */
export default function QuizPengerja({
  classId,
  quizId,
  judul,
  soal,
  jawabanAwal,
  sisaAwal,
}: {
  classId: string;
  quizId: string;
  judul: string;
  soal: SoalSiswa[];
  jawabanAwal: Record<string, string>;
  /** Sisa detik saat halaman dirender; null = tanpa batas waktu. */
  sisaAwal: number | null;
}) {
  const router = useRouter();
  const [jawaban, setJawaban] = useState<Record<string, string>>(jawabanAwal);
  const [sisa, setSisa] = useState<number | null>(sisaAwal);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [simpanan, setSimpanan] = useState<"tersimpan" | "menyimpan" | "gagal">("tersimpan");

  const jawabanRef = useRef(jawaban);
  const selesaiRef = useRef(false);
  const kirimRef = useRef<() => void>(() => undefined);

  // Penghitung mundur.
  useEffect(() => {
    if (sisaAwal === null) return;
    const mulai = performance.now();
    const id = setInterval(() => {
      const s = Math.max(0, sisaAwal - Math.floor((performance.now() - mulai) / 1000));
      setSisa(s);
      if (s === 0) {
        clearInterval(id);
        kirimRef.current();
      }
    }, 500);
    return () => clearInterval(id);
  }, [sisaAwal]);

  // Simpan otomatis 1,5 dtk setelah perubahan terakhir.
  const pertama = useRef(true);
  useEffect(() => {
    jawabanRef.current = jawaban;
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    const id = setTimeout(async () => {
      if (selesaiRef.current) return;
      setSimpanan("menyimpan");
      const res = await saveQuizAnswers(classId, quizId, jawabanRef.current).catch(() => null);
      setSimpanan(res?.ok ? "tersimpan" : "gagal");
    }, 1500);
    return () => clearTimeout(id);
  }, [jawaban, classId, quizId]);

  function kumpulkan() {
    if (selesaiRef.current) return;
    selesaiRef.current = true;
    setError(null);
    setKonfirmasi(false);
    startTransition(async () => {
      const res = await submitQuiz(classId, quizId, jawabanRef.current);
      // Galat "waktu habis" tetap berarti quiz sudah terkumpul - halaman hasil yang menjelaskannya.
      if (!res.ok && !res.error.startsWith("Waktu habis") && !res.error.includes("sudah dikumpulkan")) {
        selesaiRef.current = false;
        return setError(res.error);
      }
      router.refresh();
    });
  }
  // Diperbarui di efek (bukan saat render) supaya penghitung mundur selalu memanggil versi terbaru.
  useEffect(() => {
    kirimRef.current = kumpulkan;
  });

  const terjawab = soal.filter((s) => (jawaban[s.id] ?? "").trim() !== "").length;
  const genting = sisa !== null && sisa <= 60;

  return (
    <div className="mx-auto max-w-[760px]">
      {/* Bilah waktu melekat di atas */}
      <div className="sticky top-[84px] z-30 mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 bg-header/95 px-5 py-3 backdrop-blur-md">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{judul}</p>
        <p className="text-sm text-ink-muted">
          {terjawab}/{soal.length} terjawab
        </p>
        {sisa !== null && (
          <p
            role="timer"
            aria-label="Sisa waktu"
            className={cn("text-[22px] font-semibold tabular-nums", genting ? "text-rust-700" : "text-ink")}
          >
            {formatDurasi(sisa)}
          </p>
        )}
        <span className="text-[11px] text-ink-muted" aria-live="polite">
          {simpanan === "menyimpan" ? "Menyimpan…" : simpanan === "gagal" ? "Gagal menyimpan, periksa koneksi" : "Tersimpan otomatis"}
        </span>
      </div>

      <ol className="space-y-4">
        {soal.map((s, i) => (
          <li key={s.id} className="bg-paper-card p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="flex h-8 w-8 items-center justify-center bg-white/[0.08] text-[13px] font-semibold tabular-nums text-ink">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-xs text-ink-muted">{s.points} poin</span>
            </div>
            <p className="whitespace-pre-line break-words text-[16px] font-medium leading-[1.65] text-ink">{s.text}</p>

            {s.type === "mcq" ? (
              <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Soal ${i + 1}`}>
                {s.options.map((o) => {
                  const dipilih = jawaban[s.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={dipilih}
                      disabled={pending}
                      onClick={() => setJawaban((j) => ({ ...j, [s.id]: o.id }))}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition-colors duration-150",
                        dipilih ? "bg-blue-600 text-[#fff]" : "bg-white/[0.06] text-ink hover:bg-white/10",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", dipilih ? "bg-[#fff]" : "bg-white/15")}
                      >
                        {dipilih && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                      </span>
                      <span className="min-w-0 break-words">{o.text}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <label className="sr-only" htmlFor={`es-${s.id}`}>
                  Jawaban soal {i + 1}
                </label>
                <textarea
                  id={`es-${s.id}`}
                  value={jawaban[s.id] ?? ""}
                  onChange={(e) => setJawaban((j) => ({ ...j, [s.id]: e.target.value }))}
                  maxLength={MAX_JAWABAN_ESAI}
                  rows={5}
                  disabled={pending}
                  placeholder="Tulis jawaban Anda"
                  className="block w-full resize-y bg-white/[0.06] px-4 py-3 text-[15px] leading-[1.7] text-ink outline-none placeholder:text-ink-muted shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
                />
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {terjawab < soal.length ? `${soal.length - terjawab} soal belum dijawab.` : "Semua soal sudah dijawab."}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => setKonfirmasi(true)}
          className="bg-blue-600 px-8 py-3 text-sm font-semibold text-[#fff] transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Mengumpulkan…" : "Kumpulkan quiz"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={konfirmasi}
        title="Kumpulkan quiz sekarang?"
        description={
          terjawab < soal.length
            ? `Masih ada ${soal.length - terjawab} soal yang belum dijawab. Setelah dikumpulkan, jawaban tidak bisa diubah.`
            : "Setelah dikumpulkan, jawaban tidak bisa diubah."
        }
        confirmLabel="Kumpulkan"
        onConfirm={kumpulkan}
        onCancel={() => setKonfirmasi(false)}
      />
    </div>
  );
}
