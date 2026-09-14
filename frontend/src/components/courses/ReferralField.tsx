"use client";
import { createContext, useContext, useState } from "react";
import { checkReferralCode } from "@/lib/referralActions";
import { REFERRAL_CODE_MAX } from "@/lib/referralRules";
import { cn } from "@/lib/cn";

interface Applied {
  code: string;
  referrerName: string | null;
}

const ReferralContext = createContext<{
  applied: Applied | null;
  setApplied: (a: Applied | null) => void;
}>({ applied: null, setApplied: () => undefined });

/**
 * Kode referral yang SUDAH diterapkan, dibagi ke tombol Midtrans dan panel
 * QRIS. Keduanya saudara di halaman server, jadi keadaannya diangkat ke sini.
 *
 * Kode yang baru diketik tapi belum diterapkan tidak ikut terkirim — pembeli
 * harus melihat konfirmasinya dulu.
 */
export function ReferralProvider({ initial, children }: { initial: Applied | null; children: React.ReactNode }) {
  const [applied, setApplied] = useState<Applied | null>(initial);
  return <ReferralContext.Provider value={{ applied, setApplied }}>{children}</ReferralContext.Provider>;
}

/** Kode yang dikirim ke pembuatan pesanan; string kosong = tanpa referral. */
export function useReferralCode(): string {
  return useContext(ReferralContext).applied?.code ?? "";
}

export default function ReferralField({ referralPercent }: { referralPercent: number }) {
  const { applied, setApplied } = useContext(ReferralContext);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function terapkan() {
    setError(null);
    setPending(true);
    try {
      const res = await checkReferralCode(value);
      if (!res.ok) return setError(res.error);
      if (!res.code) return setError("Masukkan kode referral.");
      setApplied({ code: res.code, referrerName: res.referrerName });
      setValue("");
      setOpen(false);
    } catch {
      setError("Kode gagal diperiksa. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (applied) {
    return (
      <div className="rounded-lg border border-blue-500/25 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <p>
          Kode referral <strong className="font-semibold">{applied.code}</strong> diterapkan
          {applied.referrerName ? ` — dari ${applied.referrerName}` : ""}.
        </p>
        <p className="mt-1 text-xs">
          Harga tidak berubah; {referralPercent}% dari pembelian ini menjadi komisi perujuk.{" "}
          <button type="button" onClick={() => setApplied(null)} className="underline underline-offset-2 hover:text-blue-800">
            Hapus kode
          </button>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-blue-700 hover:underline underline-offset-4"
      >
        Punya kode referral?
      </button>
    );
  }

  return (
    <div>
      <label htmlFor="referral-code" className="block t-label text-ink-muted mb-2">
        Kode referral
      </label>
      <div className="flex gap-2">
        <input
          id="referral-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void terapkan();
            }
          }}
          maxLength={REFERRAL_CODE_MAX}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="KODE"
          className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2.5 text-sm uppercase tracking-wide text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
        />
        <button
          type="button"
          onClick={terapkan}
          disabled={pending || value.trim() === ""}
          className={cn(
            "rounded-lg border border-rule px-4 text-sm font-medium text-ink",
            "transition-colors duration-200 hover:border-blue-500 hover:text-blue-700",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "…" : "Terapkan"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rust-700">{error}</p>}
    </div>
  );
}
