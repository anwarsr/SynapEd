import { notFound, redirect } from "next/navigation";
import LearnShell from "@/components/learn/LearnShell";
import { flattenLessons, getCourse } from "@/lib/courses";
import { canViewLesson, requireCourseAccess } from "@/lib/courseAccess";
import { progressOf } from "@/lib/enrollments";
import type { Metadata } from "next";

/**
 * Catch-all opsional supaya kedua rute Laravel lama tetap berlaku:
 *   /courses/:slug/learn              -> pelajaran pertama
 *   /courses/:slug/learn/:lessonSlug  -> pelajaran tertentu
 */
interface Props {
  params: Promise<{ slug: string; lesson?: string[] }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  return { title: course ? `Belajar: ${course.title} – SynapEd` : "Belajar – SynapEd" };
}

export default async function LearnPage({ params }: Props) {
  const { slug, lesson } = await params;

  // Masuk DAN berhak. Sebelumnya di sini hanya ada pemeriksaan login, yang
  // berarti siapa pun yang punya akun bisa membuka kursus mana pun.
  const access = await requireCourseAccess(slug, `/courses/${slug}/learn`);
  const { course, enrollment } = access;

  // Kurikulum diratakan sekali; urutan section & lesson sudah dijamin
  // oleh kolom `position` di database.
  const flat = flattenLessons(course);
  if (flat.length === 0) notFound();

  const requested = lesson?.[0];
  const index = requested ? flat.findIndex((l) => l.slug === requested) : 0;
  if (index === -1) notFound();

  // Pelajaran terkunci dialihkan ke halaman penjualan, bukan 404: pelajarannya
  // memang ada, dan di sanalah tempat memperoleh aksesnya.
  if (!canViewLesson(access, flat[index])) redirect(`/courses/${slug}`);

  // Progres hanya berarti untuk peserta sungguhan — pratinjau admin/pemilik
  // kursus tidak punya dokumen enrollment untuk dilacak.
  const canTrackProgress = access.reason === "enrolled";

  return (
    <LearnShell
      course={course}
      current={flat[index]}
      prev={index > 0 ? flat[index - 1] : null}
      next={index < flat.length - 1 ? flat[index + 1] : null}
      locked={flat.filter((l) => !canViewLesson(access, l)).map((l) => l.slug)}
      completed={enrollment?.completedLessons ?? []}
      progress={progressOf(course, enrollment)}
      canTrackProgress={canTrackProgress}
    />
  );
}
