import Link from "next/link";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import DecisionButtons from "@/components/admin/DecisionButtons";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatDate, getUser } from "@/lib/adminUsers";
import { getApplication, pendingApplicationCount, statusLabel } from "@/lib/educator";
import { requireAdmin } from "@/lib/firebase/session";
import { roleLabel } from "@/lib/roles";
import type { ApplicationStatus } from "@/lib/educator";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ uid: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uid } = await params;
  const application = await getApplication(uid);
  return {
    title: application
      ? `Pengajuan ${application.name} – Panel Admin SynapEd`
      : "Pengajuan – Panel Admin SynapEd",
  };
}

const tone: Record<ApplicationStatus, "amber" | "blue" | "rust"> = {
  pending: "amber",
  accepted: "blue",
  rejected: "rust",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[12rem_1fr] gap-1 sm:gap-6 py-4 border-b border-rule last:border-0">
      <dt className="t-label text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink-body break-words">{children}</dd>
    </div>
  );
}

export default async function ApplicationDetailPage({ params }: Props) {
  const admin = await requireAdmin();

  const { uid } = await params;
  const [application, user, pending] = await Promise.all([
    getApplication(uid),
    getUser(uid),
    pendingApplicationCount(),
  ]);

  if (!application) notFound();

  return (
    <AdminShell user={admin} pendingCount={pending}>
      <div className="container-reading">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-10">
          <Link href="/admin/notifications" className="hover:text-blue-700 transition-colors">
            Notifikasi
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{application.name}</span>
        </nav>

        <div className="bg-paper-card border border-rule rounded-2xl p-8">
          <div className="flex items-center gap-5 pb-7 mb-2 border-b border-rule">
            <UserAvatar name={application.name} photoURL={application.photoURL} size="lg" />
            <div className="min-w-0">
              <h1 className="t-h3 text-xl mb-1.5 truncate">{application.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={tone[application.status]}>{statusLabel[application.status]}</Tag>
                {user && <Tag>{roleLabel[user.role]}</Tag>}
              </div>
            </div>
          </div>

          <dl>
            <Row label="Pengajuan">Menjadi educator</Row>
            <Row label="Email">{application.email}</Row>
            <Row label="Diajukan pada">{formatDate(application.createdAt)}</Row>

            {/* Akun bisa saja dihapus setelah mengajukan; itu keadaan yang
                nyata, jadi dikatakan apa adanya alih-alih dibiarkan kosong. */}
            <Row label="Status akun">
              {user ? (
                <Link
                  href={`/admin/users/${application.uid}`}
                  className="text-blue-700 hover:underline underline-offset-4"
                >
                  Lihat detail akun →
                </Link>
              ) : (
                <span className="text-rust-700">Akun sudah dihapus</span>
              )}
            </Row>

            {application.status !== "pending" && (
              <>
                <Row label="Diputuskan pada">{formatDate(application.decidedAt)}</Row>
                <Row label="Diputuskan oleh">
                  {application.decidedByName ?? <span className="text-ink-faint">—</span>}
                </Row>
              </>
            )}
          </dl>
        </div>

        {application.status === "pending" ? (
          <div className="mt-8">
            <h2 className="t-h3 text-base mb-2">Keputusan</h2>
            <p className="text-sm text-ink-muted mb-5">
              Keputusan bersifat permanen. Pengguna perlu masuk ulang setelah diterima.
            </p>
            <DecisionButtons uid={application.uid} name={application.name} />
          </div>
        ) : (
          <p className="mt-6 text-xs text-ink-muted">
            Pengajuan ini sudah diputuskan dan tidak dapat diubah lagi.
          </p>
        )}

        <Link
          href="/admin/notifications"
          className="inline-flex items-center gap-2 mt-8 text-sm text-blue-700 hover:underline underline-offset-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke notifikasi
        </Link>
      </div>
    </AdminShell>
  );
}
