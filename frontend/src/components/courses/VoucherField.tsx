"use client";
import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cekVoucher, klaimVoucherGratis } from "@/lib/voucherActions";
import { VOUCHER_KODE_MAKS, type PratinjauVoucher as Diterapkan } from "@/lib/voucherRules";
import { formatPrice } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

/** Hanya JENIS barang - harganya selalu dibaca server. */
export type SasaranBeli = { kind: "course"; slug: string } | { kind: "premium" };


const VoucherContext = createContext<{
  sasaran: SasaranBeli | null;
  applied: Diterapkan | null;
  setApplied: (a: Diterapkan | null) => void;
}>({ sasaran: null, applied: null, setApplied: () => undefined });

/**
 * Voucher yang SUDAH diterapkan, dibagi ke tombol Midtrans, panel QRIS, dan
 * gerbang voucher gratis (saudara di halaman server) - pola `ReferralProvider`.
 * Angka di sini hanya pratinjau: setiap pesanan menilai ulang kodenya di server.
 */
export function VoucherProvider({
  sasaran,
  initial = null,
  children,
}: {
  sasaran: SasaranBeli;
  /** Voucher pesanan QRIS yang masih hidup, supaya halaman yang dimuat ulang tidak "lupa" vouchernya. */
  initial?: Diterapkan | null;
  children: React.ReactNode;
}) {
  const [applied, setApplied] = useState<Diterapkan | null>(initial);
  return <VoucherContext.Provider value={{ sasaran, applied, setApplied }}>{children}</VoucherContext.Provider>;
}

/** Kode yang dikirim ke pembuatan pesanan; string kosong = tanpa voucher. */
export function useVoucherCode(): string {
  return useContext(VoucherContext).applied?.code ?? "";
}

export default function VoucherField() {
  const { sasaran, applied, setApplied } = useContext(VoucherContext);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function terapkan() {
    if (!sasaran) return;
    setError(null);
    setPending(true);
    try {
      const res = await cekVoucher(value, sasaran);
      if (!res.ok) return setError(res.error);
      setApplied({ code: res.code, harga: res.harga, potongan: res.potongan, akhir: res.akhir });
      setValue("");
      setOpen(false);
    } catch {
      setError("Voucher gagal diperiksa. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (applied) {
    return (
      <div className="bg-blue-500/15 px-4 py-3 text-sm text-blue-200">
        <p>
          Voucher <strong className="font-semibold">{applied.code}</strong> diterapkan - hemat{" "}
          <strong className="font-semibold">{formatPrice(applied.potongan)}</strong>.
        </p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 tabular-nums">
          <span className="text-blue-200/70 line-through">{formatPrice(applied.harga)}</span>
          <span className="text-base font-bold text-white">{applied.akhir === 0 ? "Gratis" : formatPrice(applied.akhir)}</span>
        </p>
        <p className="mt-1.5 text-xs">
          <button type="button" onClick={() => setApplied(null)} className="underline underline-offset-2 hover:text-blue-800">
            Hapus voucher
          </button>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm text-blue-700 underline-offset-4 hover:underline">
        Punya kode voucher?
      </button>
    );
  }

  return (
    <div>
      <label htmlFor="voucher-code" className="t-label mb-2 block text-ink-muted">
        Kode voucher
      </label>
      <div className="flex gap-2">
        <input
          id="voucher-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void terapkan();
            }
          }}
          maxLength={VOUCHER_KODE_MAKS}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="KODE"
          className="min-w-0 flex-1 bg-white/[0.06] px-3 py-2.5 text-sm uppercase tracking-wide text-ink placeholder:text-ink-faint focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none"
        />
        <button
          type="button"
          onClick={terapkan}
          disabled={pending || value.trim() === ""}
          className={cn(
            "bg-white/10 px-4 text-sm font-medium text-ink",
            "transition-colors duration-200 hover:bg-white/15 hover:text-white",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {pending ? "…" : "Terapkan"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rust-700">{error}</p>}
    </div>
  );
}

/**
 * Voucher yang menggratiskan penuh tidak bisa dibayar lewat Midtrans/QRIS
 * (Rp0), jadi tombol bayar diganti satu tombol "Ambil Gratis". Selain itu
 * anak-anaknya (tombol bayar) tampil seperti biasa.
 */
export function GerbangVoucher({ children }: { children: React.ReactNode }) {
  const { sasaran, applied } = useContext(VoucherContext);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  if (!sasaran || !applied || applied.akhir !== 0) return <>{children}</>;

  return (
    <div>
      <button
        type="button"
        disabled={pending || pesan?.ok === true}
        onClick={() => {
          setPesan(null);
          start(async () => {
            try {
              const res = await klaimVoucherGratis(applied.code, sasaran);
              setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
              if (res.ok) router.refresh();
            } catch {
              setPesan({ ok: false, teks: "Gagal memproses voucher. Periksa koneksi lalu coba lagi." });
            }
          });
        }}
        className="w-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Memproses…" : sasaran.kind === "premium" ? "Aktifkan Premium Gratis" : "Ambil Kursus Gratis"}
      </button>
      {pesan && (
        <p role="status" className={cn("mt-3 px-4 py-3 text-sm", pesan.ok ? "bg-blue-500/15 text-blue-200" : "bg-[#E0795A]/15 text-error-text")}>
          {pesan.teks}
        </p>
      )}
    </div>
  );
}
