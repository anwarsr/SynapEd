import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import {
  ClearRequestsButton,
  DeleteRequestButton,
} from "@/components/admin/CourseRequestActions";
import Tag from "@/components/ui/Tag";
import { formatDate } from "@/lib/adminUsers";
import { adminBadges } from "@/lib/adminBadges";
import { listRequests, requestStatusLabel, requestTypeLabel } from "@/lib/courseRequests";
import { diffCourse, summariseChanges } from "@/lib/courseDiff";
import { requireAdmin } from "@/lib/firebase/session";
import type { RequestStatus } from "@/lib/courseRequests";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pengajuan Kursus – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

const tone: Record<RequestStatus, "amber" | "blue" | "rust"> = {
  pending: "amber",
  approved: "blue",
  rejected: "rust",
};

export default async function CourseRequestsPage() {
  const admin = await requireAdmin("/admin/course-requests");
  const [requests, badges] = await Promise.all([listRequests(), adminBadges()]);

  const pending = requests.filter((r) => r.status === "pending").length;

  // Hanya yang sudah diputuskan yang boleh dibersihkan — lihat alasannya di
  // deleteCourseRequest(). Dihitung dari daftar yang sudah dibaca, bukan
  // kueri kedua ke Firestore.
  const decided = requests.length - pending;

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page">
        <h1 className="t-h2 mb-3">
          Pengajuan <span className="mark">perubahan kursus</span>
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <p className="t-body text-ink-muted">
            {pending > 0
              ? `${pending} pengajuan menunggu keputusan Anda.`
              : "Tidak ada pengajuan yang menunggu keputusan."}
          </p>

          <ClearRequestsButton count={decided} />
        </div>

        {requests.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted">
              Belum ada pengajuan. Permintaan educator akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden">
            <ul className="divide-y divide-rule">
              {requests.map((r) => {
                // Ringkasan perubahan dihitung dari salinan yang tersimpan di
                // pengajuan, bukan dari kursus terkini — kursusnya bisa berubah
                // lagi sebelum admin memutuskan.
                const ringkas =
                  r.type === "edit" && r.before && r.after
                    ? summariseChanges(diffCourse(r.before, r.after))
                    : null;

                return (
                  // Tombol hapus berdiri di SEBELAH Link, bukan di dalamnya:
                  // <button> bersarang di <a> bukan HTML yang sah, dan pembaca
                  // layar tidak bisa memisahkan keduanya. Efek hover dipindah
                  // ke <li> supaya seluruh baris tetap terasa satu kesatuan.
                  <li
                    key={r.id}
                    className="flex items-center gap-1 pr-3 transition-colors duration-200 hover:bg-blue-50/50"
                  >
                    <Link
                      href={`/admin/course-requests/${r.id}`}
                      className="group flex flex-1 flex-wrap items-center gap-4 px-6 py-4 min-w-0"
                    >
                      <span className="w-2 shrink-0" aria-hidden="true">
                        {r.status === "pending" && (
                          <span className="block w-2 h-2 rounded-full bg-amber-500" />
                        )}
                      </span>

                      <span className="flex-1 min-w-[14rem]">
                        <span className="block text-sm font-medium text-ink truncate group-hover:text-blue-700 transition-colors">
                          {r.courseTitle}
                        </span>
                        <span className="block text-xs text-ink-muted truncate">
                          {requestTypeLabel[r.type]} · oleh {r.requestedByName}
                          {ringkas ? ` · ${ringkas}` : ""}
                        </span>
                      </span>

                      <span className="text-xs text-ink-muted w-44">{formatDate(r.createdAt)}</span>

                      <Tag tone={tone[r.status]}>{requestStatusLabel[r.status]}</Tag>
                    </Link>

                    {/* Yang masih menunggu tidak punya tombol hapus: catatannya
                        adalah satu-satunya jejak permintaan educator itu. */}
                    {r.status !== "pending" && (
                      <DeleteRequestButton id={r.id} title={r.courseTitle} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs text-ink-muted">
          Klik salah satu baris untuk melihat alasan, perbandingan versi, dan memutuskan.
        </p>
      </div>
    </AdminShell>
  );
}
