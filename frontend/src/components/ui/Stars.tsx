import { cn } from "@/lib/cn";

/** Satu bentuk bintang untuk seluruh aplikasi — jangan disalin lagi. */
export const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z";

const sizes = {
  xs: "w-2.5 h-2.5",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-7 h-7",
} as const;

/**
 * Lima bintang, sekian di antaranya terisi.
 *
 * Dibuat satu komponen karena bentuk yang sama sudah tersalin di empat tempat
 * (katalog, detail kursus, kartu beranda, dialog testimoni), masing-masing
 * dengan path SVG sepanjang 500 karakter yang diketik ulang.
 */
export default function Stars({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex gap-0.5", className)}
      aria-label={`${value} dari 5 bintang`}
    >
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={cn(sizes[size], s <= Math.round(value) ? "text-amber-500" : "text-white/20")}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
