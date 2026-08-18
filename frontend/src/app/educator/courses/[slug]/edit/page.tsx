import Link from "next/link";
import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import CourseMetaForm from "@/components/educator/CourseMetaForm";
import CurriculumEditor from "@/components/educator/CurriculumEditor";
import { LEVELS, requireOwnedCourse } from "@/lib/educatorCourses";
import { listCategories } from "@/lib/categories";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Sunting Kursus – SynapEd" };

// Bergantung pada cookie sesi dan kepemilikan kursus, jadi tidak boleh
// di-prerender.
export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: Props) {
  const { slug } = await params;

  const user = await requireUser(`/educator/courses/${slug}/edit`);

  // requireOwnedCourse mencakup admin DAN pemilik kursus — bukan
  // requireEducator, supaya admin (role-nya bukan "educator") tidak
  // ditolak lebih dulu sebelum sempat diperiksa kepemilikannya.
  const course = await requireOwnedCourse(user, slug);
  if (!course) notFound();

  const categories = await listCategories();

  return (
    <EducatorShell user={user}>
      <div className="container-reading space-y-10">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/educator/courses" className="hover:text-blue-700 transition-colors">
            Kursus Saya
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">Sunting</span>
        </nav>

        <h1 className="t-h2">
          Sunting <span className="mark">{course.title}</span>
        </h1>

        <CourseMetaForm
          slug={slug}
          initial={{
            title: course.title,
            shortDesc: course.shortDesc,
            longDesc: course.longDesc,
            level: course.level,
            category: course.category,
            duration: course.duration,
            price: course.price,
            thumbnail: course.thumbnail,
            whatYouLearn: course.whatYouLearn,
            requirements: course.requirements,
          }}
          levels={LEVELS.map((l) => ({ value: l.value }))}
          categories={categories.map((c) => ({ value: c.slug, label: c.label }))}
        />

        <hr className="rule-line" />

        <div>
          <h2 className="t-h3 mb-1.5">Kurikulum</h2>
          <p className="t-body text-sm text-ink-muted mb-6">Bagian dan pelajaran di dalam kursus ini.</p>
          <CurriculumEditor slug={slug} course={course} />
        </div>
      </div>
    </EducatorShell>
  );
}
