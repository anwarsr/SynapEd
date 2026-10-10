import Link from "next/link";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import DecisionButtons from "@/components/admin/DecisionButtons";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatDate, getUser } from "@/lib/adminUsers";
import { getApplication, statusLabel } from "@/lib/educator";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import { roleLabel, type Role } from "@/lib/roles";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ uid: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uid } = await params;
  const user = await getUser(uid);
  return { title: user ? `${user.name} – Panel Admin SynapEd` : "Akun – Panel Admin SynapEd" };
}

const roleTone: Record<Role, "amber" | "blue" | "neutral"> = {
  admin: "amber",
  educator: "blue",
  user: "neutral",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[12rem_1fr] gap-1 sm:gap-6 py-4 border-b border-rule last:border-0">
      <dt className="t-label text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink-body break-words">{children}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: Props) {
  const admin = await requireAdmin();

  const { uid } = await params;
  const user = await getUser(uid);
  if (!user) notFound();

  const [application, badges] = await Promise.all([
    getApplication(uid),
    adminBadges(),
  ]);

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-reading">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-10">
          <Link href="/admin" className="hover:text-blue-700 transition-colors">
            Akun Pengguna
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{user.name}</span>
        </nav>

        <div className="bg-paper-card p-8">
          <div className="flex items-center gap-5 pb-7 mb-2 border-b border-rule">
            <UserAvatar name={user.name} photoURL={user.photoURL} size="lg" />
            <div className="min-w-0">
              <h1 className="t-h3 text-xl mb-1.5 truncate">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={roleTone[user.role]}>{roleLabel[user.role]}</Tag>
                {user.disabled && <Tag tone="rust">Dinonaktifkan</Tag>}
              </div>
            </div>
          </div>

          <dl>
            <Row label="Email">
              <span className="flex flex-wrap items-center gap-2">
                {user.email}
                {user.emailVerified ? (
                  <Tag tone="blue">Terverifikasi</Tag>
                ) : (
                  <Tag tone="amber">Belum diverifikasi</Tag>
                )}
              </span>
            </Row>

            <Row label="Nomor HP">
              {user.phone ?? <span className="text-ink-faint">Belum diisi</span>}
            </Row>

            <Row label="Pengajuan educator">
              {application ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Tag
                    tone={
                      application.status === "pending"
                        ? "amber"
                        : application.status === "accepted"
                          ? "blue"
                          : "rust"
                    }
                  >
                    {statusLabel[application.status]}
                  </Tag>
                  <span className="text-ink-muted">{formatDate(application.createdAt)}</span>
                  <Link
                    href={`/admin/notifications/${user.uid}`}
                    className="text-blue-700 hover:underline underline-offset-4"
                  >
                    Detail →
                  </Link>
                </span>
              ) : (
                <span className="text-ink-faint">Tidak ada</span>
              )}
            </Row>

            <Row label="Terdaftar sejak">{formatDate(user.createdAt)}</Row>
            <Row label="Terakhir masuk">{formatDate(user.lastSignInAt)}</Row>

            <Row label="User ID">
              <code className="text-xs bg-paper-alt px-2 py-1 ">{user.uid}</code>
            </Row>
          </dl>
        </div>

        {/* Keputusan bisa diambil langsung dari sini supaya admin yang sedang
            memeriksa sebuah akun tidak perlu berpindah ke halaman notifikasi. */}
        {application?.status === "pending" && (
          <div className="mt-8">
            <h2 className="t-h3 text-base mb-2">Pengajuan menjadi educator</h2>
            <p className="text-sm text-ink-muted mb-5">
              Keputusan bersifat permanen. Pengguna perlu masuk ulang setelah diterima.
            </p>
            <DecisionButtons uid={user.uid} name={user.name} />
          </div>
        )}

        {/* Selain keputusan pengajuan, panel ini hanya-baca. Mengubah role
            sembarangan dari UI menuntut penjagaan tersendiri; untuk sekarang
            jalurnya lewat skrip, dan itu urusan pengembang - bukan sesuatu
            yang pantas ditempel sebagai perintah terminal di halaman web. */}
        <p className="mt-6 text-xs text-ink-muted">
          Selain keputusan pengajuan, halaman ini hanya menampilkan data.
        </p>

        <Link
          href="/admin"
          className="inline-flex items-center gap-2 mt-8 text-sm text-blue-700 hover:underline underline-offset-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke daftar akun
        </Link>
      </div>
    </AdminShell>
  );
}
