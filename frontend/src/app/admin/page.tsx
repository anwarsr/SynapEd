import AdminShell from "@/components/admin/AdminShell";
import UserList from "@/components/admin/UserList";
import Link from "next/link";
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
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
              Daftar <span>akun pengguna</span>
            </h1>
            <p className="t-body text-ink-muted">
              {users.length} akun terdaftar · {admins} admin · {educators} educator
            </p>
          </div>

          <Link
            href="/admin/users/new"
            className="group inline-flex items-center gap-4 bg-white/[0.06] px-5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.24em] text-white transition-colors duration-500 ease-warm hover:bg-blue-600"
          >
            Buat akun
            <span aria-hidden="true" className="flex items-center gap-2">
              <span className="h-px w-6 bg-white/40 transition-all duration-500 ease-warm group-hover:w-10 group-hover:bg-white" />
              <svg className="h-3.5 w-3.5 transition-transform duration-500 ease-warm group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>
        </div>

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
