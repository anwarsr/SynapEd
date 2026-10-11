import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import DeleteReviewButton from "@/components/admin/ReviewActions";
import ReviewReply from "@/components/admin/ReviewReply";
import Stars from "@/components/ui/Stars";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import { adminBadges } from "@/lib/adminBadges";
import { formatDate } from "@/lib/adminUsers";
import { FEATURED_MIN_RATING, listAllReviews } from "@/lib/reviews";
import { requireAdmin } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ulasan – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const admin = await requireAdmin("/admin/reviews");
  const [reviews, badges] = await Promise.all([listAllReviews(), adminBadges()]);

  const diBeranda = reviews.filter((r) => r.rating >= FEATURED_MIN_RATING).length;

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page">
        <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
          Ulasan <span>peserta</span>
        </h1>
        <p className="t-body text-ink-muted mb-10">
          {reviews.length === 0
            ? "Belum ada ulasan. Hanya peserta yang sudah menyelesaikan kursus yang dapat menulisnya."
            : `${reviews.length} ulasan · ${diBeranda} di antaranya tampil di beranda.`}
        </p>

        {reviews.length === 0 ? (
          <div className="bg-paper-card p-12 text-center">
            <p className="t-body text-ink-muted">
              Ulasan akan muncul di sini begitu ada peserta yang menyelesaikan kursusnya.
            </p>
          </div>
        ) : (
          <div className="bg-paper-card overflow-hidden">
            <ul className="divide-y divide-rule">
              {reviews.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-6 py-5">
                  {/* Berguna saat memoderasi: memeriksa siapa penulisnya
                      sebelum memutuskan menghapus ulasannya. */}
                  <ProfileLink uid={r.uid} name={r.name} secondary className="shrink-0">
                    <UserAvatar name={r.name} photoURL={r.photoURL} />
                  </ProfileLink>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ProfileLink uid={r.uid} name={r.name} className="text-sm font-medium text-ink">
                        {r.name}
                      </ProfileLink>
                      <Stars value={r.rating} size="xs" />
                      <span className="text-xs text-ink-muted">{formatDate(r.createdAt)}</span>

                      {/* Penanda mana yang benar-benar terlihat publik di
                          halaman depan - itulah yang biasanya jadi alasan
                          admin membuka halaman ini. */}
                      {r.rating >= FEATURED_MIN_RATING && (
                        <span className=" bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                          Tampil di beranda
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/courses/${r.courseSlug}`}
                      className="mt-0.5 block text-xs text-ink-muted truncate transition-colors hover:text-blue-700"
                    >
                      {r.courseTitle}
                    </Link>

                    <p className="mt-2 text-sm text-ink-body whitespace-pre-line break-words">
                      {r.comment}
                    </p>

                    <ReviewReply id={r.id} initial={r.reply?.body ?? null} by={r.reply?.by ?? null} />
                  </div>

                  <DeleteReviewButton id={r.id} name={r.name} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs text-ink-muted">
          Ulasan tampil begitu dikirim, tanpa persetujuan. Hapus yang kasar atau spam -
          isinya tidak bisa disunting. Admin dapat membalas ulasan; balasannya tampil di kartu komentar beranda.
        </p>
      </div>
    </AdminShell>
  );
}
