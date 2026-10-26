"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Dialog konfirmasi bergaya SynapEd, menggantikan window.confirm.
 *
 * Dibangun di atas elemen <dialog> asli, bukan div bertumpuk: dengan
 * showModal(), browser sendiri yang mengurus jebakan fokus, tombol Esc,
 * lapisan teratas, dan menonaktifkan sisa halaman. Menirunya dengan div
 * berarti menulis ulang semua itu — dan biasanya salah satu terlewat.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  note,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Peringatan yang perlu menonjol, misalnya keputusan yang permanen. */
  note?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Esc memicu event "cancel" — diteruskan supaya keadaan di induk
      // ikut tertutup, kalau tidak dialog tidak bisa dibuka lagi.
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      // Klik di luar panel: <dialog> menerima klik backdrop pada dirinya
      // sendiri, jadi cukup periksa apakah sasarannya elemen dialog.
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      className={cn(
        "dialog-panel m-auto w-[min(28rem,calc(100vw-2rem))] p-0",
        "bg-paper-card shadow-lift",
        "text-ink",
      )}
    >
      <div className="p-7">
        <h2 id="confirm-title" className="t-h3 text-lg mb-2.5">
          {title}
        </h2>

        <p id="confirm-desc" className="t-body text-sm text-ink-body">
          {description}
        </p>

        {note && (
          <p className="mt-4 bg-amber-100 px-4 py-3 text-sm text-amber-700">
            {note}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          {/* Batal yang menerima fokus awal: aksi yang tidak bisa ditarik
              kembali tidak pantas dipicu oleh satu ketukan Enter refleks. */}
          <button
            autoFocus
            onClick={onCancel}
            className="bg-white/[0.07] px-5 py-2.5 text-sm font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-colors duration-300 hover:bg-white/[0.13] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="bg-blue-600 px-6 py-2.5 text-sm font-semibold text-[#fff] transition-colors duration-300 hover:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
