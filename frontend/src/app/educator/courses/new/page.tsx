import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import CourseForm from "@/components/educator/CourseForm";
import { LEVELS } from "@/lib/educatorCourses";
import { listCategories } from "@/lib/categories";
import { requireEducator } from "@/lib/firebase/session";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { getUsernameInfo } from "@/lib/usernames";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat Kursus – SynapEd" };

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const user = await requireEducator("/educator/courses/new");
  const [categories, settings, handle] = await Promise.all([
    listCategories(),
    getPaymentSettings(),
    getUsernameInfo(user.uid),
  ]);

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
          Susun sendiri isinya: modul, video, dan penugasan, sebanyak dan seurut yang Anda mau.
        </p>

        <CourseForm
          levels={LEVELS.map((l) => ({ value: l.value }))}
          categories={categories.map((c) => ({ value: c.slug, label: c.label }))}
          owner={{ uid: user.uid, name: user.name, username: handle.username, photoURL: user.photoURL }}
          feePercent={settings.platformFeePercent}
        />
      </div>
    </EducatorShell>
  );
}
