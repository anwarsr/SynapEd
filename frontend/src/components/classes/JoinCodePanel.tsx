"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { regenerateJoinCode } from "@/lib/classActions";
import { cn } from "@/lib/cn";

/**
 * Panel kode undangan — HANYA dirender untuk pemilik kelas.
 *
 * Bingkainya `border-rule-strong`, satu langkah lebih tegas dari kartu lain di
 * kolom yang sama: ini satu-satunya kartu di halaman yang isinya rahasia.
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
    // dan tidak boleh membuat panel ini tampak rusak — kodenya tetap terbaca
    // di layar dan masih bisa disalin manual.
    try {
      await navigator.clipboard.writeText(joinCode);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setError("Gagal menyalin. Silakan salin kodenya secara manual.");
    }
  }

  const tombol = cn(
    "bg-white/10 px-4 py-2.5 text-sm font-medium text-ink-body",
    "transition-colors duration-200 hover:bg-white/15 hover:text-white",
    "disabled:opacity-60 disabled:cursor-not-allowed",
  );

  return (
    <div className="bg-paper-card p-6">
      <p className="t-label text-ink-muted mb-3">Kode undangan</p>

      <p className="bg-white/5 py-4 text-center font-sans tabular-nums text-2xl tracking-[0.22em] text-ink">
        {joinCode}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={salin} className={tombol}>
          {tersalin ? "Tersalin" : "Salin"}
        </button>

        <button type="button" onClick={() => setOpen(true)} disabled={pending} className={tombol}>
          {pending ? "Mengganti…" : "Ganti kode"}
        </button>
      </div>

      <p className="mt-4 flex gap-2.5 text-xs leading-[1.6] text-ink-muted">
        <span
          aria-hidden="true"
          className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full bg-amber-500"
        />
        <span>
          Siapa pun yang memegang kode ini bisa bergabung dan membaca seluruh isi kelas.
          Bagikan hanya kepada peserta Anda. Ganti kodenya untuk menutup pendaftaran -
          anggota yang sudah masuk tidak terpengaruh.
        </span>
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
