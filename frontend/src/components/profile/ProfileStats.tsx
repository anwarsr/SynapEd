import CountUp from "@/components/ui/CountUp";
import type { ProfileStats } from "@/lib/userProfile";

/**
 * Angka ringkas profil — SATU kartu yang dibagi garis rambut, bukan beberapa
 * kartu berdampingan.
 *
 * Kartu terpisah membuat tiap angka tampak berdiri sendiri; dibagi begini,
 * keempatnya terbaca sebagai satu ringkasan tentang orang yang sama.
 *
 * Garisnya dibuat dari `gap: 1px` di atas latar berwarna garis, bukan dari
 * border per sel — border per sel menghasilkan garis ganda di pertemuan sel
 * dan garis menggantung di ujung baris saat selnya membungkus.
 */
export default function ProfileStatsRow({
  stats,
  isEducator,
  isPublic = false,
}: {
  stats: ProfileStats;
  isEducator: boolean;
  /** Profil orang lain: yang ditonjolkan rekam jejak mengajar, bukan progres. */
  isPublic?: boolean;
}) {
  const angka = (n: number) => n.toLocaleString("id-ID");
  const rerata = (n: number) => (n > 0 ? n.toFixed(1).replace(".", ",") : "—");

  // Rata-rata TIDAK dianimasikan CountUp.
  //
  // CountUp memperlakukan koma sebagai pemisah ribuan (`.replace(/,/g, "")`),
  // jadi "4,7" terbaca 47 dan tampil sebagai 47 — angka yang salah, bukan
  // sekadar animasi yang meleset. Memperbaiki CountUp berarti mengubah
  // perilaku angka di beranda yang sudah benar, jadi yang dilewati di sini
  // hanya nilai desimalnya.

  const kartu = isPublic
    ? [
        { nilai: angka(stats.courses), label: "Kursus diajarkan" },
        { nilai: angka(stats.students), label: "Total peserta" },
        { nilai: rerata(stats.avgRating), label: "Rata-rata ulasan", statis: true },
        { nilai: angka(stats.lessons), label: "Pelajaran" },
      ]
    : isEducator
      ? [
          { nilai: angka(stats.courses), label: "Kursus dibuat" },
          { nilai: angka(stats.students), label: "Total peserta" },
          { nilai: angka(stats.enrolled), label: "Kursus diikuti" },
          { nilai: rerata(stats.avgRating), label: "Rata-rata ulasan", statis: true },
        ]
      : [
          { nilai: angka(stats.enrolled), label: "Kursus diikuti" },
          { nilai: angka(stats.completed), label: "Kursus selesai" },
          { nilai: angka(stats.certificates), label: "Sertifikat" },
          { nilai: angka(stats.classes), label: "Kelas diikuti" },
        ];

  return (
    <dl className="mt-11 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {kartu.map((k) => (
        <div key={k.label} className="bg-paper-card px-7 py-[26px]">
          <dd className="t-numeral text-[38px] tabular-nums">
            {"statis" in k && k.statis ? k.nilai : <CountUp value={k.nilai} />}
          </dd>
          <dt className="mt-2.5 text-[12.5px] text-ink-muted">{k.label}</dt>
        </div>
      ))}
    </dl>
  );
}
