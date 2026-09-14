import Link from "next/link";
import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import CourseChangePanel from "@/components/educator/CourseChangePanel";
import CourseRequestPanel from "@/components/educator/CourseRequestPanel";
import Tag from "@/components/ui/Tag";
import { LEVELS, requireOwnedCourse } from "@/lib/educatorCourses";
import { listCategories } from "@/lib/categories";
import { pendingRequestFor } from "@/lib/courseRequests";
import { requireUser } from "@/lib/firebase/session";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { contributorPeople } from "@/lib/courseContributors";
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

  const [categories, pendingRequest, settings, people] = await Promise.all([
    listCategories(),
    pendingRequestFor(slug),
    getPaymentSettings(),
    contributorPeople(course.contributors),
  ]);

  const [pemilik, ...lain] = people;
  const owner = course.ownerUid && pemilik ? pemilik : null;

  /**
   * Admin menulis langsung; educator mengajukan.
   *
   * Admin adalah pihak yang menyetujui, jadi mengantrekan pekerjaannya sendiri
   * untuk disetujui dirinya sendiri hanya menambah langkah tanpa menambah
   * pengawasan.
   */
  const mode = user.role === "admin" ? "direct" : "request";
  const locked = mode === "request" && pendingRequest !== null;

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

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-h2">
            Sunting <span className="mark">{course.title}</span>
          </h1>
          <Tag tone={course.visibility === "public" ? "blue" : "neutral"}>
            {course.visibility === "public" ? "Tayang" : "Tersembunyi"}
          </Tag>
        </div>

        {mode === "request" && (
          <p className="t-body text-sm text-ink-muted -mt-4">
            Setiap perubahan ditinjau admin lebih dulu. Kursus yang sedang tayang tetap seperti
            sekarang sampai pengajuan Anda disetujui.
          </p>
        )}

        <CourseRequestPanel
          slug={slug}
          title={course.title}
          visibility={course.visibility}
          mode={mode}
          pendingRequest={pendingRequest}
        />

        <hr className="rule-line" />

        <CourseChangePanel
          slug={slug}
          course={course}
          levels={LEVELS.map((l) => ({ value: l.value }))}
          categories={categories.map((c) => ({ value: c.slug, label: c.label }))}
          mode={mode}
          locked={locked}
          owner={owner && { uid: owner.uid, name: owner.name, username: owner.username, photoURL: owner.photoURL }}
          ownerIsViewer={course.ownerUid === user.uid}
          initialContributors={lain.map((p) => ({
            uid: p.uid,
            name: p.name,
            username: p.username,
            photoURL: p.photoURL,
            share: p.share,
          }))}
          feePercent={settings.platformFeePercent}
        />
      </div>
    </EducatorShell>
  );
}
