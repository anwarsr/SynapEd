import Stars from "@/components/ui/Stars";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import { formatDate } from "@/lib/adminUsers";
import type { Review } from "@/lib/reviews";

/**
 * Daftar ulasan sebuah kursus.
 *
 * Semua ulasan ditampilkan apa adanya, termasuk yang bintangnya rendah.
 * Penyaringan bintang 4 ke atas hanya berlaku untuk etalase di beranda —
 * halaman inilah tempat calon peserta benar-benar menimbang, dan menyaringnya
 * di sini akan membuat rata-rata di atas tidak cocok dengan yang terbaca.
 */
export default function ReviewList({
  reviews,
  rating,
  /** Ulasan milik pembaca sendiri ditandai, supaya ia tahu miliknya yang mana. */
  myUid,
}: {
  reviews: readonly Review[];
  rating: number;
  myUid?: string | null;
}) {
  if (reviews.length === 0) {
    return (
      <div className="bg-paper-card border border-rule rounded-2xl p-8 text-center">
        <p className="t-body text-ink-muted">
          Belum ada ulasan untuk kursus ini. Ulasan hanya bisa ditulis peserta yang sudah
          menyelesaikan seluruh pelajarannya.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-7 py-5 border-b border-rule">
        <span className="t-numeral text-2xl">{rating.toFixed(1)}</span>
        <Stars value={rating} size="md" />
        <span className="text-sm text-ink-muted">
          dari {reviews.length} ulasan
        </span>
      </div>

      <ul className="divide-y divide-rule">
        {reviews.map((r) => (
          <li key={r.id} className="px-7 py-5">
            <div className="flex items-start gap-3">
              <ProfileLink uid={r.uid} name={r.name} secondary className="shrink-0">
                <UserAvatar name={r.name} photoURL={r.photoURL} />
              </ProfileLink>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ProfileLink uid={r.uid} name={r.name} className="text-sm font-medium text-ink">
                    {r.name}
                  </ProfileLink>
                  {myUid && r.uid === myUid && (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                      Ulasan Anda
                    </span>
                  )}
                  <Stars value={r.rating} size="xs" />
                  <span className="text-xs text-ink-muted">{formatDate(r.createdAt)}</span>
                </div>

                {/* whitespace-pre-line: peserta menulis dengan enter, dan
                    tanpa ini seluruh paragrafnya menempel jadi satu blok. */}
                <p className="mt-2 text-sm text-ink-body whitespace-pre-line break-words">
                  {r.comment}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
