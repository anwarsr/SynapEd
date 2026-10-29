import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import BackLink from "@/components/ui/BackLink";
import QuizBuilder from "@/components/classes/quiz/QuizBuilder";
import { requireOwnedClass } from "@/lib/classGuards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Buat Quiz – SynapEd" };

export const dynamic = "force-dynamic";

/** Quiz baru. Penjaga requireUser + requireOwnedClass (admin ikut lolos), sama seperti halaman kelasnya. */
export default async function QuizBaruPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/educator/classes/${id}/quiz/new`);
  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  return (
    <EducatorShell user={user}>
      <div className="kelas-jakarta container-page">
        <BackLink href={`/educator/classes/${id}?tab=quiz`}>{kelas.name}</BackLink>
        <h1 className="mx-auto mb-8 mt-8 max-w-[760px] text-[34px] font-semibold leading-[1.15] text-ink">Buat quiz</h1>
        <QuizBuilder classId={id} />
      </div>
    </EducatorShell>
  );
}
