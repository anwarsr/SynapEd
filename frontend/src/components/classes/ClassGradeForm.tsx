"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeClassSubmission } from "@/lib/classAssignmentActions";
import { suggestClassGrade } from "@/lib/classGradingActions";
import { MAX_CLASS_FEEDBACK } from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

const KOLOM = cn(
  "w-full bg-white/[0.06] px-4 py-2.5 text-sm text-ink transition-colors duration-200",
  "placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]",
);

/**
 * Nilai + komentar untuk satu pengiriman tugas kelas.
 *
 * Nilai lama menjadi isian awal, jadi memperbaiki nilai tidak perlu mengetik
 * ulang komentarnya. Kolom kosong ditolak di sini karena `Number("")` = 0 —
 * tanpa pemeriksaan ini, menekan Simpan tanpa mengisi memberi nilai nol.
 *
 * "Koreksi dengan AI" hanya MENGISI kolom — tidak pernah menyimpan. Pengajar
 * tetap meninjau, boleh mengubah, lalu menekan Simpan sendiri. Bila AI tidak
 * diminta mengisi komentar, catatannya tetap ditampilkan sebagai petunjuk
 * (alasan di balik nilainya) dengan tombol untuk memakainya.
 */
export default function ClassGradeForm({
  classId,
  postId,
  studentUid,
  maxPoints,
  grade,
  feedback,
  aiIsiKomentar,
}: {
  classId: string;
  postId: string;
  studentUid: string;
  maxPoints: number;
  grade: number | null;
  feedback: string | null;
  /** Bawaan centang "isi komentar juga", dari pengaturan Koreksi AI tugas ini. */
  aiIsiKomentar: boolean;
}) {
  const router = useRouter();
  const [nilai, setNilai] = useState(grade === null ? "" : String(grade));
  const [catatan, setCatatan] = useState(feedback ?? "");
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  // State AI terpisah dari state simpan, supaya pesan keduanya tidak saling timpa.
  const [isiKomentar, setIsiKomentar] = useState(aiIsiKomentar);
  const [aiPending, startAi] = useTransition();
  const [aiPesan, setAiPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [catatanAi, setCatatanAi] = useState<string | null>(null);
  const [peringatan, setPeringatan] = useState<string[]>([]);

  const idNilai = `nilai-${studentUid}`;
  const idCatatan = `komentar-${studentUid}`;

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);
    if (nilai.trim() === "") return setPesan({ ok: false, teks: "Isi nilainya dulu." });

    startTransition(async () => {
      const res = await gradeClassSubmission(classId, postId, studentUid, Number(nilai), catatan);
      setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
      if (res.ok) router.refresh();
    });
  }

  function koreksiAi() {
    setAiPesan(null);
    setCatatanAi(null);
    setPeringatan([]);
    startAi(async () => {
      const res = await suggestClassGrade(classId, postId, studentUid);
      if (!res.ok) return setAiPesan({ ok: false, teks: res.error });

      setNilai(String(res.grade));
      if (isiKomentar) setCatatan(res.feedback);
      else setCatatanAi(res.feedback || null);
      setPeringatan(res.peringatan);
      setAiPesan({ ok: true, teks: "Saran AI sudah diisi. Periksa, ubah bila perlu, lalu simpan." });
    });
  }

  return (
    <form onSubmit={simpan} className="mt-4 border-t pt-4">
      <div className="mb-4 bg-white/[0.06] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={koreksiAi}
            disabled={aiPending || pending}
            className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            {aiPending ? "AI sedang mengoreksi…" : "Koreksi dengan AI"}
          </button>
          <label className="flex items-center gap-2 text-xs text-ink-body">
            <input
              type="checkbox"
              checked={isiKomentar}
              onChange={(e) => setIsiKomentar(e.target.checked)}
              disabled={aiPending}
              className="accent-blue-600"
            />
            AI juga mengisi komentar
          </label>
        </div>

        {aiPesan && (
          <p role="status" className={cn("mt-2 text-xs", aiPesan.ok ? "text-blue-700" : "text-rust-700")}>
            {aiPesan.teks}
          </p>
        )}
        {peringatan.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-700">
            {peringatan.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {catatanAi && (
          <div className="mt-3 bg-paper-alt px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Catatan AI (belum dipakai)</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-body">{catatanAi}</p>
            <button
              type="button"
              onClick={() => {
                setCatatan(catatanAi);
                setCatatanAi(null);
              }}
              className="mt-1.5 text-xs font-medium text-blue-700 hover:underline underline-offset-4"
            >
              Pakai sebagai komentar
            </button>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="w-28">
          <label htmlFor={idNilai} className="t-label mb-2 block text-ink-muted">
            Nilai
          </label>
          <input
            id={idNilai}
            type="number"
            min={0}
            max={maxPoints}
            step={1}
            inputMode="numeric"
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
            className={KOLOM}
          />
        </div>
        <span className="pb-3 text-sm text-ink-muted">/ {maxPoints}</span>
      </div>

      <label htmlFor={idCatatan} className="t-label mt-4 mb-2 block text-ink-muted">
        Komentar untuk siswa
      </label>
      <textarea
        id={idCatatan}
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        rows={2}
        maxLength={MAX_CLASS_FEEDBACK}
        placeholder="Opsional. Dibaca siswa di halaman tugasnya."
        className={cn(KOLOM, "resize-y")}
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-3 bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
      >
        {pending ? "Menyimpan…" : grade === null ? "Simpan nilai" : "Perbarui nilai"}
      </button>

      {pesan && (
        <p role="status" className={cn("mt-3 text-sm", pesan.ok ? "text-blue-700" : "text-rust-700")}>
          {pesan.teks}
        </p>
      )}
    </form>
  );
}
