import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Tautan kembali: garis tipis di depan tulisan huruf kapital kecil berjarak
 * lebar. Garisnya memanjang dan tulisannya memutih saat di-hover - menggantikan
 * tombol berpanah/bergaris yang tampil beda-beda di tiap halaman.
 */
export default function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-4 text-[11.5px] font-semibold uppercase tracking-[0.3em] text-ink-muted transition-colors duration-300 hover:text-white",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-7 bg-white/40 transition-all duration-500 ease-warm group-hover:w-12 group-hover:bg-white" />
      {children}
    </Link>
  );
}
