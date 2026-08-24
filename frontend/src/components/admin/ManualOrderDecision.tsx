"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideManualOrder } from "@/lib/manualPaymentActions";

/**
 * Menyetujui atau menolak satu pembayaran QRIS manual.
 *
 * Alasan wajib untuk penolakan, opsional untuk persetujuan — sejalan dengan
 * DecisionButtons pada pengajuan educator. Pembeli berhak tahu kenapa
 * pembayarannya ditolak; persetujuan tidak butuh penjelasan apa pun.
 */
export default function ManualOrderDecision({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const res = await decideManualOrder(orderId, decision, note);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-rule pt-4">
      <label htmlFor={`catatan-${orderId}`} className="block t-label text-ink-muted mb-2">
        Catatan
      </label>
      <textarea
        id={`catatan-${orderId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Wajib diisi kalau menolak — pembeli membacanya."
        className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 resize-y placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
      />

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => decide("approve")}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Memproses…" : "Uang Sudah Masuk — Buka Akses"}
        </button>

        <button
          type="button"
          onClick={() => decide("reject")}
          disabled={pending}
          className="rounded-lg border border-rust-700/30 px-6 py-2.5 text-sm font-semibold text-rust-700 transition-colors duration-200 ease-out-soft hover:bg-rust-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Tolak
        </button>
      </div>

      {error && (
        <p role="status" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </div>
  );
}
