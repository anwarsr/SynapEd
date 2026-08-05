import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatDate, listUsers } from "@/lib/adminUsers";
import { pendingApplicationCount } from "@/lib/educator";
import { requireAdmin } from "@/lib/firebase/session";
import { roleLabel } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import type { Metadata } from "next";

const roleTone: Record<Role, "amber" | "blue" | "neutral"> = {
  admin: "amber",
  educator: "blue",
  user: "neutral",
};

export const metadata: Metadata = { title: "Akun Pengguna – Panel Admin SynapEd" };

// Bergantung pada cookie sesi, jadi tidak boleh di-prerender.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");
  const [users, pending] = await Promise.all([listUsers(), pendingApplicationCount()]);

  const admins = users.filter((u) => u.role === "admin").length;
  const educators = users.filter((u) => u.role === "educator").length;

  return (
    <AdminShell user={admin} pendingCount={pending}>
      <div className="container-page">
        <h1 className="t-h2 mb-3">
          Daftar <span className="mark">akun pengguna</span>
        </h1>
        <p className="t-body text-ink-muted mb-10">
          {users.length} akun terdaftar · {admins} admin · {educators} educator
        </p>

        <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden">
          {/* Kepala tabel hanya untuk layar lebar; di ponsel tiap baris
              berdiri sendiri sebagai kartu. */}
          <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto] gap-6 px-6 py-3.5 bg-paper-alt border-b border-rule">
            <span className="t-label text-ink-muted">Pengguna</span>
            <span className="t-label text-ink-muted w-32">Nomor HP</span>
            <span className="t-label text-ink-muted w-40">Role</span>
            <span className="t-label text-ink-muted w-44">Terakhir masuk</span>
          </div>

          <ul className="divide-y divide-rule">
            {users.map((u) => (
              <li key={u.uid}>
                <Link
                  href={`/admin/users/${u.uid}`}
                  className="group grid lg:grid-cols-[1fr_auto_auto_auto] gap-4 lg:gap-6 items-center px-6 py-4 transition-colors duration-200 hover:bg-blue-50/50"
                >
                  <span className="flex items-center gap-3.5 min-w-0">
                    <span className="relative shrink-0">
                      <UserAvatar name={u.name} photoURL={u.photoURL} />
                      {/* Titik pada foto: penanda ada pengajuan yang menunggu,
                          terbaca sekilas tanpa menambah kolom baru. */}
                      {u.pendingApplication && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-paper-card"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink truncate group-hover:text-blue-700 transition-colors">
                        {u.name}
                      </span>
                      <span className="block text-xs text-ink-muted truncate">{u.email}</span>
                    </span>
                  </span>

                  <span className="text-sm text-ink-body lg:w-32">
                    {u.phone ?? <span className="text-ink-faint">—</span>}
                  </span>

                  <span className="flex items-center gap-2 lg:w-40">
                    <Tag tone={roleTone[u.role]}>{roleLabel[u.role]}</Tag>
                    {u.pendingApplication && <Tag tone="amber">Mengajukan</Tag>}
                  </span>

                  <span className="text-xs text-ink-muted lg:w-44">
                    {formatDate(u.lastSignInAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-ink-muted">
          Klik salah satu baris untuk melihat detail akun.
        </p>
      </div>
    </AdminShell>
  );
}
