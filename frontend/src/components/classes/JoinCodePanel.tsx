"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { regenerateJoinCode } from "@/lib/classActions";
import { cn } from "@/lib/cn";

/**
 * Panel kode undangan — HANYA dirender untuk pemilik kelas.
 *
 * Peringatannya bukan hiasan. Kode ini kunci pembawa tanpa masa berlaku:
 * siapa pun yang memegangnya menjadi anggota dan bisa membaca seluruh isi
 * kelas, tanpa persetujuan pemiliknya. Orang yang tidak diberi tahu hal itu
 * akan menempelkannya di grup terbuka.
 */
export default function JoinCodePanel({
  classId,
  joinCode,
}: {
  classId: string;
  joinCode: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);

  function ganti() {
    setOpen(false);
    setError(null);

    startTransition(async () => {
      const res = await regenerateJoinCode(classId);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  async function salin() {
    // Clipboard API butuh konteks aman dan izin; kegagalannya wajar terjadi
    // dan tidak boleh membuat panel ini tampak rusak — kodenya tetap terbaca.
    try {
      await navigator.clipboard.writeText(joinCode);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setError("Gagal menyalin. Silakan salin kodenya secara manual.");
    }
  }

  return (
    <div className="bg-paper-card border border-rule rounded-2xl p-6">
      <p className="t-label text-ink-muted mb-2">Kode undangan</p>

      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-paper-alt border border-rule px-4 py-2.5 font-mono text-lg tracking-[0.2em] text-ink">
          {joinCode}
        </code>

        <button
          type="button"
          onClick={salin}
          className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
        >
          {tersalin ? "Tersalin" : "Salin"}
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className={cn(
            "rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body",
            "transition-colors duration-200 hover:border-blue-500 hover:text-blue-700",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "Mengganti…" : "Ganti kode"}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Siapa pun yang memegang kode ini bisa bergabung dan membaca seluruh isi kelas.
        Bagikan hanya kepada peserta Anda. Ganti kodenya untuk menutup pendaftaran —
        anggota yang sudah masuk tidak terpengaruh.
      </p>

      <ConfirmDialog
        open={open}
        title="Ganti kode undangan?"
        description="Kode lama langsung tidak berlaku. Siapa pun yang sudah memegangnya tidak bisa lagi bergabung."
        confirmLabel="Ganti kode"
        onConfirm={ganti}
        onCancel={() => setOpen(false)}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </div>
  );
}
