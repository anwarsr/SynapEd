import { cn } from "@/lib/cn";

/**
 * Lencana kecil "Premium" - dipakai navbar (lewat `NavbarPremium`) dan kepala
 * profil. Persegi tanpa border, latar biru: `bg-blue-*` mendeklarasikan ulang
 * `--color-white`, jadi teksnya tetap putih di tema terang.
 */
export default function LencanaPremium({ className }: { className?: string }) {
  return (
    <span
      title="Anggota SynapEd Premium"
      className={cn("inline-block bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-white", className)}
    >
      Premium
    </span>
  );
}
