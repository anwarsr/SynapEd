import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import AssignmentDetail from "@/components/classes/AssignmentDetail";
import SubmissionPanel from "@/components/classes/SubmissionPanel";
import { getPost } from "@/lib/classes";
import { requireClassAccess } from "@/lib/classGuards";
import { classSubmissionId, getClassSubmission, jamServer } from "@/lib/classAssignments";
import { formatWib, lewatTenggat, masihDibuka, statusTugas } from "@/lib/classAssignmentRules";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; postId: string }>;
}

export const metadata: Metadata = { title: "Tugas – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Halaman satu tugas dari sisi siswa.
 *
 * Yang dimuat hanya pengiriman MILIK pembaca (ID deterministik dari uid
 * sesi) — halaman ini tidak pernah membaca pengiriman siswa lain. Pemilik
 * kelas dan admin dialihkan ke halaman pengelola, tempat daftar pengumpulan
 * dan penilaian berada.
 */
export default async function TugasSiswaPage({ params }: Props) {
  const { id, postId } = await params;
  const user = await requireUser(`/kelas/${id}/tugas/${postId}`);

  const akses = await requireClassAccess(user, id);
  if (!akses) notFound();
  if (akses.isOwner) redirect(`/educator/classes/${id}/tugas/${postId}`);

  const post = await getPost(id, postId);
  if (!post || post.archived || post.kind !== "assignment" || !post.assignment) notFound();

  const [sub, kartu] = await Promise.all([
    getClassSubmission(classSubmissionId(id, postId, user.uid)),
    getUserCards([post.authorUid]),
  ]);

  const saat = jamServer();
  const p = post.assignment;

  return (
    <>
      <Navbar />

      <main className="bg-paper pt-32 pb-20">
        <AssignmentDetail
          post={post}
          namaKelas={akses.kelas.name}
          pengajar={kartu.get(post.authorUid)}
          kembali={`/kelas/${id}?tab=tugas`}
          saat={saat}
          samping={
            <SubmissionPanel
              classId={id}
              postId={postId}
              formats={p.formats}
              maxPoints={p.maxPoints}
              dibuka={masihDibuka(p, saat)}
              lewat={lewatTenggat(p.dueAt, saat)}
              status={statusTugas(sub, p, saat)}
              submission={sub}
              waktuKirim={sub ? formatWib(sub.submittedAt) : null}
            />
          }
        />
      </main>

      <Footer />
    </>
  );
}
