import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import CourseForm from "@/components/educator/CourseForm";
import { CATEGORIES, ICONS, LEVELS } from "@/lib/educatorCourses";
import { requireEducator } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat Kursus – SynapEd" };

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  await requireEducator("/educator/courses/new");

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
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
      </main>

      <Footer />
    </>
  );
}
