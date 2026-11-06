"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePremiumPrice } from "@/lib/paymentSettingsActions";
import { grantPremiumAdmin, revokePremiumAdmin, settlePremiumNow } from "@/lib/premiumActions";
import { PREMIUM_HARI_ADMIN_MAKS, validasiHargaPremium } from "@/lib/premiumRules";
import { cn } from "@/lib/cn";

const ISIAN =
  "bg-white/[0.06] px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-400)]";
const TOMBOL =
  "bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

type Pesan = { ok: boolean; teks: string } | null;

function Status({ pesan }: { pesan: Pesan }) {
  if (!pesan) return null;
  return (
    <p role="status" className={cn("mt-4 px-4 py-3 text-sm", pesan.ok ? "bg-blue-500/10 text-ink-body" : "bg-[#E0795A]/15 text-error-text")}>
      {pesan.teks}
    </p>
  );
}

/** Harga premium - divalidasi lagi di server (`updatePremiumPrice`). */
export function PremiumPriceForm({ awal }: { awal: number }) {
  const router = useRouter();
  const [nilai, setNilai] = useState(String(awal));
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<Pesan>(null);
  const angka = nilai.trim() === "" ? Number.NaN : Number(nilai);
  const salah = validasiHargaPremium(angka);

  return (
    <form
      className="bg-paper-card p-7"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updatePremiumPrice({ premiumPrice: angka });
          setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <h2 className="t-h3 mb-1.5">Harga premium</h2>
      <p className="mb-6 text-sm text-ink-muted">Harga 30 hari. Hanya berlaku untuk pembelian berikutnya - pesanan yang sudah dibuat memakai harga lamanya.</p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="t-label mb-2 block text-ink-muted">Rupiah</span>
          <input type="number" inputMode="numeric" step={1000} value={nilai} onChange={(e) => setNilai(e.target.value)} className={cn(ISIAN, "w-44 tabular-nums")} />
        </label>
        <button type="submit" disabled={pending || salah !== null || angka === awal} className={TOMBOL}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      {salah && nilai.trim() !== "" && <p className="mt-4 text-sm text-error-text">{salah}</p>}
      <Status pesan={pesan} />
    </form>
  );
}

/** Beri / cabut premium untuk satu akun (email atau UID). */
export function PremiumGrantForm() {
  const router = useRouter();
  const [akun, setAkun] = useState("");
  const [hari, setHari] = useState("30");
  const [catatan, setCatatan] = useState("");
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<Pesan>(null);

  function jalankan(aksi: "beri" | "cabut") {
    setPesan(null);
    start(async () => {
      const res = aksi === "beri" ? await grantPremiumAdmin(akun, Number(hari), catatan) : await revokePremiumAdmin(akun, catatan);
      setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="bg-paper-card p-7">
      <h2 className="t-h3 mb-1.5">Beri atau cabut premium</h2>
      <p className="mb-6 text-sm text-ink-muted">
        Memberi tanpa bayar (beasiswa, guru mitra) menambah hari di belakang masa aktif. Mencabut menghentikan premium SEKARANG - kemajuan
        belajar akun itu tetap tersimpan. Pengembalian dana Midtrans/QRIS tetap diurus manual.
      </p>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <label className="block">
          <span className="t-label mb-2 block text-ink-muted">Email atau UID akun</span>
          <input value={akun} onChange={(e) => setAkun(e.target.value)} placeholder="nama@contoh.com" className={cn(ISIAN, "w-full")} />
        </label>
        <label className="block">
          <span className="t-label mb-2 block text-ink-muted">Hari</span>
          <input type="number" min={1} max={PREMIUM_HARI_ADMIN_MAKS} value={hari} onChange={(e) => setHari(e.target.value)} className={cn(ISIAN, "w-full tabular-nums")} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="t-label mb-2 block text-ink-muted">Catatan (opsional)</span>
        <input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={300} placeholder="mis. beasiswa batch 3" className={cn(ISIAN, "w-full")} />
      </label>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={pending || !akun.trim()} onClick={() => jalankan("beri")} className={TOMBOL}>
          {pending ? "Memproses…" : "Beri premium"}
        </button>
        <button
          type="button"
          disabled={pending || !akun.trim()}
          onClick={() => jalankan("cabut")}
          className="bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-ink-body transition-colors hover:bg-rust-700 hover:text-[#fff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cabut premium
        </button>
      </div>
      <Status pesan={pesan} />
    </div>
  );
}

/** Membagi hasil semua periode yang sudah berakhir. Idempoten di server. */
export function SettleButton({ jumlah }: { jumlah: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<Pesan>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending || jumlah === 0}
        onClick={() =>
          start(async () => {
            const res = await settlePremiumNow();
            setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
            router.refresh();
          })
        }
        className={TOMBOL}
      >
        {pending ? "Membagikan…" : `Bagikan pendapatan (${jumlah} periode)`}
      </button>
      <Status pesan={pesan} />
    </div>
  );
}
