import type { ReactNode } from "react";
import BackLink from "@/components/ui/BackLink";
import UserAvatar from "@/components/ui/UserAvatar";
import Lampiran, { hrefLampiran } from "@/components/classes/Lampiran";
import { formatDate } from "@/lib/adminUsers";
import { formatWib, lewatTenggat, pernahDiedit, ringkasFormat } from "@/lib/classAssignmentRules";
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
  aksi,
}: {
  post: KelasPost;
  namaKelas: string;
  pengajar: UserCard | undefined;
  kembali: string;
  saat: number;
  samping: ReactNode;
  bawah?: ReactNode;
  /** Tepat di bawah kepala tugas — tombol & formulir edit di halaman pengelola. */
  aksi?: ReactNode;
}) {
  const p = post.assignment!;
  const lewat = lewatTenggat(p.dueAt, saat);
  const namaPengajar = pengajar?.name ?? "Pengajar";

  return (
    <div className="container-page">
      <BackLink href={kembali}>{namaKelas}</BackLink>

      <div className="mt-6 grid gap-8 grid-cols-[minmax(0,1fr)_340px] max-lg:grid-cols-1">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-bold uppercase tracking-[0.3em] text-blue-300">Tugas</span>
              <h1 className="t-h1 mt-2 break-words">{post.title}</h1>

              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-2">
                  <UserAvatar name={namaPengajar} photoURL={pengajar?.photoURL ?? null} size="sm" />
                  {namaPengajar}
                </span>
                <span aria-hidden="true" className="max-sm:hidden">·</span>
                <span>{formatDate(post.createdAt)}</span>
                {pernahDiedit(post) && <span className="italic">· diedit</span>}
              </p>
            </div>
          </div>

          {aksi && <div className="mt-4">{aksi}</div>}

          <dl className="mt-6 grid gap-1 sm:grid-cols-3">
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
                {ringkasFormat(p.formats)}
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
