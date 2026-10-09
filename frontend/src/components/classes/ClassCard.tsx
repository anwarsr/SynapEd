import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { ClassSpine } from "@/components/classes/ClassPlate";
import { nadaKelas } from "@/lib/classColor";
import { formatDateOnly } from "@/lib/adminUsers";

const DISPLAY_JUDUL = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

const DISPLAY_ANGKA = {
  fontFamily: "var(--font-sans)",
  fontFeatureSettings: '"tnum"',
} as const;

/** Satu figur: angka besar di atas labelnya. */
function Figur({ angka, label }: { angka: number | string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[19px] leading-none text-ink" style={DISPLAY_ANGKA}>
        {angka}
      </span>
      <span className="text-[13px] text-ink-muted">{label}</span>
    </span>
  );
}

/**
 * Kartu kelas di daftar.
 *
 * Angka-angkanya berdiri sebagai figur, bukan dirangkai jadi kalimat
 * bertitik-titik: "24 anggota · 8 postingan · dibuat 12 Feb" dibaca sebagai
 * satu baris abu-abu yang diloncati mata. Dipisah begini, jumlah anggota
 * terbaca sekali lihat.
 */
export default function ClassCard({
  kelas,
  href,
  peran,
}: {
  kelas: { id: string; name: string; description: string; memberCount: number; postCount: number; createdAt: string };
  href: string;
  /** Chip peran, mis. "Peserta" atau "Pengajar". Dikosongkan berarti tanpa chip. */
  peran?: string;
}) {
  const nada = nadaKelas(kelas.name);

  return (
    <Link
      href={href}
      className="group flex overflow-hidden bg-paper-card transition-all duration-240 ease-out-soft hover:bg-card-hover hover:-translate-y-[3px]"
    >
      <ClassSpine nama={kelas.name} />

      <span className="min-w-0 flex-1 p-5 sm:p-6">
        <span className="flex flex-wrap items-start justify-between gap-3">
          <span
            className="text-[21px] leading-[1.3] text-ink transition-colors duration-200 group-hover:text-blue-700"
            style={DISPLAY_JUDUL}
          >
            {kelas.name}
          </span>

          {peran && (
            <Tag tone={nada.tag} className="shrink-0">
              {peran}
            </Tag>
          )}
        </span>

        {kelas.description && (
          <span className="mt-2 block max-w-[64ch] text-sm leading-[1.65] text-ink-body line-clamp-2">
            {kelas.description}
          </span>
        )}

        <span className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 pt-3.5">
          <Figur angka={kelas.memberCount} label="anggota" />
          <Figur angka={kelas.postCount} label="postingan" />
          <span className="text-[13px] text-ink-muted">Dibuat {formatDateOnly(kelas.createdAt)}</span>
        </span>
      </span>
    </Link>
  );
}
