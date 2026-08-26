import type { ProfileStats } from "@/lib/userProfile";

function Angka({ nilai, label }: { nilai: number; label: string }) {
  return (
    <div className="bg-paper-card border border-rule rounded-2xl px-5 py-4">
      <p className="t-numeral text-2xl text-ink tabular-nums">{nilai.toLocaleString("id-ID")}</p>
      <p className="text-xs text-ink-muted mt-1">{label}</p>
    </div>
  );
}

/**
 * Ringkasan angka.
 *
 * Isinya berbeda menurut peran, dan itu disengaja: "5 kursus diikuti" tidak
 * berarti apa-apa untuk educator yang tidak pernah mendaftar kursus, sementara
 * "0 peserta" pada profil peserta biasa hanya membingungkan.
 */
export default function ProfileStatsRow({
  stats,
  isEducator,
}: {
  stats: ProfileStats;
  isEducator: boolean;
}) {
  const kartu = isEducator
    ? [
        { nilai: stats.courses, label: "Kursus dibuat" },
        { nilai: stats.students, label: "Total peserta" },
        { nilai: stats.enrolled, label: "Kursus diikuti" },
        { nilai: stats.certificates, label: "Sertifikat" },
      ]
    : [
        { nilai: stats.enrolled, label: "Kursus diikuti" },
        { nilai: stats.completed, label: "Kursus selesai" },
        { nilai: stats.certificates, label: "Sertifikat" },
      ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {kartu.map((k) => (
        <Angka key={k.label} nilai={k.nilai} label={k.label} />
      ))}
    </div>
  );
}
