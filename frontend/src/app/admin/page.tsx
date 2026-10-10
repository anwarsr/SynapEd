import AdminShell from "@/components/admin/AdminShell";
import UserList from "@/components/admin/UserList";
import { formatDate, listUsers } from "@/lib/adminUsers";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import type { Metadata } from "next";


export const metadata: Metadata = { title: "Akun Pengguna – Panel Admin SynapEd" };

// Bergantung pada cookie sesi, jadi tidak boleh di-prerender.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");
  const [users, badges] = await Promise.all([listUsers(), adminBadges()]);

  const admins = users.filter((u) => u.role === "admin").length;
  const educators = users.filter((u) => u.role === "educator").length;

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page">
        <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
          Daftar <span>akun pengguna</span>
        </h1>
        <p className="t-body text-ink-muted mb-10">
          {users.length} akun terdaftar · {admins} admin · {educators} educator
        </p>

        <UserList
          users={users.map((u) => ({
            uid: u.uid,
            name: u.name,
            email: u.email,
            photoURL: u.photoURL,
            role: u.role,
            phone: u.phone,
            pendingApplication: u.pendingApplication,
            lastSignIn: formatDate(u.lastSignInAt),
          }))}
        />

        <p className="mt-6 text-xs text-ink-muted">
          Klik salah satu baris untuk melihat detail akun.
        </p>
      </div>
    </AdminShell>
  );
}
