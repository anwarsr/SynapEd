import { cn } from "@/lib/cn";

/**
 * Penyedia kursus pada kartu katalog.
 *
 * Sebelumnya nama pemilik hanya muncul di halaman detail, jadi pengunjung
 * harus membuka kursusnya dulu untuk tahu itu terbitan siapa — padahal saat
 * membandingkan beberapa kartu, justru itu yang menentukan pilihan.
 *
 * Satu komponen dipakai bersama karena katalog punya dua tata letak kartu
 * (bagian beranda dan halaman /courses). Ditulis dua kali, keduanya pasti
 * perlahan melenceng.
 */
export default function CourseAuthor({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const trimmed = name.trim();

  // Kursus hasil migrasi bisa tidak punya nama penyedia. Menampilkan lingkaran
  // kosong berhuruf awal "?" lebih buruk daripada tidak menampilkan apa pun.
  if (!trimmed) return null;

  // Array.from, bukan [0]: nama yang diawali emoji tersimpan sebagai pasangan
  // surrogate, dan mengambil setengahnya menghasilkan karakter rusak.
  const initial = (Array.from(trimmed)[0] ?? "").toUpperCase();

  return (
    <p className={cn("flex items-center gap-2 min-w-0 text-[13px] text-ink-muted", className)}>
      <span
        aria-hidden="true"
        className="shrink-0 grid place-items-center w-5 h-5 rounded-full border border-rule bg-paper-alt text-[10px] font-semibold text-ink-body"
      >
        {initial}
      </span>
      <span className="truncate">{trimmed}</span>
    </p>
  );
}
