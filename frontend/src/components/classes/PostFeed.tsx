import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import Tag from "@/components/ui/Tag";
import Reveal from "@/components/ui/Reveal";
import DeleteButton from "@/components/classes/DeleteButton";
import ReplyForm from "@/components/classes/ReplyForm";
import Lampiran, { hrefLampiran } from "@/components/classes/Lampiran";
import { formatDate } from "@/lib/adminUsers";
import { INFO_FORMAT, formatWib } from "@/lib/classAssignmentRules";
import type { KelasPost, KelasReply } from "@/lib/classTypes";
import type { UserCard } from "@/lib/userCards";

const DISPLAY_KOSONG = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

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
  basePath,
  posts,
  repliesByPost,
  cards,
  currentUid,
  meName,
  mePhoto,
  canModerate,
  canReply,
}: {
  classId: string;
  /** Akar rute kelas, untuk tautan ke halaman tugas. */
  basePath: string;
  posts: readonly KelasPost[];
  repliesByPost: ReadonlyMap<string, KelasReply[]>;
  cards: ReadonlyMap<string, UserCard>;
  currentUid: string;
  /** Nama & foto pembaca, untuk avatar di kotak balasan. */
  meName: string;
  mePhoto: string | null;
  /** Pemilik kelas atau admin: boleh menghapus postingan dan balasan siapa pun. */
  canModerate: boolean;
  canReply: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong bg-paper-card/55 px-8 py-14 text-center">
        <p className="text-[22px] text-ink" style={DISPLAY_KOSONG}>
          Belum ada pengumuman
        </p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
          {canModerate
            ? "Tulis pengumuman pertama di kotak atas. Seluruh anggota kelas akan melihatnya di sini."
            : "Tulisan dari pengajar akan muncul di sini begitu ada yang dikirim."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {posts.map((post, i) => {
        // Akun yang sudah dihapus tidak punya kartu. Nama cadangan, bukan
        // kosong — baris tanpa nama terbaca seperti halaman yang rusak.
        const penulis = cards.get(post.authorUid);
        const nama = penulis?.name ?? "Pengajar";
        const balasan = repliesByPost.get(post.id) ?? [];

        return (
          <li key={post.id}>
            <Reveal delay={i * 90}>
              <article className="rounded-2xl border border-rule bg-paper-card p-6 transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft">
                <div className="flex flex-wrap items-center gap-3">
                  <ProfileLink uid={post.authorUid} name={nama} secondary className="shrink-0">
                    <UserAvatar name={nama} photoURL={penulis?.photoURL ?? null} />
                  </ProfileLink>

                  <ProfileLink
                    uid={post.authorUid}
                    name={nama}
                    className="text-sm font-semibold text-ink"
                  >
                    {nama}
                  </ProfileLink>

                  <Tag tone="blue">Pengajar</Tag>
                  {post.kind === "assignment" && <Tag tone="amber">Tugas</Tag>}

                  <span className="ml-auto text-[13px] text-ink-muted">
                    {formatDate(post.createdAt)}
                  </span>
                </div>

                {post.kind === "assignment" && post.assignment && (
                  <Link
                    href={`${basePath}/tugas/${post.id}`}
                    className="group mt-4 block rounded-xl border border-amber-500/30 bg-amber-100/40 px-4 py-3.5 transition-colors duration-200 hover:border-amber-500/60"
                  >
                    <span className="block text-[17px] font-medium text-ink group-hover:text-blue-700">
                      {post.title}
                    </span>
                    <span className="mt-1 block text-[13px] text-ink-muted">
                      {post.assignment.dueAt ? `Tenggat ${formatWib(post.assignment.dueAt)}` : "Tanpa tenggat"}
                      {" · "}
                      {post.assignment.formats.map((f) => INFO_FORMAT[f].label).join(", ")}
                    </span>
                    <span className="mt-2 inline-block text-[13px] font-semibold text-blue-700">
                      Buka tugas →
                    </span>
                  </Link>
                )}

                {/* 15.5px, bukan 14px: ini badan tulisan pengajar, bukan
                    metadata yang menyertainya. */}
                {post.body && (
                  <p className="mt-4 whitespace-pre-line break-words text-[15.5px] leading-[1.75] text-ink-body">
                    {post.body}
                  </p>
                )}

                <Lampiran
                  files={post.attachments}
                  hrefs={post.attachments.map((_, j) => hrefLampiran(classId, post.id, j))}
                  className="mt-4"
                />

                {canModerate && (
                  <div className="mt-4">
                    <DeleteButton target={{ kind: "post", classId, postId: post.id }} />
                  </div>
                )}

                {(balasan.length > 0 || canReply) && (
                  <div className="mt-5 border-t border-rule pt-[18px]">
                    <p className="t-label text-ink-muted mb-4">
                      {balasan.length > 0 ? `${balasan.length} balasan` : "Belum ada balasan"}
                    </p>

                    {balasan.length > 0 && (
                      <ul className="mb-4 flex flex-col gap-4 border-l-2 border-blue-100 pl-[18px]">
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
                                <div className="flex flex-wrap items-baseline gap-2">
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

                                <p className="mt-1 whitespace-pre-line break-words text-sm leading-[1.7] text-ink-body">
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

                    {canReply && (
                      <ReplyForm
                        classId={classId}
                        postId={post.id}
                        meName={meName}
                        mePhoto={mePhoto}
                      />
                    )}
                  </div>
                )}
              </article>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
