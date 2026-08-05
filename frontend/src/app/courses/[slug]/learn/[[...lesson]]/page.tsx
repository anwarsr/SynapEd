import { notFound, redirect } from "next/navigation";
import LearnShell from "@/components/learn/LearnShell";
import { flattenLessons, getCourse } from "@/lib/courses";
import { getCurrentUser } from "@/lib/firebase/session";
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

  // Sama seperti middleware 'auth' di rute Laravel lama.
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/courses/${slug}/learn`);

  const course = await getCourse(slug);
  if (!course) notFound();

  // Kurikulum diratakan sekali; urutan section & lesson sudah dijamin
  // oleh kolom `position` di database.
  const flat = flattenLessons(course);
  if (flat.length === 0) notFound();

  const requested = lesson?.[0];
  const index = requested ? flat.findIndex((l) => l.slug === requested) : 0;
  if (index === -1) notFound();

  return (
    <LearnShell
      course={course}
      current={flat[index]}
      prev={index > 0 ? flat[index - 1] : null}
      next={index < flat.length - 1 ? flat[index + 1] : null}
      position={index + 1}
      total={flat.length}
    />
  );
}
