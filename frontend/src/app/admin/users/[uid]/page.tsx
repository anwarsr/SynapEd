import BackLink from "@/components/ui/BackLink";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import UserManage from "@/components/admin/UserManage";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatDate, getUser } from "@/lib/adminUsers";
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

  const badges = await adminBadges();

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-reading">
        <Breadcrumb items={[{ label: "Akun Pengguna", href: "/admin" }, { label: user.name }]} />

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

            <Row label="Terdaftar sejak">{formatDate(user.createdAt)}</Row>
            <Row label="Terakhir masuk">{formatDate(user.lastSignInAt)}</Row>

            <Row label="User ID">
              <code className="text-xs bg-paper-alt px-2 py-1 ">{user.uid}</code>
            </Row>
          </dl>
        </div>

        {/* Ubah role & ganti kata sandi (kata sandi lama TIDAK bisa dilihat - lihat adminUserActions.ts) */}
        <UserManage uid={user.uid} role={user.role} isSelf={user.uid === admin.uid} name={user.name} photoURL={user.photoURL} />

        {/* Tautan kembali: garis penunjuk yang memanjang saat di-hover */}
        <BackLink href="/admin" className="mt-12">Kembali ke daftar akun</BackLink>
      </div>
    </AdminShell>
  );
}
