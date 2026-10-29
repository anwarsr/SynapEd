import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import BackLink from "@/components/ui/BackLink";
import QuizBuilder from "@/components/classes/quiz/QuizBuilder";
import { requireOwnedClass } from "@/lib/classGuards";
import { getQuiz, listPercobaan } from "@/lib/classQuizzes";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; quizId: string }>;
}

export const metadata: Metadata = { title: "Sunting Quiz – SynapEd" };

export const dynamic = "force-dynamic";

/** Sunting quiz. Soal terkunci bila sudah ada yang mengerjakan (lihat QuizBuilder & saveQuiz). */
export default async function QuizSuntingPage({ params }: Props) {
  const { id, quizId } = await params;
  const user = await requireUser(`/educator/classes/${id}/quiz/${quizId}`);
  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  const quiz = await getQuiz(id, quizId);
  if (!quiz) notFound();
  const terkunci = (await listPercobaan(id, quizId)).length > 0;

  return (
    <EducatorShell user={user}>
      <div className="kelas-jakarta container-page">
        <BackLink href={`/educator/classes/${id}?tab=quiz`}>{kelas.name}</BackLink>
        <h1 className="mx-auto mb-8 mt-8 max-w-[760px] text-[34px] font-semibold leading-[1.15] text-ink">Sunting quiz</h1>
        {/* key = waktu ubah: formulir dipasang ulang dari data terbaru setelah tersimpan. */}
        <QuizBuilder key={quiz.updatedAt} classId={id} awal={quiz} terkunci={terkunci} />
      </div>
    </EducatorShell>
  );
}
