import Link from "next/link";
import Tag from "@/components/ui/Tag";
import type { ApplicationStatus } from "@/lib/educator";
import type { Role } from "@/lib/roles";

/**
 * Kartu status educator di halaman profil.
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

  if (role === "educator") {
    return (
      <div className="flex flex-wrap items-center gap-4 bg-paper-card border border-rule rounded-2xl p-6 mb-12">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <h2 className="t-h3 text-base">Akun Educator</h2>
            <Tag tone="amber">Educator</Tag>
          </div>
          <p className="text-sm text-ink-muted">
            Anda dapat membuat kursus sendiri di SynapEd.
          </p>
        </div>
        <Link href="/educator" className="text-sm text-blue-700 hover:underline underline-offset-4">
          Selengkapnya →
        </Link>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-4 bg-paper-card border border-rule rounded-2xl p-6 mb-12">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <h2 className="t-h3 text-base">Pengajuan Educator</h2>
            <Tag tone="amber">Menunggu</Tag>
          </div>
          <p className="text-sm text-ink-muted">Sedang ditinjau oleh admin SynapEd.</p>
        </div>
        <Link href="/educator" className="text-sm text-blue-700 hover:underline underline-offset-4">
          Lihat status →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 bg-paper-card border border-rule rounded-2xl p-6 mb-12">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <h2 className="t-h3 text-base">Jadi Educator</h2>
          {status === "rejected" && <Tag tone="rust">Ditolak</Tag>}
        </div>
        <p className="text-sm text-ink-muted">
          {status === "rejected"
            ? "Pengajuan sebelumnya ditolak. Anda masih boleh mengajukan kembali."
            : "Buat dan terbitkan kursus Anda sendiri di SynapEd."}
        </p>
      </div>
      <Link
        href="/educator"
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
      >
        {status === "rejected" ? "Ajukan Kembali" : "Pelajari & Ajukan"}
      </Link>
    </div>
  );
}
