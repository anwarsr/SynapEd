import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import PostFeed from "@/components/classes/PostFeed";
import DeleteButton from "@/components/classes/DeleteButton";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import { loadClassFeed } from "@/lib/classes";
import { requireClassAccess } from "@/lib/classGuards";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Kelas – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Ruang kelas dari sisi anggotanya.
 *
 * Yang bukan anggota dijawab notFound(), bukan pesan "tidak berhak". Pesan
 * yang berbeda antara "kelas ini ada tapi bukan untukmu" dan "kelas ini tidak
 * ada" memberi penebak alamat cara memastikan sebuah kelas benar-benar ada.
 *
 * KODE UNDANGAN TIDAK PERNAH DIRENDER DI SINI. Halaman ini dibuka anggota
 * biasa, dan kode itu kunci untuk mengajak orang lain masuk.
 */
export default async function ClassPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/kelas/${id}`);

  const akses = await requireClassAccess(user, id);
  if (!akses) notFound();

  const { kelas, isOwner, isMember } = akses;
  const { posts, repliesByPost, cards } = await loadClassFeed(id);

  const pengajar = (await getUserCards([kelas.ownerUid])).get(kelas.ownerUid);
  const namaPengajar = pengajar?.name ?? "Pengajar";

  return (
    <>
      <Navbar />

      <main className="bg-paper pt-32 pb-24">
        <div className="container-reading">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Kelas</span>
          </p>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <h1 className="t-h2">{kelas.name}</h1>
            <Link
              href="/kelas"
              className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
            >
              ← Kelas Saya
            </Link>
          </div>

          {kelas.description && (
            <p className="t-body text-ink-body mb-6">{kelas.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-10">
            <ProfileLink uid={kelas.ownerUid} name={namaPengajar} secondary className="shrink-0">
              <UserAvatar name={namaPengajar} photoURL={pengajar?.photoURL ?? null} size="sm" />
            </ProfileLink>

            <p className="text-sm text-ink-muted">
              Pengajar{" "}
              <ProfileLink
                uid={kelas.ownerUid}
                name={namaPengajar}
                className="font-medium text-ink"
              >
                {namaPengajar}
              </ProfileLink>{" "}
              · {kelas.memberCount} anggota
            </p>
          </div>

          {isOwner && (
            <p className="t-body text-ink-muted mb-10">
              Anda pengelola kelas ini —{" "}
              <Link
                href={`/educator/classes/${id}`}
                className="text-blue-700 hover:underline underline-offset-4"
              >
                buka panel pengelolaan
              </Link>{" "}
              untuk menulis postingan dan melihat kode undangannya.
            </p>
          )}

          <PostFeed
            classId={id}
            posts={posts}
            repliesByPost={repliesByPost}
            cards={cards}
            currentUid={user.uid}
            canModerate={isOwner}
            canReply
          />

          {/* Hanya anggota sungguhan yang bisa keluar. Pemilik tidak punya
              dokumen keanggotaan, jadi tombol ini akan selalu gagal untuknya. */}
          {isMember && (
            <div className="mt-12 pt-8 border-t border-rule">
              <DeleteButton target={{ kind: "leave", classId: id }} after="/kelas" />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
