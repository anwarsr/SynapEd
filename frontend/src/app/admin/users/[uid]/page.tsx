import Link from "next/link";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/admin/UserAvatar";
import { formatDate, getUser } from "@/lib/adminUsers";
import { requireAdmin } from "@/lib/firebase/session";
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

  return (
    <AdminShell user={admin}>
      <div className="container-reading">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-10">
          <Link href="/admin" className="hover:text-blue-700 transition-colors">
            Akun Pengguna
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{user.name}</span>
        </nav>

        <div className="bg-paper-card border border-rule rounded-2xl p-8">
          <div className="flex items-center gap-5 pb-7 mb-2 border-b border-rule">
            <UserAvatar name={user.name} photoURL={user.photoURL} size="lg" />
            <div className="min-w-0">
              <h1 className="t-h3 text-xl mb-1.5 truncate">{user.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={user.role === "admin" ? "amber" : "blue"}>
                  {user.role === "admin" ? "Admin" : "User"}
                </Tag>
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

            <Row label="Terdaftar sejak">{formatDate(user.createdAt)}</Row>
            <Row label="Terakhir masuk">{formatDate(user.lastSignInAt)}</Row>

            <Row label="User ID">
              <code className="text-xs bg-paper-alt px-2 py-1 rounded-md">{user.uid}</code>
            </Row>
          </dl>
        </div>

        {/* Panel ini sengaja hanya-baca. Mengubah role dari UI menuntut
            endpoint tulis yang dijaga ketat; untuk sekarang role diatur
            lewat skrip supaya tidak ada jalur baru yang bisa disalahgunakan. */}
        <p className="mt-6 text-xs text-ink-muted">
          Panel ini hanya menampilkan data. Untuk mengubah role, jalankan{" "}
          <code className="bg-paper-alt px-1.5 py-0.5 rounded">
            npm run set-role {user.email} admin
          </code>
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
