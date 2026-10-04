"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gradeClassSubmission } from "@/lib/classAssignmentActions";
import { MAX_CLASS_FEEDBACK } from "@/lib/classAssignmentRules";
import { cn } from "@/lib/cn";

const KOLOM = cn(
  "w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200",
  "placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
);

/**
 * Nilai + komentar untuk satu pengiriman tugas kelas.
 *
 * Nilai lama menjadi isian awal, jadi memperbaiki nilai tidak perlu mengetik
 * ulang komentarnya. Kolom kosong ditolak di sini karena `Number("")` = 0 —
 * tanpa pemeriksaan ini, menekan Simpan tanpa mengisi memberi nilai nol.
 */
export default function ClassGradeForm({
  classId,
  postId,
  studentUid,
  maxPoints,
  grade,
  feedback,
}: {
  classId: string;
  postId: string;
  studentUid: string;
  maxPoints: number;
  grade: number | null;
  feedback: string | null;
}) {
  const router = useRouter();
  const [nilai, setNilai] = useState(grade === null ? "" : String(grade));
  const [catatan, setCatatan] = useState(feedback ?? "");
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

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

  return (
    <form onSubmit={simpan} className="mt-4 border-t border-rule pt-4">
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
        className="mt-3 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
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
