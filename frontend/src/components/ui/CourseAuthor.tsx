import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import { cn } from "@/lib/cn";

/**
 * Penyedia kursus pada kartu katalog dan halaman detail.
 *
 * Sebelumnya nama pemilik hanya muncul di halaman detail, jadi pengunjung
 * harus membuka kursusnya dulu untuk tahu itu terbitan siapa — padahal saat
 * membandingkan beberapa kartu, justru itu yang menentukan pilihan.
 *
 * Satu komponen dipakai bersama karena katalog punya dua tata letak kartu
 * (bagian beranda dan halaman /courses) plus panel di halaman detail. Ditulis
 * tiga kali, ketiganya pasti perlahan melenceng.
 *
 * Menjadi tautan HANYA kalau `uid` ada. Kursus hasil migrasi tidak punya
 * pemilik di aplikasi ini, dan tautan yang berakhir di 404 lebih buruk
 * daripada nama yang tidak bisa diklik.
 */
export default function CourseAuthor({
  name,
  uid,
  photoURL,
  size = "sm",
  className,
}: {
  name: string;
  uid?: string | null;
  photoURL?: string | null;
  /** `md` untuk halaman detail, `sm` untuk kartu katalog. */
  size?: "sm" | "md";
  className?: string;
}) {
  const trimmed = name.trim();

  // Kursus hasil migrasi bisa tidak punya nama penyedia. Menampilkan lingkaran
  // kosong berhuruf awal "?" lebih buruk daripada tidak menampilkan apa pun.
  if (!trimmed) return null;

  const isi = (
    <>
      <UserAvatar
        name={trimmed}
        photoURL={photoURL ?? null}
        className={size === "md" ? "w-9 h-9 text-xs" : "w-6 h-6 text-[10px]"}
      />
      <span
        className={cn(
          "truncate font-medium text-ink",
          size === "md" ? "text-sm" : "text-[13px]",
        )}
      >
        {trimmed}
      </span>
    </>
  );

  const dasar = cn("flex items-center gap-2 min-w-0", className);

  if (!uid) return <p className={dasar}>{isi}</p>;

  return (
    <Link
      href={`/profil/${uid}`}
      className={cn(
        dasar,
        "rounded-lg transition-colors duration-200 hover:text-blue-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      )}
      title={`Lihat profil ${trimmed}`}
    >
      {isi}
    </Link>
  );
}
