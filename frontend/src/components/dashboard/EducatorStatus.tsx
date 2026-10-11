import Link from "next/link";
import Tag from "@/components/ui/Tag";
import type { ApplicationStatus } from "@/lib/educator";
import type { Role } from "@/lib/roles";

const DISPLAY_JUDUL = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

/**
 * Kartu Program Educator di sidebar profil.
 *
 * Latarnya `bg-paper-alt`, satu-satunya kartu berwarna di kolom itu: ia ajakan,
 * bukan data tentang orangnya. Kartu putih di antara kartu putih lain akan
 * terbaca sebagai satu bagian profil lagi dan terlewat.
 *
 * Tombolnya mengarah ke /educator, bukan langsung mengajukan, karena pengguna
 * berhak membaca dulu apa artinya menjadi educator sebelum memutuskan.
 */
export default function EducatorStatus({
  role,
  status,
}: {
  role: Role;
  status: ApplicationStatus | null;
}) {
  // Admin tidak punya urusan dengan pengajuan educator.
  if (role === "admin") return null;

  // Educator sudah punya pintunya sendiri di navbar dan di tombol utama
  // profilnya; kartu ajakan di sini hanya mengulang.
  if (role === "educator") return null;

  const menunggu = status === "pending";
  const ditolak = status === "rejected";

  return (
    <div className="bg-paper-card p-6">
      <Tag tone={ditolak ? "rust" : menunggu ? "amber" : "blue"}>
        {menunggu ? "Menunggu" : ditolak ? "Ditolak" : "Program Educator"}
      </Tag>

      <h2 className="mt-3 text-[20px] leading-snug text-ink" style={DISPLAY_JUDUL}>
        {menunggu ? "Pengajuan Educator" : ditolak ? "Ajukan Kembali" : "Jadi Educator"}
      </h2>

      <p className="mt-2 text-[13.5px] leading-[1.65] text-ink-body">
        {menunggu
          ? "Sedang ditinjau oleh admin SynapEd."
          : ditolak
            ? "Pengajuan sebelumnya ditolak. Anda masih boleh mengajukan kembali."
            : "Buat dan terbitkan kursus Anda sendiri di SynapEd."}
      </p>

      {menunggu ? (
        <Link
          href="/educator"
          className="mt-4 inline-block text-[13.5px] font-medium text-blue-700 hover:underline underline-offset-4"
        >
          Lihat status →
        </Link>
      ) : (
        <Link
          href="/educator"
          className="mt-4 inline-block bg-blue-600 px-5 py-[11px] text-[13.5px] font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
        >
          {ditolak ? "Ajukan Kembali" : "Pelajari & Ajukan"}
        </Link>
      )}
    </div>
  );
}
