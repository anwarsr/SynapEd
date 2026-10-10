import BackLink from "@/components/ui/BackLink";
import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import GradeForm from "@/components/educator/GradeForm";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import { formatDate } from "@/lib/adminUsers";
import { formatBytes } from "@/lib/videoEmbed";
import { requireOwnedCourse } from "@/lib/educatorCourses";
import { listCourseEnrollments, progressFromSnapshot } from "@/lib/enrollments";
import { getUserCards } from "@/lib/userCards";
import {
  gradingStateOf,
  listCourseSubmissions,
  passingGradeOf,
  type Submission,
} from "@/lib/submissions";
import { requireEducator } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Peserta Kursus – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Daftar peserta satu kursus, beserta pengumpulan tugas yang perlu dinilai.
 *
 * Satu halaman, bukan dua: educator yang membuka daftar peserta hampir selalu
 * datang untuk menilai, dan memisahkannya berarti ia harus bolak-balik
 * mencocokkan nama dengan pengumpulan.
 */
export default async function CourseStudentsPage({ params }: Props) {
  const { slug } = await params;
  const user = await requireEducator(`/educator/courses/${slug}/students`);

  const course = await requireOwnedCourse(user, slug);
  if (!course) notFound();

  const [enrollments, submissions] = await Promise.all([
    listCourseEnrollments(slug),
    listCourseSubmissions(slug),
  ]);

  // Nama & foto peserta ada di Firebase Auth, bukan di dokumen enrollment.
  // Dibaca SEKALI untuk seluruh halaman — bukan satu panggilan per baris.
  const kartu = await getUserCards(enrollments.map((e) => e.uid));

  const batas = passingGradeOf(course);
  const perPeserta = new Map<string, Submission[]>();
  for (const s of submissions) {
    perPeserta.set(s.uid, [...(perPeserta.get(s.uid) ?? []), s]);
  }

  const menunggu = submissions.filter((s) => s.status === "submitted").length;

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <p className="chapter-mark mb-5">
          <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          <span>Educator</span>
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <h1 className="t-h2">
            Peserta <span className="mark">{course.title}</span>
          </h1>
          <BackLink href="/educator/courses">Kembali ke kursus saya</BackLink>
        </div>

        <p className="t-body text-ink-muted mb-10">
          {enrollments.length} peserta
          {menunggu > 0
            ? ` · ${menunggu} tugas menunggu dinilai`
            : " · tidak ada tugas yang menunggu dinilai"}
          {` · nilai minimum kelulusan ${batas}`}
        </p>

        {enrollments.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted">Belum ada yang mendaftar kursus ini.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {enrollments.map((e) => {
              const orang = kartu.get(e.uid);
              const nama = orang?.name ?? "Peserta";
              const progress = progressFromSnapshot(e);
              const milik = perPeserta.get(e.uid) ?? [];
              const nilai = gradingStateOf(course, milik);

              return (
                <li key={e.uid} className="bg-paper-card border border-rule rounded-2xl p-6">
                  <div className="flex flex-wrap items-start gap-3">
                    <ProfileLink uid={e.uid} name={nama} secondary className="shrink-0">
                      <UserAvatar name={nama} photoURL={orang?.photoURL ?? null} />
                    </ProfileLink>

                    <div className="min-w-0 flex-1">
                      <ProfileLink uid={e.uid} name={nama} className="text-sm font-medium text-ink">
                        {nama}
                      </ProfileLink>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Bergabung {formatDate(e.enrolledAt)} · {progress.done} dari {progress.total}{" "}
                        pelajaran ({progress.percent}%)
                      </p>
                    </div>

                    {e.certificateId ? (
                      <Tag tone="blue">Bersertifikat</Tag>
                    ) : nilai.total === 0 ? (
                      <Tag tone="amber">Tanpa tugas</Tag>
                    ) : nilai.clear ? (
                      <Tag tone="blue">Tugas lengkap</Tag>
                    ) : (
                      <Tag tone="amber">
                        {nilai.passed} dari {nilai.total} tugas lulus
                      </Tag>
                    )}
                  </div>

                  {milik.length === 0 ? (
                    <p className="mt-4 text-sm text-ink-muted">
                      Belum mengumpulkan tugas apa pun.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {milik.map((s) => (
                        <li key={s.id} className="rounded-xl border border-rule p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm font-medium text-ink">{s.lessonTitle}</span>
                            {s.status === "submitted" ? (
                              <Tag tone="amber">Menunggu dinilai</Tag>
                            ) : (
                              <Tag tone={(s.grade ?? 0) >= batas ? "blue" : "rust"}>
                                Nilai {s.grade}
                              </Tag>
                            )}
                          </div>

                          <p className="mt-2 text-xs text-ink-muted">
                            Dikumpulkan {formatDate(s.submittedAt)}
                            {s.gradedByName && ` · dinilai ${s.gradedByName}`}
                          </p>

                          {/* Berkasnya SELALU diunduh, tidak pernah dibuka di
                              tab - jenisnya bebas, dan membiarkan browser
                              merendernya berarti mengizinkan kiriman peserta
                              dieksekusi di domain ini. */}
                          <a
                            href={`/api/submissions/file?id=${encodeURIComponent(s.id)}`}
                            className="mt-2 inline-block text-sm text-blue-700 hover:underline underline-offset-4 break-all"
                          >
                            Unduh {s.fileName}
                            {formatBytes(s.fileSize) ? ` (${formatBytes(s.fileSize)})` : ""}
                          </a>

                          <GradeForm
                            id={s.id}
                            passingGrade={batas}
                            grade={s.grade}
                            feedback={s.feedback}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 text-xs text-ink-muted">
          Sertifikat baru bisa terbit setelah seluruh penugasan dan kuis peserta dinilai dan
          mencapai nilai minimum.
        </p>
      </div>
    </EducatorShell>
  );
}
