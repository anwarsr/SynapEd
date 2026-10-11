"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeSubmission } from "@/lib/submissionActions";
import { suggestGrade } from "@/lib/gradingActions";
import { cn } from "@/lib/cn";

/**
 * Memberi nilai pada satu pengumpulan.
 *
 * Nilai lama diisi sebagai nilai awal supaya educator bisa memperbaikinya
 * tanpa mengetik ulang — dan supaya terlihat bahwa tugas ini memang sudah
 * pernah dinilai.
 */
export default function GradeForm({
  id,
  passingGrade,
  grade,
  feedback,
}: {
  id: string;
  passingGrade: number;
  grade: number | null;
  feedback: string | null;
}) {
  const router = useRouter();

  const [nilai, setNilai] = useState(grade === null ? "" : String(grade));
  const [catatan, setCatatan] = useState(feedback ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // State AI TERPISAH dari state simpan di atas, supaya dua aksi ini tidak
  // saling menimpa pesan pending/galat masing-masing.
  const [aiPending, startAiTransition] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);

  const angka = Number(nilai);
  const lulus = nilai !== "" && Number.isFinite(angka) && angka >= passingGrade;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    startTransition(async () => {
      const res = await gradeSubmission(id, angka, catatan);
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      router.refresh();
    });
  }

  function askAi() {
    setAiError(null);
    startAiTransition(async () => {
      const res = await suggestGrade(id);
      if (!res.ok) return setAiError(res.error);
      // Hanya mengisi kolom — TIDAK memanggil gradeSubmission. Educator tetap
      // harus meninjau lalu menekan tombol Simpan/Perbarui Nilai sendiri.
      setNilai(String(res.grade));
      setCatatan(res.feedback);
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-rule pt-4">
      <div className="mb-4">
        <button
          type="button"
          onClick={askAi}
          disabled={aiPending || pending}
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium text-ink-body transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {aiPending ? "Meminta saran AI…" : "Minta Saran AI"}
        </button>
        <p className="mt-1 text-xs text-ink-faint">
          Saran AI mengisi kolom di bawah - tinjau dan sunting sebelum menyimpan.
        </p>
        {aiError && <p className="mt-2 text-sm text-rust-700">{aiError}</p>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label htmlFor={`nilai-${id}`} className="block t-label text-ink-muted mb-2">
            Nilai
          </label>
          <input
            id={`nilai-${id}`}
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            required
          />
        </div>

        <span
          className={cn(
            "pb-3 text-xs",
            nilai === "" ? "text-ink-faint" : lulus ? "text-blue-700" : "text-rust-700",
          )}
        >
          {nilai === ""
            ? `Minimum lulus ${passingGrade}`
            : lulus
              ? "Lulus - sertifikat bisa terbit"
              : `Di bawah ${passingGrade} - sertifikat tertahan`}
        </span>
      </div>

      <label htmlFor={`catatan-${id}`} className="block t-label text-ink-muted mt-4 mb-2">
        Catatan untuk peserta
      </label>
      <textarea
        id={`catatan-${id}`}
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Opsional. Dibaca peserta di halaman pelajarannya."
        className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 resize-y placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
      >
        {pending ? "Menyimpan…" : grade === null ? "Simpan Nilai" : "Perbarui Nilai"}
      </button>

      {error && <p className="mt-3 text-sm text-rust-700">{error}</p>}
      {done && <p className="mt-3 text-sm text-blue-700">{done}</p>}
    </form>
  );
}
