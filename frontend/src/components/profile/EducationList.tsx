import { formatYears, type EducationEntry } from "@/lib/profileTypes";

/**
 * Riwayat pendidikan, terbaru di atas.
 *
 * Urutannya dihitung di sini, bukan mengikuti urutan penyimpanan: pengguna
 * menambah entri sesuai ingatannya, bukan berurutan waktu, dan daftar yang
 * melompat-lompat tahun terbaca berantakan.
 */
export default function EducationList({ items }: { items: readonly EducationEntry[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-rule bg-paper-alt px-6 py-8 text-center">
        <p className="t-body text-sm text-ink-muted">Belum ada riwayat pendidikan.</p>
      </div>
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
    <ul className="bg-paper-card border border-rule rounded-2xl divide-y divide-rule overflow-hidden">
      {urut.map((e) => {
        const tahun = formatYears(e);

        return (
          <li key={e.id} className="px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium text-ink break-words">{e.institution}</p>
              {tahun && (
                <p className="t-numeral text-xs text-ink-muted tabular-nums shrink-0">{tahun}</p>
              )}
            </div>

            <p className="text-xs text-ink-muted mt-1 break-words">
              {e.level}
              {e.major && ` · ${e.major}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
