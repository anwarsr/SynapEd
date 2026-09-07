import Link from "next/link";
import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import ClassForm from "@/components/classes/ClassForm";
import JoinCodePanel from "@/components/classes/JoinCodePanel";
import PostComposer from "@/components/classes/PostComposer";
import PostFeed from "@/components/classes/PostFeed";
import DeleteButton from "@/components/classes/DeleteButton";
import { loadClassFeed } from "@/lib/classes";
import { requireOwnedClass } from "@/lib/classGuards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
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
export default async function EducatorClassPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/educator/classes/${id}`);

  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  const { posts, repliesByPost, cards } = await loadClassFeed(id);

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <p className="chapter-mark mb-5">
          <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          <span>Educator</span>
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <h1 className="t-h2">{kelas.name}</h1>
          <Link
            href="/educator/classes"
            className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
          >
            ← Kelas Saya
          </Link>
        </div>

        <p className="t-body text-ink-muted mb-10">
          {kelas.memberCount} anggota · {kelas.postCount} postingan ·{" "}
          <Link
            href={`/educator/classes/${id}/members`}
            className="text-blue-700 hover:underline underline-offset-4"
          >
            lihat daftar anggota
          </Link>
        </p>

        <div className="space-y-6 mb-10">
          <JoinCodePanel classId={id} joinCode={kelas.joinCode} />
          <PostComposer classId={id} />
        </div>

        <PostFeed
          classId={id}
          posts={posts}
          repliesByPost={repliesByPost}
          cards={cards}
          currentUid={user.uid}
          canModerate
          canReply
        />

        <div className="mt-12 pt-8 border-t border-rule">
          <h2 className="t-h3 mb-5">Pengaturan kelas</h2>

          <ClassForm kelas={{ id, name: kelas.name, description: kelas.description }} />

          <div className="mt-6">
            <DeleteButton target={{ kind: "class", classId: id }} after="/educator/classes" />
          </div>
        </div>
      </div>
    </EducatorShell>
  );
}
