import type { ReactNode } from "react";
import Link from "next/link";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import Lampiran, { hrefLampiran } from "@/components/classes/Lampiran";
import { formatDate } from "@/lib/adminUsers";
import { INFO_FORMAT, formatWib, lewatTenggat } from "@/lib/classAssignmentRules";
import type { KelasPost } from "@/lib/classTypes";
import type { UserCard } from "@/lib/userCards";

/**
 * Halaman satu tugas — kerangka yang sama untuk siswa dan pengajar.
 *
 * Kolom utama: instruksi + lampiran pengajar, lalu `bawah` (daftar
 * pengumpulan, hanya di halaman pengajar). Kolom samping: `samping` (panel
 * pengumpulan siswa, atau pengaturan tugas untuk pengajar). Isi khusus
 * peran dioper sebagai slot supaya data milik satu peran tidak pernah
 * tersedia di komponen yang juga dirender untuk peran lain.
 */
export default function AssignmentDetail({
  post,
  namaKelas,
  pengajar,
  kembali,
  saat,
  samping,
  bawah,
}: {
  post: KelasPost;
  namaKelas: string;
  pengajar: UserCard | undefined;
  kembali: string;
  saat: number;
  samping: ReactNode;
  bawah?: ReactNode;
}) {
  const p = post.assignment!;
  const lewat = lewatTenggat(p.dueAt, saat);
  const namaPengajar = pengajar?.name ?? "Pengajar";

  return (
    <div className="container-page">
      <Link
        href={kembali}
        className="inline-block text-[13px] text-ink-muted transition-colors duration-200 hover:text-blue-700"
      >
        ← {namaKelas}
      </Link>

      <div className="mt-6 grid gap-8 grid-cols-[minmax(0,1fr)_340px] max-lg:grid-cols-1">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 max-sm:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
              </svg>
            </span>

            <div className="min-w-0 flex-1">
              <Tag tone="amber">Tugas</Tag>
              <h1 className="t-h2 mt-2 break-words">{post.title}</h1>

              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-2">
                  <UserAvatar name={namaPengajar} photoURL={pengajar?.photoURL ?? null} size="sm" />
                  {namaPengajar}
                </span>
                <span aria-hidden="true" className="max-sm:hidden">·</span>
                <span>{formatDate(post.createdAt)}</span>
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-3">
            <div className="bg-paper-card px-5 py-4">
              <dt className="t-label text-ink-muted">Tenggat</dt>
              <dd className={lewat ? "mt-1 text-sm font-medium text-rust-700" : "mt-1 text-sm font-medium text-ink"}>
                {p.dueAt ? formatWib(p.dueAt) : "Tanpa tenggat"}
              </dd>
              {p.dueAt && (
                <dd className="mt-0.5 text-xs text-ink-muted">
                  {p.acceptLate ? "Terlambat tetap diterima" : "Ditutup setelah tenggat"}
                </dd>
              )}
            </div>
            <div className="bg-paper-card px-5 py-4">
              <dt className="t-label text-ink-muted">Nilai maksimal</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums text-ink">{p.maxPoints}</dd>
            </div>
            <div className="bg-paper-card px-5 py-4">
              <dt className="t-label text-ink-muted">Format</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {p.formats.map((f) => INFO_FORMAT[f].label).join(", ")}
              </dd>
            </div>
          </dl>

          {post.body ? (
            <p className="mt-6 whitespace-pre-line break-words text-[15.5px] leading-[1.75] text-ink-body">
              {post.body}
            </p>
          ) : (
            <p className="mt-6 text-sm text-ink-muted">Tidak ada instruksi tertulis.</p>
          )}

          {post.attachments.length > 0 && (
            <div className="mt-6">
              <p className="t-label mb-3 text-ink-muted">Lampiran pengajar</p>
              <Lampiran
                files={post.attachments}
                hrefs={post.attachments.map((_, i) => hrefLampiran(post.classId, post.id, i))}
              />
            </div>
          )}

          {bawah && <div className="mt-10">{bawah}</div>}
        </div>

        <aside className="w-full space-y-4 lg:sticky lg:top-24 lg:self-start">{samping}</aside>
      </div>
    </div>
  );
}
