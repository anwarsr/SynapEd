"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMyReferralCode } from "@/lib/referralActions";
import { REFERRAL_CODE_MAX, normalizeReferralCode, validateReferralCode } from "@/lib/referralRules";

/** Membuat kode referral. Hanya muncul untuk akun yang belum punya kode. */
export default function ReferralCodeForm({ suggestion }: { suggestion: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kode = normalizeReferralCode(value);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salah = validateReferralCode(kode);
    if (salah) return setError(salah);

    setError(null);
    setPending(true);
    try {
      const res = await createMyReferralCode(kode);
      if (!res.ok) return setError(res.error);
      router.refresh();
    } catch {
      setError("Gagal menyimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="my-referral-code" className="block t-label text-ink-muted mb-2">
        Kode referral Anda
      </label>
      <div className="flex max-w-md flex-wrap gap-3">
        <input
          id="my-referral-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={REFERRAL_CODE_MAX}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="MISALNYA BUDI2026"
          className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm uppercase tracking-wide text-ink placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
        />
        <button
          type="submit"
          disabled={pending || kode === ""}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Membuat…" : "Buat Kode"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Huruf dan angka, 4–{REFERRAL_CODE_MAX} karakter. <strong className="font-semibold">Kode tidak bisa diganti</strong>{" "}
        setelah dibuat, karena tautan yang sudah Anda bagikan memuatnya.
      </p>
      {error && <p className="mt-2 text-sm text-rust-700">{error}</p>}
    </form>
  );
}
