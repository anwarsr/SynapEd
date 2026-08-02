/** Penggabung className sederhana — cukup untuk kebutuhan proyek ini,
 *  tanpa menambah dependensi clsx/tailwind-merge. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
