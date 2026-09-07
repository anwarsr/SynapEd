import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import Tag from "@/components/ui/Tag";
import DeleteButton from "@/components/classes/DeleteButton";
import ReplyForm from "@/components/classes/ReplyForm";
import { formatDate } from "@/lib/adminUsers";
import type { KelasPost, KelasReply } from "@/lib/classTypes";
import type { UserCard } from "@/lib/userCards";

/**
 * Umpan postingan satu kelas.
 *
 * Komponen server: seluruh datanya sudah diselesaikan pemanggilnya, termasuk
 * satu panggilan getUserCards untuk SELURUH halaman. Membaca nama penulis di
 * dalam komponen ini berarti satu permintaan Auth per postingan.
 *
 * Isi postingan dirender sebagai TEKS POLOS (`whitespace-pre-line`), bukan
 * markdown. Menafsirkan tulisan peserta sebagai markup adalah permukaan
 * serangan yang tidak dibayar oleh manfaat apa pun di tahap teks-saja ini.
 */
export default function PostFeed({
  classId,
  posts,
  repliesByPost,
  cards,
  currentUid,
  canModerate,
  canReply,
}: {
  classId: string;
  posts: readonly KelasPost[];
  repliesByPost: ReadonlyMap<string, KelasReply[]>;
  cards: ReadonlyMap<string, UserCard>;
  currentUid: string;
  /** Pemilik kelas atau admin: boleh menghapus postingan dan balasan siapa pun. */
  canModerate: boolean;
  canReply: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
        <p className="t-body text-ink-muted">
          Belum ada postingan. Tulisan dari pengajar akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {posts.map((post) => {
        // Akun yang sudah dihapus tidak punya kartu. Nama cadangan, bukan
        // kosong — baris tanpa nama terbaca seperti halaman yang rusak.
        const penulis = cards.get(post.authorUid);
        const nama = penulis?.name ?? "Pengajar";
        const balasan = repliesByPost.get(post.id) ?? [];

        return (
          <li key={post.id} className="bg-paper-card border border-rule rounded-2xl p-6">
            <div className="flex flex-wrap items-start gap-3">
              <ProfileLink uid={post.authorUid} name={nama} secondary className="shrink-0">
                <UserAvatar name={nama} photoURL={penulis?.photoURL ?? null} />
              </ProfileLink>

              <div className="min-w-0 flex-1">
                <ProfileLink
                  uid={post.authorUid}
                  name={nama}
                  className="text-sm font-medium text-ink"
                >
                  {nama}
                </ProfileLink>
                <p className="text-xs text-ink-muted mt-0.5">{formatDate(post.createdAt)}</p>
              </div>

              <Tag tone="blue">Pengajar</Tag>
            </div>

            <p className="mt-4 whitespace-pre-line break-words text-sm text-ink-body leading-relaxed">
              {post.body}
            </p>

            {canModerate && (
              <div className="mt-4">
                <DeleteButton target={{ kind: "post", classId, postId: post.id }} />
              </div>
            )}

            {(balasan.length > 0 || canReply) && (
              <div className="mt-5 pt-5 border-t border-rule">
                {balasan.length > 0 && (
                  <ul className="space-y-4">
                    {balasan.map((r) => {
                      const kartu = cards.get(r.authorUid);
                      const namaBalasan = kartu?.name ?? "Peserta";
                      const bolehHapus = canModerate || r.authorUid === currentUid;

                      return (
                        <li key={r.id} className="flex flex-wrap items-start gap-3">
                          <ProfileLink
                            uid={r.authorUid}
                            name={namaBalasan}
                            secondary
                            className="shrink-0"
                          >
                            <UserAvatar
                              name={namaBalasan}
                              photoURL={kartu?.photoURL ?? null}
                              size="sm"
                            />
                          </ProfileLink>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <ProfileLink
                                uid={r.authorUid}
                                name={namaBalasan}
                                className="text-sm font-medium text-ink"
                              >
                                {namaBalasan}
                              </ProfileLink>
                              <span className="text-xs text-ink-muted">
                                {formatDate(r.createdAt)}
                              </span>
                            </div>

                            <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-body leading-relaxed">
                              {r.body}
                            </p>

                            {bolehHapus && (
                              <div className="mt-1.5">
                                <DeleteButton
                                  target={{
                                    kind: "reply",
                                    classId,
                                    postId: post.id,
                                    replyId: r.id,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canReply && <ReplyForm classId={classId} postId={post.id} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
