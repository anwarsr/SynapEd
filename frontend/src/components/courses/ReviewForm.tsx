"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { STAR_PATH } from "@/components/ui/Stars";
import { deleteMyReview, submitReview } from "@/lib/reviewActions";
import { cn } from "@/lib/cn";

/**
 * Formulir ulasan, hanya dirender untuk peserta yang sudah menyelesaikan
 * kursusnya.
 *
 * Penjaga sebenarnya ada di submitReview() di server — komponen ini cuma
 * menentukan apa yang terlihat. Menyembunyikan formulir bukan pengamanan:
 * Server Action tetap bisa dipanggil lewat POST langsung.
 */
export default function ReviewForm({
  slug,
  initial,
}: {
  slug: string;
  /** Ulasan yang sudah pernah ditulis orang ini, kalau ada. */
  initial: { rating: number; comment: string } | null;
}) {
  const router = useRouter();

  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? "");

  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Bintang yang terlihat mengikuti kursor selama disorot, supaya terasa
  // hidup sebelum diklik.
  const tampil = hover || rating;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    if (rating === 0) {
      setError("Pilih dulu berapa bintang.");
      return;
    }

    startTransition(async () => {
      const res = await submitReview(slug, rating, comment);
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      router.refresh();
    });
  }

  function hapus() {
    setAsking(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteMyReview(slug);
      if (!res.ok) return setError(res.error);
      setRating(0);
      setComment("");
      setDone(res.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h3 className="t-h3 text-lg mb-1.5">
        {initial ? "Ulasan Anda" : "Bagaimana kursus ini menurut Anda?"}
      </h3>
      <p className="t-body text-sm text-ink-muted mb-5">
        {initial
          ? "Anda bisa mengubahnya kapan saja — yang tersimpan hanya versi terakhir."
          : "Anda sudah menyelesaikan kursus ini, jadi ulasan Anda akan tampil di halaman ini."}
      </p>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}
      {done && (
        <div role="status" className="mb-4 rounded-lg border border-blue-500/25 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {done}
        </div>
      )}

      {/* Tombol sungguhan, bukan bintang yang bisa diklik lewat onClick pada
          <svg>: dengan <button> keyboard dan pembaca layar ikut terlayani. */}
      <div className="flex items-center gap-1 mb-5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            disabled={pending}
            aria-label={`Beri ${s} dari 5 bintang`}
            aria-pressed={rating === s}
            className="rounded-md p-0.5 transition-transform duration-150 hover:scale-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg
              className={cn("w-8 h-8", s <= tampil ? "text-amber-500" : "text-white/20")}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d={STAR_PATH} />
            </svg>
          </button>
        ))}

        <span className="ml-2 text-sm text-ink-muted">
          {tampil > 0 ? `${tampil} dari 5` : "Belum dipilih"}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        maxLength={1000}
        disabled={pending}
        placeholder="Ceritakan pengalaman Anda mengikuti kursus ini."
        className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 resize-y placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-ink-muted">Minimal 10 karakter. {comment.length}/1000.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : initial ? "Perbarui Ulasan" : "Kirim Ulasan"}
        </button>

        {initial && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            disabled={pending}
            className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-rust-700/40 hover:text-rust-700 disabled:opacity-60"
          >
            Hapus Ulasan
          </button>
        )}
      </div>

      <ConfirmDialog
        open={asking}
        title="Hapus ulasan Anda?"
        description="Ulasan ini akan hilang dari halaman kursus dan dari beranda."
        note="Anda tetap bisa menulis ulasan baru kapan saja."
        confirmLabel="Ya, Hapus"
        onConfirm={hapus}
        onCancel={() => setAsking(false)}
      />
    </form>
  );
}
