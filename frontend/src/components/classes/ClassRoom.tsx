import type { ReactNode } from "react";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import Tag from "@/components/ui/Tag";
import CountUp from "@/components/ui/CountUp";
import PostFeed from "@/components/classes/PostFeed";
import PostComposer from "@/components/classes/PostComposer";
import AssignmentList, { type SudutTugas } from "@/components/classes/AssignmentList";
import DeleteButton from "@/components/classes/DeleteButton";
import JoinCodePanel from "@/components/classes/JoinCodePanel";
import { ClassPlate } from "@/components/classes/ClassPlate";
import { nadaKelas } from "@/lib/classColor";
import { formatDate } from "@/lib/adminUsers";
import type { KelasMember, KelasPost, KelasReply } from "@/lib/classTypes";
import type { UserCard } from "@/lib/userCards";
import { cn } from "@/lib/cn";

export type TabKelas = "pengumuman" | "tugas" | "anggota" | "tentang";

export function toTab(raw: unknown): TabKelas {
  return raw === "tugas" || raw === "anggota" || raw === "tentang" ? raw : "pengumuman";
}

const DISPLAY_JUDUL = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

const DISPLAY_ANGKA = {
  fontFamily: "var(--font-sans)",
  fontFeatureSettings: '"tnum"',
} as const;

const DISPLAY_SEKSI = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

const TABS: readonly { id: TabKelas; label: string }[] = [
  { id: "pengumuman", label: "Pengumuman" },
  { id: "tugas", label: "Tugas" },
  { id: "anggota", label: "Anggota" },
  { id: "tentang", label: "Tentang" },
];

interface Props {
  kelas: {
    id: string;
    name: string;
    description: string;
    ownerUid: string;
    memberCount: number;
    postCount: number;
    createdAt: string;
  };
  posts: readonly KelasPost[];
  repliesByPost: ReadonlyMap<string, KelasReply[]>;
  cards: ReadonlyMap<string, UserCard>;
  members: readonly KelasMember[];
  memberCards: ReadonlyMap<string, UserCard>;
  ownerCard: UserCard | undefined;
  currentUid: string;
  /** Nama & foto pembaca, untuk avatar di kotak balasan. */
  meName: string;
  mePhoto: string | null;
  /** Pemilik kelas atau admin. */
  isOwner: boolean;
  /** Punya dokumen keanggotaan — pemilik TIDAK punya. */
  isMember: boolean;
  tab: TabKelas;
  /** Akar rute halaman ini, untuk menyusun tautan tab. */
  basePath: string;
  /** Hanya diisi di halaman pengelola. Jangan pernah dari halaman peserta. */
  joinCode?: string;
  /** Tautan kembali di hero. */
  kembali: { href: string; label: string };
  /**
   * Menyelipkan hero ke belakang navbar yang mengambang.
   *
   * Benar di halaman publik, SALAH di panel educator — di sana bilah
   * headernya buram dan duduk di alur, jadi hero yang dinaikkan justru
   * tertutup separuh.
   */
  overlayNav?: boolean;
  /** Panel pengaturan pemilik, dirender di tab Tentang. */
  pengaturan?: ReactNode;
  /** Status tugas milik siswa, atau hitungan pengumpulan untuk pengajar. */
  sudutTugas: SudutTugas;
  /** Jam server saat render, supaya seluruh status tenggat memakai satu "sekarang". */
  saat: number;
}

/**
 * Ruang kelas — dipakai halaman peserta MAUPUN halaman pengelola.
 *
 * Satu komponen, dua pemanggil. Memisahkannya berarti umpan, balasan, dan
 * pemuatan kartu penulis ditulis dua kali, dan dua salinan yang sama akan
 * melenceng — satu sisi akhirnya menampilkan balasan yang tidak terlihat di
 * sisi lain pada postingan yang sama.
 *
 * Perbedaan peran diurus lewat prop, bukan lewat berkas terpisah: `joinCode`
 * hanya dioper halaman pengelola, dan tipenya membuat kelalaian mengirimnya
 * dari halaman peserta gagal saat dikompilasi.
 */
export default function ClassRoom({
  kelas,
  posts,
  repliesByPost,
  cards,
  members,
  memberCards,
  ownerCard,
  currentUid,
  meName,
  mePhoto,
  isOwner,
  isMember,
  tab,
  basePath,
  joinCode,
  kembali,
  overlayNav = false,
  pengaturan,
  sudutTugas,
  saat,
}: Props) {
  const namaPengajar = ownerCard?.name ?? "Pengajar";
  const tumpukan = members.slice(0, 5);
  const sisa = Math.max(0, kelas.memberCount - tumpukan.length);

  return (
    <>
      <section
        data-dark-hero
        className={cn("bg-navy relative overflow-hidden pb-0", overlayNav ? "-mt-14 pt-40" : "-mt-12 pt-10")}
      >
        {/* Dua kilau radial, murni dekoratif. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-blue-500) 55%, transparent), transparent 62%)",
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-[460px] w-[460px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-amber-500) 18%, transparent), transparent 62%)",
          }}
        />

        <div className="container-page relative">
          <Link
            href={kembali.href}
            className="rise-in inline-block text-[13px] text-paper/70 transition-colors duration-200 hover:text-paper"
            style={{ "--rise-delay": "0ms" } as React.CSSProperties}
          >
            ← {kembali.label}
          </Link>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-8">
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-6">
              <span
                className="rise-in"
                style={{ "--rise-delay": "120ms" } as React.CSSProperties}
              >
                <ClassPlate nama={kelas.name} />
              </span>

              <div className="min-w-0 flex-1">
                <h1
                  className="rise-in text-paper leading-[1.1]"
                  style={
                    {
                      ...DISPLAY_JUDUL,
                      fontSize: "clamp(2rem, 4.4vw, 3.1rem)",
                      "--rise-delay": "220ms",
                    } as React.CSSProperties
                  }
                >
                  <span className="mark-on-dark">{kelas.name}</span>
                </h1>

                {kelas.description && (
                  <p
                    className="rise-in mt-3 max-w-[58ch] text-paper/78 text-sm leading-[1.7]"
                    style={{ "--rise-delay": "320ms" } as React.CSSProperties}
                  >
                    {kelas.description}
                  </p>
                )}
              </div>
            </div>

            <div
              className="rise-in flex items-center gap-3 rounded-xl border border-white/28 bg-white/12 px-4 py-3"
              style={{ "--rise-delay": "420ms" } as React.CSSProperties}
            >
              <UserAvatar name={namaPengajar} photoURL={ownerCard?.photoURL ?? null} />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-[0.14em] text-paper/60">
                  Pengajar
                </span>
                <span className="block truncate text-sm font-medium text-paper">
                  {namaPengajar}
                </span>
              </span>
            </div>
          </div>

          {/* Tab lewat URL, bukan state klien: bisa ditautkan langsung, tetap
              bekerja tanpa JavaScript, dan tidak menahan daftar anggota di
              memori halaman yang sedang membaca umpan. */}
          <nav className="mt-9 flex gap-1.5 overflow-x-auto scrollbar-hide" aria-label="Bagian kelas">
            {TABS.map((t) => {
              const aktif = t.id === tab;
              return (
                <Link
                  key={t.id}
                  href={t.id === "pengumuman" ? basePath : `${basePath}?tab=${t.id}`}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-t-xl px-[22px] py-3 text-sm font-semibold transition-colors duration-200 max-sm:px-4",
                    aktif
                      ? "bg-paper text-blue-700"
                      : "bg-paper/10 text-paper/72 hover:bg-paper/20 hover:text-paper",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="bg-paper py-12">
        <div className="container-page grid gap-9 grid-cols-[minmax(0,1fr)_320px] max-lg:grid-cols-1 max-lg:gap-6">
          <div className="min-w-0">
            {tab === "pengumuman" && (
              <>
                {isOwner && (
                  <div className="mb-6">
                    <PostComposer
                      classId={kelas.id}
                      meName={meName}
                      mePhoto={mePhoto}
                    />
                  </div>
                )}

                <PostFeed
                  classId={kelas.id}
                  basePath={basePath}
                  posts={posts}
                  repliesByPost={repliesByPost}
                  cards={cards}
                  currentUid={currentUid}
                  meName={meName}
                  mePhoto={mePhoto}
                  canModerate={isOwner}
                  canReply
                />
              </>
            )}

            {tab === "tugas" && (
              <AssignmentList posts={posts} basePath={basePath} sudut={sudutTugas} saat={saat} />
            )}

            {tab === "anggota" && (
              <div className="overflow-hidden rounded-2xl border border-rule bg-paper-card">
                <ul className="divide-y divide-rule">
                  <li className="flex flex-wrap items-center gap-3 bg-paper px-6 py-4">
                    <ProfileLink
                      uid={kelas.ownerUid}
                      name={namaPengajar}
                      secondary
                      className="shrink-0"
                    >
                      <UserAvatar name={namaPengajar} photoURL={ownerCard?.photoURL ?? null} />
                    </ProfileLink>
                    <ProfileLink
                      uid={kelas.ownerUid}
                      name={namaPengajar}
                      className="min-w-0 flex-1 text-sm font-medium text-ink"
                    >
                      {namaPengajar}
                    </ProfileLink>
                    <Tag tone="blue">Pengajar</Tag>
                  </li>

                  {members.map((m) => {
                    const kartu = memberCards.get(m.uid);
                    const nama = kartu?.name ?? "Peserta";
                    return (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center gap-3 px-6 py-4 transition-colors duration-200 hover:bg-paper"
                      >
                        <ProfileLink uid={m.uid} name={nama} secondary className="shrink-0">
                          <UserAvatar name={nama} photoURL={kartu?.photoURL ?? null} />
                        </ProfileLink>
                        <div className="min-w-0 flex-1">
                          <ProfileLink
                            uid={m.uid}
                            name={nama}
                            className="text-sm font-medium text-ink"
                          >
                            {nama}
                          </ProfileLink>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Bergabung {formatDate(m.joinedAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {members.length === 0 && (
                  <p className="px-6 py-10 text-center text-sm text-ink-muted">
                    Belum ada peserta yang bergabung.
                  </p>
                )}
              </div>
            )}

            {tab === "tentang" && (
              <div className="rounded-2xl border border-rule bg-paper-card p-6">
                <h2 className="text-[20px] text-ink mb-4" style={DISPLAY_SEKSI}>
                  Tentang kelas ini
                </h2>

                <p className="text-[15px] leading-[1.75] text-ink-body whitespace-pre-line">
                  {kelas.description || "Pengajar belum menuliskan deskripsi untuk kelas ini."}
                </p>

                <dl className="mt-6 divide-y divide-rule border-t border-rule">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-sm text-ink-muted">Pengajar</dt>
                    <dd className="text-sm font-medium text-ink">{namaPengajar}</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-sm text-ink-muted">Dibuat</dt>
                    <dd className="text-sm font-medium text-ink">{formatDate(kelas.createdAt)}</dd>
                  </div>
                </dl>

                {/* Pengaturan tinggal di tab Tentang, bukan di bawah umpan:
                    formulir ubah nama dan tombol hapus yang menggantung di
                    ujung daftar pengumuman terbaca seperti bagian dari
                    percakapannya. */}
                {pengaturan && (
                  <div className="mt-8 border-t border-rule pt-6">{pengaturan}</div>
                )}
              </div>
            )}
          </div>

          <aside className="w-full lg:w-80 lg:sticky lg:top-24 lg:self-start space-y-4">
            <div className="rounded-2xl border border-rule bg-paper-card p-6">
              <p className="t-label text-ink-muted mb-4">Ringkasan</p>

              <dl className="divide-y divide-rule">
                {[
                  { label: "Anggota", nilai: kelas.memberCount },
                  { label: "Postingan", nilai: kelas.postCount },
                  { label: "Balasan", nilai: posts.reduce((n, p) => n + p.replyCount, 0) },
                ].map((b) => (
                  <div key={b.label} className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-ink-muted">{b.label}</dt>
                    <dd className="text-[17px] leading-none text-ink" style={DISPLAY_ANGKA}>
                      <CountUp value={String(b.nilai)} />
                    </dd>
                  </div>
                ))}
              </dl>

              {tumpukan.length > 0 && (
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex">
                    {tumpukan.map((m, i) => {
                      const kartu = memberCards.get(m.uid);
                      const nama = kartu?.name ?? "Peserta";
                      return (
                        <span
                          key={m.id}
                          className={cn(
                            "rounded-full border-2 border-paper-card",
                            i > 0 && "-ml-[9px]",
                          )}
                        >
                          <UserAvatar
                            name={nama}
                            photoURL={kartu?.photoURL ?? null}
                            size="sm"
                          />
                        </span>
                      );
                    })}
                  </span>

                  {sisa > 0 && <span className="text-[13px] text-ink-muted">+{sisa}</span>}

                  <Link
                    href={`${basePath}?tab=anggota`}
                    className="ml-auto text-[13px] text-blue-700 hover:underline underline-offset-4"
                  >
                    Lihat semua
                  </Link>
                </div>
              )}
            </div>

            {joinCode && <JoinCodePanel classId={kelas.id} joinCode={joinCode} />}

            {isMember && (
              <div className="pt-1">
                <DeleteButton target={{ kind: "leave", classId: kelas.id }} after="/kelas" />
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

/** Nada kelas dipakai halaman pemanggil untuk chip peran. */
export { nadaKelas };
