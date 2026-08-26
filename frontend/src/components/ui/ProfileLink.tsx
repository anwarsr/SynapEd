import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Membungkus apa pun menjadi tautan ke halaman profil seseorang.
 *
 * Dibuat sebagai pembungkus, bukan komponen yang ikut menata isinya, karena
 * nama-dan-foto muncul dengan tata letak berbeda-beda: berjajar di daftar
 * ulasan, bertumpuk di dialog testimoni, satu baris di panel admin. Yang
 * disatukan hanya KEPUTUSANNYA — kapan jadi tautan, ke mana, dan apa yang
 * terjadi kalau uid-nya tidak ada.
 *
 * `uid` kosong berarti bukan tautan. Ulasan lama dan data hasil migrasi bisa
 * saja tidak menyimpannya, dan tautan yang berakhir di 404 lebih buruk
 * daripada nama yang tidak bisa diklik.
 */
export default function ProfileLink({
  uid,
  name,
  className,
  /** Sembunyikan dari pembaca layar & urutan tab — untuk tautan kembar
   *  (mis. foto di sebelah nama yang menuju tempat yang sama). */
  secondary = false,
  children,
}: {
  uid?: string | null;
  name: string;
  className?: string;
  secondary?: boolean;
  children: React.ReactNode;
}) {
  if (!uid) return <span className={className}>{children}</span>;

  return (
    <Link
      href={`/profil/${uid}`}
      title={`Lihat profil ${name}`}
      aria-hidden={secondary || undefined}
      tabIndex={secondary ? -1 : undefined}
      className={cn(
        "transition-colors duration-200 hover:text-blue-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg",
        className,
      )}
    >
      {children}
    </Link>
  );
}
