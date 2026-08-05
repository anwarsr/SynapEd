"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAsEducator } from "@/lib/educatorActions";
import type { ActionResult } from "@/lib/educatorActions";
import { cn } from "@/lib/cn";

/**
 * Tombol pengajuan educator.
 *
 * Otorisasinya ada di server action, bukan di sini — tombol yang disembunyikan
 * bukan pengaman. Komponen ini hanya mengurus keadaan menunggu dan pesan hasil.
 */
export default function ApplyButton({
  label = "Ajukan Sekarang",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function submit() {
    setResult(null);
    startTransition(async () => {
      const res = await applyAsEducator();
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div>
      <button
        onClick={submit}
        disabled={pending}
        className={cn(
          "rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white",
          "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
          "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
          className,
        )}
      >
        {pending ? "Mengirim…" : label}
      </button>

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
