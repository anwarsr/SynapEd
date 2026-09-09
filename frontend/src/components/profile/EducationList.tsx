import { formatYears, type EducationEntry } from "@/lib/profileTypes";

/**
 * Riwayat pendidikan sebagai garis waktu bertitik, terbaru di atas.
 *
 * Urutannya dihitung di sini, bukan mengikuti urutan penyimpanan: pengguna
 * menambah entri sesuai ingatannya, bukan berurutan waktu, dan daftar yang
 * melompat-lompat tahun terbaca berantakan.
 *
 * Garis waktu, bukan daftar bergaris kotak: riwayat pendidikan memang berurut
 * waktu, dan bentuknya sebaiknya mengatakan itu tanpa perlu dijelaskan.
 */
export default function EducationList({ items }: { items: readonly EducationEntry[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-rule px-5 py-6 text-center text-[13px] text-ink-muted">
        Belum ada riwayat pendidikan.
      </p>
    );
  }

  const urut = [...items].sort((a, b) => {
    // Yang masih berjalan selalu paling atas.
    const akhirA = a.endYear ?? Number.MAX_SAFE_INTEGER;
    const akhirB = b.endYear ?? Number.MAX_SAFE_INTEGER;
    if (akhirA !== akhirB) return akhirB - akhirA;
    return (b.startYear ?? 0) - (a.startYear ?? 0);
  });

  return (
    <ul>
      {urut.map((e, i) => {
        const tahun = formatYears(e);
        const terakhir = i === urut.length - 1;

        return (
          <li
            key={e.id}
            className={`relative border-l border-rule pl-[22px] ${terakhir ? "pb-0" : "pb-[22px]"}`}
          >
            <span
              aria-hidden="true"
              className="absolute left-[-4.5px] top-[5px] h-2 w-2 rounded-full bg-blue-500"
            />

            {tahun && (
              <p className="t-numeral text-[12.5px] text-ink-muted tabular-nums">{tahun}</p>
            )}

            <p className="mt-0.5 text-[14.5px] font-medium text-ink break-words">
              {e.institution}
            </p>

            <p className="mt-0.5 text-[12.5px] text-ink-muted break-words">
              {e.level}
              {e.major && ` · ${e.major}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
