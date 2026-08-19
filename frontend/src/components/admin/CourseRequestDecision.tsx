"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { decideCourseRequest } from "@/lib/courseRequestActions";
import { inputClass } from "@/components/educator/fields";
import { cn } from "@/lib/cn";

/**
 * Tombol setuju / tolak untuk satu pengajuan perubahan kursus.
 *
 * Catatan admin WAJIB saat menolak, opsional saat menyetujui. Penolakan tanpa
 * penjelasan memaksa educator menebak apa yang harus dibetulkan, lalu
 * mengajukan ulang hal yang sama — dan admin menolaknya lagi.
 */
export default function CourseRequestDecision({
  id,
  type,
  courseTitle,
}: {
  id: string;
  type: string;
  courseTitle: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState<"approve" | "reject" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setAsking(null);
    setPending(true);
    setError(null);

    const res = await decideCourseRequest(id, decision, note);
    setPending(false);

    if (!res.ok) return setError(res.error);
    router.push("/admin/course-requests");
    router.refresh();
  }

  return (
    <div>
      <label htmlFor="note" className="t-label block mb-2">
        Catatan untuk educator
      </label>
      <p className="text-xs text-ink-muted mb-3">
        Wajib diisi bila menolak, agar educator tahu apa yang perlu dibetulkan.
      </p>
      <textarea
        id="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Contoh: Deskripsi modul 2 masih menyebut harga lama."
        className={cn(inputClass, "resize-y mb-5")}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking("approve")}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Memproses…" : "Setujui"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking("reject")}
          className="rounded-lg border border-rust-700/40 px-6 py-2.5 text-sm font-medium text-rust-700 transition-colors hover:bg-rust-100 disabled:opacity-60"
        >
          Tolak
        </button>
      </div>

      {error && (
        <p role="status" className="mt-4 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={asking === "approve"}
        title="Setujui pengajuan ini?"
        description={`Perubahan pada "${courseTitle}" akan langsung diterapkan.`}
        note={
          type === "delete"
            ? "Kursus beserta materinya akan dihapus permanen."
            : "Perubahan langsung terlihat oleh peserta."
        }
        confirmLabel="Ya, Setujui"
        onConfirm={() => decide("approve")}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "reject"}
        title="Tolak pengajuan ini?"
        description={`Kursus "${courseTitle}" tidak berubah, dan educator akan melihat catatan Anda.`}
        confirmLabel="Ya, Tolak"
        onConfirm={() => decide("reject")}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
