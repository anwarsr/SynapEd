import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  ClearNotificationsButton,
  DeleteNotificationButton,
} from "@/components/admin/NotificationActions";
import { formatDate } from "@/lib/adminUsers";
import { listApplications, statusLabel } from "@/lib/educator";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import type { ApplicationStatus } from "@/lib/educator";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pengajuan Edukator – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

const tone: Record<ApplicationStatus, "amber" | "blue" | "rust"> = {
  pending: "amber",
  accepted: "blue",
  rejected: "rust",
};

export default async function AdminNotificationsPage() {
  const admin = await requireAdmin("/admin/notifications");
  const [applications, badges] = await Promise.all([listApplications(), adminBadges()]);

  const pending = badges.applications;

  // Hanya yang sudah diputuskan yang boleh dibersihkan — lihat alasannya di
  // deleteApplication(). Dihitung dari daftar yang sudah dibaca, bukan query
  // kedua ke Firestore.
  const decided = applications.filter((a) => a.status !== "pending").length;

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page">
        <h1 className="t-h2 mb-3">
          Pengajuan <span className="mark">menjadi educator</span>
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <p className="t-body text-ink-muted">
            {pending > 0
              ? `${pending} pengajuan menunggu keputusan Anda.`
              : "Tidak ada pengajuan yang menunggu keputusan."}
          </p>

          <ClearNotificationsButton count={decided} />
        </div>

        {applications.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted">
              Belum ada pengajuan. Permintaan educator akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden">
            <ul className="divide-y divide-rule">
              {/* Tombol hapus berdiri di SEBELAH Link, bukan di dalamnya:
                  <button> bersarang di <a> bukan HTML yang sah, dan pembaca
                  layar tidak bisa memisahkan keduanya. Efek hover dipindah ke
                  <li> supaya seluruh baris tetap terasa satu kesatuan. */}
              {applications.map((a) => (
                <li
                  key={a.uid}
                  className="flex items-center gap-1 pr-3 transition-colors duration-200 hover:bg-blue-50/50"
                >
                  <Link
                    href={`/admin/notifications/${a.uid}`}
                    className="group flex flex-1 flex-wrap items-center gap-4 px-6 py-4 min-w-0"
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

                  {/* Yang masih menunggu tidak punya tombol hapus: catatannya
                      adalah satu-satunya jejak permintaan orang itu. */}
                  {a.status !== "pending" && (
                    <DeleteNotificationButton uid={a.uid} name={a.name} />
                  )}
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
