import Link from "next/link";
import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import ClassRoom, { toTab } from "@/components/classes/ClassRoom";
import ClassForm from "@/components/classes/ClassForm";
import DeleteButton from "@/components/classes/DeleteButton";
import { listClassMembers, loadClassFeed } from "@/lib/classes";
import { requireOwnedClass } from "@/lib/classGuards";
import { hitunganPengumpulan, jamServer } from "@/lib/classAssignments";
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
 * Ruang kelas dari sisi pengelolanya.
 *
 * Penjaganya requireUser + requireOwnedClass, BUKAN requireEducator.
 * requireEducator memeriksa `role !== "educator"`, sehingga ia mengalihkan
 * ADMIN juga — padahal admin harus bisa membuka kelas siapa pun untuk
 * memoderasinya. Halaman sunting kursus sudah menempuh jalan yang sama.
 */
export default async function EducatorClassPage({ params, searchParams }: Props) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/educator/classes/${id}`);

  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  const [umpan, members, hitungan] = await Promise.all([
    loadClassFeed(id),
    listClassMembers(id),
    hitunganPengumpulan(id),
  ]);
  const orang = await getUserCards([kelas.ownerUid, ...members.map((m) => m.uid)]);

  return (
    <EducatorShell user={user}>
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
        isOwner
        isMember={false}
        tab={toTab(tab)}
        basePath={`/educator/classes/${id}`}
        joinCode={kelas.joinCode}
        kembali={{ href: "/educator/classes", label: "Kelas Saya" }}
        sudutTugas={{ peran: "pengajar", hitungan, anggota: kelas.memberCount }}
        saat={jamServer()}
        pengaturan={
          <div>
            <h3 className="t-label text-ink-muted mb-4">Pengaturan kelas</h3>

            <ClassForm kelas={{ id, name: kelas.name, description: kelas.description, imageURL: kelas.imageURL }} />

            <div className="mt-5 flex flex-wrap items-center gap-5">
              <Link
                href={`/educator/classes/${id}/members`}
                className="group inline-flex items-center gap-2.5 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-[#fff]"
              >
                Kelola anggota
                <span aria-hidden="true" className="transition-transform duration-300 ease-warm group-hover:translate-x-1">→</span>
              </Link>

              <DeleteButton target={{ kind: "class", classId: id }} after="/educator/classes" />
            </div>
          </div>
        }
      />
    </EducatorShell>
  );
}
