import Link from "next/link";
import { formatDateOnly } from "@/lib/adminUsers";
import type { Certificate } from "@/lib/certificates";

/**
 * Sertifikat yang dimiliki, sebagai kartu di sidebar.
 *
 * Tepi atas amber, bukan seluruh kartu berwarna: penanda yang cukup untuk
 * membedakannya dari kartu lain di kolom yang sama, tanpa membuat sidebar
 * terlihat seperti kumpulan spanduk.
 *
 * Yang dicabut tidak sampai ke sini — listMyCertificates sudah menyaringnya.
 */
export default function CertificateList({ items }: { items: readonly Certificate[] }) {
  if (items.length === 0) {
    return (
      <p className="bg-white/5 px-5 py-6 text-center text-[13px] text-ink-muted">
        Sertifikat muncul di sini setelah Anda menyelesaikan sebuah kursus.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/dashboard/certificates/${c.id}`}
            className="block bg-paper-card px-5 py-[18px] transition-colors duration-200 ease-out-soft hover:bg-card-hover"
          >
            <p className="text-sm font-medium text-ink break-words">{c.courseTitle}</p>

            <p className="t-numeral mt-1.5 text-[11.5px] tracking-[0.06em] text-ink-muted">
              {c.id}
            </p>

            <p className="mt-1 text-xs text-ink-faint">Terbit {formatDateOnly(c.issuedAt)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
