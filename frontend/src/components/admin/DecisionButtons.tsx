"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { decideApplication } from "@/lib/educatorActions";
import type { ActionResult } from "@/lib/educatorActions";
import { cn } from "@/lib/cn";

/**
 * Tombol keputusan admin atas satu pengajuan educator.
 *
 * Dipakai di dua tempat — daftar notifikasi dan detail akun — supaya admin
 * tidak perlu berpindah halaman hanya untuk memutuskan.
 *
 * Otorisasinya ada di server action; komponen ini hanya mengurus konfirmasi,
 * keadaan menunggu, dan menampilkan hasilnya.
 */
export default function DecisionButtons({ uid, name }: { uid: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  // Keduanya dikonfirmasi: menerima tidak bisa ditarik kembali, dan menolak
  // pun mengunci pengajuan itu selamanya.
  const [asking, setAsking] = useState<"accept" | "reject" | null>(null);

  function decide(decision: "accept" | "reject") {
    setAsking(null);
    setResult(null);

    startTransition(async () => {
      const res = await decideApplication(uid, decision);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setAsking("accept")}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Memproses…" : "Terima"}
        </button>
        <button
          onClick={() => setAsking("reject")}
          disabled={pending}
          className="rounded-lg border border-rust-700/30 px-6 py-2.5 text-sm font-semibold text-rust-700 transition-colors duration-200 ease-out-soft hover:bg-rust-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Tolak
        </button>
      </div>

      <ConfirmDialog
        open={asking === "accept"}
        title="Jadikan educator?"
        description={`${name} akan menjadi educator dan dapat membuat kursusnya sendiri.`}
        note="Keputusan ini permanen dan tidak dapat dibatalkan."
        confirmLabel="Ya, Terima"
        onConfirm={() => decide("accept")}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "reject"}
        title="Tolak pengajuan?"
        description={`Pengajuan ${name} akan ditolak dan statusnya tetap pengguna biasa.`}
        note="Keputusan tidak dapat diubah, tetapi yang bersangkutan boleh mengajukan lagi."
        confirmLabel="Ya, Tolak"
        onConfirm={() => decide("reject")}
        onCancel={() => setAsking(null)}
      />

      {result && (
        <p
          role="status"
          className={cn(
            "mt-4 rounded-lg px-4 py-3 text-sm border",
            result.ok
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-rust-100 text-rust-700 border-rust-700/25",
          )}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
