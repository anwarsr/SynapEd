import Link from "next/link";
import { formatPrice } from "@/lib/courseUi";
import { PREMIUM_HARI } from "@/lib/premiumRules";
import { cn } from "@/lib/cn";

interface Props {
  harga: number;
  /** Kursus publik berbayar - lihat `ringkasPenawaran`. */
  jumlah: number;
  totalSatuan: number;
  /** Anggota aktif tidak ditawari lagi; cukup diingatkan bahwa semuanya terbuka. */
  aktif?: boolean;
  className?: string;
}

/**
 * Ajakan SynapEd Premium yang dipasang di beranda, katalog, dan dashboard.
 *
 * Isinya MANFAAT bagi pembeli (berapa kursus terbuka, berapa yang dihemat),
 * bukan cara kerja bagi hasil - itu urusan educator, bukan alasan orang membeli.
 * Angkanya dihitung dari katalog sungguhan, jadi tidak pernah menjanjikan lebih.
 *
 * Latar `bg-blue-600` + `keep-white`: tulisannya tetap putih di tema terang.
 */
export default function PitaPremium({ harga, jumlah, totalSatuan, aktif = false, className }: Props) {
  if (jumlah === 0) return null;

  if (aktif) {
    return (
      <Link
        href="/premium"
        className={cn(
          "group flex flex-wrap items-center justify-between gap-3 bg-blue-500/10 px-6 py-4 text-sm text-ink-body shadow-[inset_3px_0_0_var(--color-blue-400)] transition-colors hover:bg-blue-500/15",
          className,
        )}
      >
        <span>
          <span className="font-semibold text-ink">Premium aktif.</span> Semua {jumlah} kursus berbayar terbuka untuk Anda - tekan{" "}
          <span className="font-semibold text-ink">Pelajari dengan Premium</span> di halaman kursus.
        </span>
        <span className="font-semibold text-blue-300 transition-transform group-hover:translate-x-1">Lihat status →</span>
      </Link>
    );
  }

  const hemat = totalSatuan - harga;

  return (
    <section
      aria-label="SynapEd Premium"
      className={cn("keep-white relative overflow-hidden bg-blue-600 text-white", className)}
    >
      {/* Kata raksasa samar di belakang: ciri visual yang sama dengan angka hantu panel About. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[0.22em] -right-[0.04em] select-none text-[clamp(5rem,16vw,12rem)] font-black uppercase leading-none tracking-[-0.06em] text-white/[0.08]"
      >
        Premium
      </span>

      <div className="relative grid gap-8 px-7 py-9 sm:px-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/75">SynapEd Premium</p>
          <h2 className="mt-3 max-w-[22ch] text-[clamp(1.6rem,3.4vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
            Buka {jumlah} kursus berbayar dengan satu pembayaran.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-white/85">
            {hemat > 0 ? (
              <>
                Dibeli satu per satu totalnya {formatPrice(totalSatuan)}. Dengan Premium cukup {formatPrice(harga)} untuk {PREMIUM_HARI} hari -
                lengkap dengan kuis, tugas, dan sertifikat.
              </>
            ) : (
              <>
                Akses penuh {PREMIUM_HARI} hari ke semua materi, kuis, tugas, dan sertifikat - tanpa membeli satu per satu.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          {hemat > 0 && (
            <p className="text-sm text-white/80">
              Hemat <span className="text-2xl font-extrabold tabular-nums text-white">{formatPrice(hemat)}</span>
            </p>
          )}
          <Link
            href="/premium"
            className="group inline-flex items-center gap-2.5 bg-black/25 px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-black/40"
          >
            Coba Premium {formatPrice(harga)}
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
