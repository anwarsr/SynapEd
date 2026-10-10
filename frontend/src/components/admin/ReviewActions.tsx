"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteReview } from "@/lib/reviewActions";

/**
 * Tombol hapus ulasan di panel admin.
 *
 * Tidak ada tombol sunting, dan itu disengaja: mengubah kata-kata orang lalu
 * tetap menampilkannya atas nama mereka jauh lebih buruk daripada
 * menghapusnya. Yang bermasalah dibuang, tidak ditulis ulang.
 */
export default function DeleteReviewButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const res = await deleteReview(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        aria-label={`Hapus ulasan dari ${name}`}
        className="shrink-0  p-2 text-ink-faint transition-colors duration-200 hover:bg-rust-100 hover:text-rust-700 disabled:opacity-40"
      >
        {pending ? (
          <span className="text-xs">…</span>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" />
          </svg>
        )}
      </button>

      <ConfirmDialog
        open={asking}
        title="Hapus ulasan ini?"
        description={`Ulasan dari ${name} akan hilang dari halaman kursus dan dari beranda.`}
        note="Rata-rata bintang kursusnya ikut dihitung ulang. Peserta tetap bisa menulis ulasan baru."
        confirmLabel="Ya, Hapus"
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />

      {error && (
        <p role="status" className="w-full text-sm text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}
