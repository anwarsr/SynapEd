import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Jejak halaman: huruf kapital kecil berjarak lebar, pemisah garis tipis, garis
 * bawah biru menyapu saat di-hover, halaman aktif putih. Gaya yang sama dengan
 * halaman detail kursus; dipakai di panel admin, panel educator, dan halaman
 * hukum. Item tanpa `href` = halaman aktif.
 */
export default function Breadcrumb({
  items,
  className,
}: {
  items: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted",
        className,
      )}
    >
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-white/25" />}
          {it.href ? (
            <Link href={it.href} className="group relative py-1.5 transition-colors duration-300 hover:text-white">
              {it.label}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-blue-400 transition-transform duration-500 ease-warm group-hover:scale-x-100"
              />
            </Link>
          ) : (
            <span aria-current="page" className="max-w-[40ch] truncate py-1.5 text-white">
              {it.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
