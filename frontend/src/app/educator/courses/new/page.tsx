import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import CourseForm from "@/components/educator/CourseForm";
import { CATEGORIES, ICONS, LEVELS } from "@/lib/educatorCourses";
import { requireEducator } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat Kursus – SynapEd" };

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const user = await requireEducator("/educator/courses/new");

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-8">
          <Link href="/educator/courses" className="hover:text-blue-700 transition-colors">
            Kursus Saya
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">Kursus baru</span>
        </nav>

        <h1 className="t-h2 mb-3">
          Buat <span className="mark">kursus baru</span>
        </h1>
        <p className="t-body text-ink-muted mb-10">
          Satu modul materi, satu video, dan satu penugasan akhir.
        </p>

        <CourseForm
          levels={LEVELS.map((l) => ({ value: l.value }))}
          categories={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          icons={ICONS}
        />
      </div>
    </EducatorShell>
  );
}
