"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlatformFee } from "@/lib/paymentSettingsActions";
import { splitSale } from "@/lib/royaltySplit";
import { formatPrice } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

const CONTOH = 100_000;

export default function PlatformFeeForm({ initial }: { initial: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initial));
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const angka = Number(value);
  const sah = value.trim() !== "" && Number.isInteger(angka) && angka >= 0 && angka <= 100;
  const contoh = sah ? splitSale(CONTOH, angka, null) : null;

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!sah) {
      setStatus({ ok: false, msg: "Potongan harus bilangan bulat antara 0 dan 100." });
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const res = await updatePlatformFee(angka);
      if (res.ok) {
        setSaved(angka);
        router.refresh();
      }
      setStatus(res.ok ? { ok: true, msg: res.message } : { ok: false, msg: res.error });
    });
  }

  return (
    <form onSubmit={simpan} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Potongan platform</h2>
      <p className="t-body text-sm text-ink-muted mb-6">
        Persentase dari setiap penjualan kursus yang menjadi bagian SynapEd. Sisanya dibagi ke
        kontributor. Perubahan hanya berlaku untuk pesanan yang dibuat setelah disimpan.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="platform-fee" className="block t-label text-ink-muted mb-2">
            Potongan
          </label>
          <div className="flex items-center rounded-lg border border-rule bg-paper focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
            <input
              id="platform-fee"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 bg-transparent px-4 py-2.5 text-sm text-ink tabular-nums focus:outline-none"
            />
            <span className="pr-4 text-sm text-ink-muted">%</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending || !sah || angka === saved}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : "Simpan Potongan"}
        </button>
      </div>

      {contoh && (
        <p className="mt-4 text-xs text-ink-muted">
          Dari penjualan {formatPrice(CONTOH)}: SynapEd {formatPrice(contoh.feeAmount)} · kontributor{" "}
          {formatPrice(contoh.unallocatedAmount)}
        </p>
      )}

      {status && (
        <p
          role="status"
          className={cn(
            "mt-4 rounded-lg px-4 py-3 text-sm",
            status.ok
              ? "bg-blue-50 text-blue-700 border border-blue-100"
              : "bg-rust-100 text-rust-700 border border-rust-700/25",
          )}
        >
          {status.msg}
        </p>
      )}
    </form>
  );
}
