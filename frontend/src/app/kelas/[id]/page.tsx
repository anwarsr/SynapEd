import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import ClassRoom, { toTab } from "@/components/classes/ClassRoom";
import { listClassMembers, loadClassFeed } from "@/lib/classes";
import { requireClassAccess } from "@/lib/classGuards";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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
 * KODE UNDANGAN TIDAK PERNAH DIOPER DARI SINI. Halaman ini dibuka anggota
 * biasa, dan kode itu kunci untuk mengajak orang lain masuk.
 */
export default async function ClassPage({ params, searchParams }: Props) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/kelas/${id}`);

  const akses = await requireClassAccess(user, id);
  if (!akses) notFound();

  const { kelas, isOwner, isMember } = akses;

  const [umpan, members] = await Promise.all([loadClassFeed(id), listClassMembers(id)]);

  // Satu panggilan Auth untuk pemilik dan seluruh anggota sekaligus.
  const orang = await getUserCards([kelas.ownerUid, ...members.map((m) => m.uid)]);

  return (
    <>
      <Navbar />

      <main>
        <ClassRoom
          kelas={kelas}
          posts={umpan.posts}
          repliesByPost={umpan.repliesByPost}
          cards={umpan.cards}
          members={members}
          memberCards={orang}
          ownerCard={orang.get(kelas.ownerUid)}
          currentUid={user.uid}
          meName={user.name}
          mePhoto={user.photoURL}
          isOwner={isOwner}
          isMember={isMember}
          tab={toTab(tab)}
          basePath={`/kelas/${id}`}
          kembali={{ href: "/kelas", label: "Kelas Saya" }}
          overlayNav
        />
      </main>

      <Footer />
    </>
  );
}
