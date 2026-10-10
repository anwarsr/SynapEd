"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRevenueSettings } from "@/lib/paymentSettingsActions";
import { referralAmountOf, splitSale } from "@/lib/royaltySplit";
import { validateRevenueSplit } from "@/lib/royaltyTerms";
import { formatPrice } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

const CONTOH = 100_000;

function PercentInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block t-label text-ink-muted mb-2">
        {label}
      </label>
      <div className="flex items-center bg-white/[0.06] shadow-[inset_0_-1px_0_var(--color-rule)] focus-within:shadow-[inset_0_-2px_0_var(--color-blue-400)]">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 bg-transparent px-4 py-2.5 text-sm text-ink tabular-nums focus:outline-none"
        />
        <span className="pr-4 text-sm text-ink-muted">%</span>
      </div>
    </div>
  );
}

/** Potongan platform & bagian referral — disimpan sebagai satu pasangan. */
export default function PlatformFeeForm({ initialFee, initialReferral }: { initialFee: number; initialReferral: number }) {
  const router = useRouter();
  const [fee, setFee] = useState(String(initialFee));
  const [referral, setReferral] = useState(String(initialReferral));
  const [saved, setSaved] = useState({ fee: initialFee, referral: initialReferral });
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const f = fee.trim() === "" ? NaN : Number(fee);
  const r = referral.trim() === "" ? NaN : Number(referral);
  const salah = validateRevenueSplit(f, r);
  const berubah = f !== saved.fee || r !== saved.referral;

  const contoh = salah === null ? splitSale(CONTOH, f, null) : null;
  const bagianReferral = contoh ? referralAmountOf(CONTOH, contoh.feeAmount, r) : 0;

  function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (salah) {
      setStatus({ ok: false, msg: salah });
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const res = await updateRevenueSettings({ platformFeePercent: f, referralPercent: r });
      if (res.ok) {
        setSaved({ fee: f, referral: r });
        router.refresh();
      }
      setStatus(res.ok ? { ok: true, msg: res.message } : { ok: false, msg: res.error });
    });
  }

  return (
    <form onSubmit={simpan} className="bg-paper-card p-7">
      <h2 className="t-h3 mb-1.5">Potongan platform &amp; referral</h2>
      <p className="t-body text-sm text-ink-muted mb-6">
        Potongan platform diambil dari setiap penjualan; sisanya dibagi ke kontributor. Bila pembeli
        memakai kode referral, bagian perujuk dibayar DARI potongan itu - jadi tidak boleh lebih
        besar. Perubahan hanya berlaku untuk pesanan yang dibuat setelah disimpan.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <PercentInput id="platform-fee" label="Potongan platform" value={fee} onChange={setFee} />
        <PercentInput id="referral-percent" label="Bagian referral" value={referral} onChange={setReferral} />

        <button
          type="submit"
          disabled={pending || salah !== null || !berubah}
          className=" bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>

      {salah && fee.trim() !== "" && referral.trim() !== "" && (
        <p className="mt-4 text-sm text-rust-700">{salah}</p>
      )}

      {contoh && (
        <div className="mt-4 space-y-1 text-xs text-ink-muted">
          <p>
            Dari penjualan {formatPrice(CONTOH)} tanpa referral: SynapEd {formatPrice(contoh.feeAmount)} ·
            kontributor {formatPrice(contoh.unallocatedAmount)}
          </p>
          <p>
            Dengan referral: perujuk {formatPrice(bagianReferral)} · SynapEd{" "}
            {formatPrice(contoh.feeAmount - bagianReferral)} · kontributor {formatPrice(contoh.unallocatedAmount)}
          </p>
        </div>
      )}

      {status && (
        <p
          role="status"
          className={cn(
            "mt-4  px-4 py-3 text-sm",
            status.ok
              ? "bg-blue-50 text-blue-700 border border-blue-100"
              : "bg-rust-100 text-rust-700",
          )}
        >
          {status.msg}
        </p>
      )}
    </form>
  );
}
