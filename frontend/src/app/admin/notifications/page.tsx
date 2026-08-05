import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatDate } from "@/lib/adminUsers";
import { listApplications, pendingApplicationCount, statusLabel } from "@/lib/educator";
import { requireAdmin } from "@/lib/firebase/session";
import type { ApplicationStatus } from "@/lib/educator";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifikasi – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

const tone: Record<ApplicationStatus, "amber" | "blue" | "rust"> = {
  pending: "amber",
  accepted: "blue",
  rejected: "rust",
};

export default async function AdminNotificationsPage() {
  const admin = await requireAdmin("/admin/notifications");
  const [applications, pending] = await Promise.all([
    listApplications(),
    pendingApplicationCount(),
  ]);

  return (
    <AdminShell user={admin} pendingCount={pending}>
      <div className="container-page">
        <h1 className="t-h2 mb-3">
          Pengajuan <span className="mark">menjadi educator</span>
        </h1>
        <p className="t-body text-ink-muted mb-10">
          {pending > 0
            ? `${pending} pengajuan menunggu keputusan Anda.`
            : "Tidak ada pengajuan yang menunggu keputusan."}
        </p>

        {applications.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted">
              Belum ada pengajuan yang masuk. Notifikasi akan muncul di sini saat ada
              pengguna yang mengajukan diri menjadi educator.
            </p>
          </div>
        ) : (
          <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden">
            <ul className="divide-y divide-rule">
              {applications.map((a) => (
                <li key={a.uid}>
                  <Link
                    href={`/admin/notifications/${a.uid}`}
                    className="group flex flex-wrap items-center gap-4 px-6 py-4 transition-colors duration-200 hover:bg-blue-50/50"
                  >
                    {/* Titik penanda untuk yang belum diputuskan — sinyal yang
                        terbaca sekilas tanpa harus membaca labelnya. */}
                    <span className="w-2 shrink-0" aria-hidden="true">
                      {a.status === "pending" && (
                        <span className="block w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </span>

                    <UserAvatar name={a.name} photoURL={a.photoURL} />

                    <span className="flex-1 min-w-[12rem]">
                      <span className="block text-sm font-medium text-ink truncate group-hover:text-blue-700 transition-colors">
                        {a.name}
                      </span>
                      <span className="block text-xs text-ink-muted truncate">{a.email}</span>
                    </span>

                    <span className="text-xs text-ink-muted w-44">
                      {formatDate(a.createdAt)}
                    </span>

                    <Tag tone={tone[a.status]}>{statusLabel[a.status]}</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs text-ink-muted">
          Klik salah satu baris untuk melihat detail dan memutuskan.
        </p>
      </div>
    </AdminShell>
  );
}
