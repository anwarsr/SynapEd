import Link from "next/link";
import { progressFromSnapshot, type Enrollment } from "@/lib/enrollments";

const FRAUNCES_JUDUL = {
  fontFamily: "var(--font-fraunces)",
  fontVariationSettings: '"opsz" 32, "SOFT" 25, "WONK" 0',
  fontWeight: 500,
} as const;

/**
 * "Lanjutkan Belajar" — satu kursus, yang paling terakhir disentuh.
 *
 * Tidak punya keadaan kosong: pemanggilnya menyembunyikan seluruh section kalau
 * tidak ada enrollment aktif. Kotak "belum ada apa-apa" di puncak halaman
 * hanya mengumumkan kekosongan, sementara tepat di bawahnya sudah ada daftar
 * kursus lengkap dengan ajakan ke katalog.
 */
export default function ResumeCard({ enrollment }: { enrollment: Enrollment }) {
  const p = progressFromSnapshot(enrollment);

  // lastLessonSlug bisa kosong kalau peserta baru mendaftar dan belum membuka
  // satu pelajaran pun; halaman belajar tanpa slug memilihkan yang pertama.
  const href = enrollment.lastLessonSlug
    ? `/courses/${enrollment.courseSlug}/learn/${enrollment.lastLessonSlug}`
    : `/courses/${enrollment.courseSlug}/learn`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rule bg-paper-card px-[30px] py-7">
      {/* Persentase raksasa sebagai motif latar, bukan informasi kedua —
          angka yang sama sudah tertulis di sebelah bilahnya. */}
      <span
        aria-hidden="true"
        className="t-numeral-ghost pointer-events-none absolute -top-3.5 right-[22px] select-none text-[108px] text-paper-alt"
      >
        {p.percent}%
      </span>

      <div className="relative">
        <p className="t-label text-ink-muted">Pelajaran terakhir</p>

        <p className="mt-3 max-w-[calc(100%-7rem)] text-[26px] leading-tight text-ink" style={FRAUNCES_JUDUL}>
          {enrollment.courseTitle}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="h-1.5 min-w-[160px] flex-1 overflow-hidden rounded-full bg-paper-alt">
            <span
              className="block h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-warm"
              style={{ width: `${p.percent}%` }}
            />
          </span>

          <span className="t-numeral text-sm tabular-nums text-ink-muted">
            {p.done} dari {p.total} pelajaran
          </span>
        </div>

        <Link
          href={href}
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
        >
          Lanjutkan →
        </Link>
      </div>
    </div>
  );
}
