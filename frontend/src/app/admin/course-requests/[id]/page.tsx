import Link from "next/link";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import CourseRequestDecision from "@/components/admin/CourseRequestDecision";
import Tag from "@/components/ui/Tag";
import { formatDate } from "@/lib/adminUsers";
import { adminBadges } from "@/lib/adminBadges";
import { getRequest, requestStatusLabel, requestTypeLabel } from "@/lib/courseRequests";
import { changeKindLabel, diffCourse, type Change } from "@/lib/courseDiff";
import { requireAdmin } from "@/lib/firebase/session";
import { getCourse } from "@/lib/courses";
import {
  contributorPeople,
  personLabel,
  type ContributorPerson,
} from "@/lib/courseContributors";
import type { RequestStatus } from "@/lib/courseRequests";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pengajuan Kursus – Panel Admin SynapEd" };

const tone: Record<RequestStatus, "amber" | "blue" | "rust"> = {
  pending: "amber",
  approved: "blue",
  rejected: "rust",
};

const kindTone: Record<Change["kind"], string> = {
  added: "text-blue-700 bg-blue-50",
  removed: "text-rust-700 bg-rust-100",
  changed: "text-amber-700 bg-amber-100",
  moved: "text-ink-body bg-paper-alt",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[12rem_1fr] gap-1 sm:gap-6 py-4 border-b border-rule last:border-0">
      <dt className="t-label text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink-body break-words">{children}</dd>
    </div>
  );
}

export default async function CourseRequestDetailPage({ params }: Props) {
  const admin = await requireAdmin();
  const { id } = await params;

  const [request, badges] = await Promise.all([
    getRequest(id),
    adminBadges(),
  ]);

  if (!request) notFound();

  // Pembagian hasil ikut ditinjau. Pada pengajuan TAYANG, inilah pertama
  // kalinya admin melihat kontributor yang diatur saat kursus dibuat — sejak
  // detik penayangan itulah pembagian ini mulai menerima uang.
  const course =
    request.type === "publish" && request.status === "pending"
      ? await getCourse(request.courseSlug)
      : null;

  const uids = [
    ...(request.before?.contributors ?? []),
    ...(request.after?.contributors ?? []),
    ...(course?.contributors ?? []),
  ];
  const people = await contributorPeople(uids);
  const byUid = new Map(people.map((p) => [p.uid, p]));
  const labelOf = (uid: string) => {
    const p = byUid.get(uid);
    return p ? personLabel(p) : uid;
  };

  const changes =
    request.type === "edit" && request.before && request.after
      ? diffCourse(request.before, request.after, labelOf)
      : [];

  const pembagian: ContributorPerson[] = course
    ? course.contributors.map((c, i) => ({
        ...(byUid.get(c.uid) as ContributorPerson),
        share: c.share,
        role: i === 0 ? "owner" : "contributor",
      }))
    : [];

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-reading">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-10">
          <Link href="/admin/course-requests" className="hover:text-blue-700 transition-colors">
            Pengajuan Kursus
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink truncate">{request.courseTitle}</span>
        </nav>

        <div className="bg-paper-card p-8 mb-8">
          <div className="flex flex-wrap items-center gap-3 pb-6 mb-2 border-b border-rule">
            <h1 className="t-h3 text-xl">{request.courseTitle}</h1>
            <Tag tone={tone[request.status]}>{requestStatusLabel[request.status]}</Tag>
          </div>

          <dl>
            <Row label="Jenis pengajuan">{requestTypeLabel[request.type]}</Row>
            <Row label="Diajukan oleh">{request.requestedByName}</Row>
            <Row label="Diajukan pada">{formatDate(request.createdAt)}</Row>
            <Row label="Alasan educator">
              <span className="italic">&ldquo;{request.reason}&rdquo;</span>
            </Row>
            <Row label="Kursus">
              <Link
                href={`/courses/${request.courseSlug}`}
                className="text-blue-700 hover:underline underline-offset-4"
              >
                Lihat halaman kursus →
              </Link>
            </Row>

            {request.status !== "pending" && (
              <>
                <Row label="Diputuskan pada">{formatDate(request.decidedAt)}</Row>
                <Row label="Diputuskan oleh">{request.decidedByName ?? "-"}</Row>
                <Row label="Catatan admin">
                  {request.decisionNote ?? <span className="text-ink-faint">-</span>}
                </Row>
              </>
            )}
          </dl>
        </div>

        {/* ── Pembagian hasil saat tayang ─────────────────────────────── */}
        {pembagian.length > 0 && (
          <div className="bg-paper-card p-8 mb-8">
            <h2 className="t-h3 text-base mb-1.5">Pembagian hasil</h2>
            <p className="text-sm text-ink-muted mb-6">
              Setelah potongan platform, setiap penjualan dibagi sesuai persentase ini.
            </p>
            <ul className="divide-y divide-rule">
              {pembagian.map((p) => (
                <li key={p.uid} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0 break-words text-ink">
                    {personLabel(p)}
                    {p.role === "owner" && <span className="ml-2 text-ink-muted">· pemilik</span>}
                  </span>
                  <span className="t-numeral shrink-0 tabular-nums text-ink">{p.share}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Perbandingan versi ─────────────────────────────────────── */}
        {request.type === "edit" && (
          <div className="bg-paper-card p-8 mb-8">
            <h2 className="t-h3 text-base mb-1.5">Yang diubah</h2>
            <p className="text-sm text-ink-muted mb-6">
              {changes.length === 0
                ? "Tidak ada perbedaan terdeteksi antara versi lama dan usulan."
                : `${changes.length} perubahan dibandingkan versi yang sekarang tayang.`}
            </p>

            {changes.length > 0 && (
              <ul className="divide-y divide-rule">
                {changes.map((c, i) => (
                  <li key={i} className="py-3 flex flex-wrap items-start gap-3">
                    <span
                      className={`shrink-0  px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${kindTone[c.kind]}`}
                    >
                      {changeKindLabel[c.kind]}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{c.field}</p>

                      {(c.before !== undefined || c.after !== undefined) && (
                        <div className="mt-1.5 grid sm:grid-cols-2 gap-2 text-sm">
                          {c.before !== undefined && (
                            <p className=" bg-rust-100/60 px-3 py-2 text-rust-700 break-words">
                              <span className="t-label block text-[10px] mb-0.5 opacity-70">Sebelum</span>
                              {c.before}
                            </p>
                          )}
                          {c.after !== undefined && (
                            <p className=" bg-blue-50 px-3 py-2 text-blue-700 break-words">
                              <span className="t-label block text-[10px] mb-0.5 opacity-70">Sesudah</span>
                              {c.after}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {request.status === "pending" ? (
          <div className="bg-paper-card p-8">
            <h2 className="t-h3 text-base mb-5">Keputusan</h2>
            <CourseRequestDecision
              id={request.id}
              type={request.type}
              courseTitle={request.courseTitle}
            />
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Pengajuan ini sudah diputuskan dan tidak dapat diubah lagi.
          </p>
        )}

        <Link
          href="/admin/course-requests"
          className="inline-flex items-center gap-2 mt-8 text-sm text-blue-700 hover:underline underline-offset-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke daftar pengajuan
        </Link>
      </div>
    </AdminShell>
  );
}
