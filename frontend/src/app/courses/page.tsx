import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import SectionTitle from "@/components/sections/SectionTitle";
import CourseCatalog from "@/components/courses/CourseCatalog";
import { listCourseCategories, listCourses } from "@/lib/courses";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Semua Kursus – SynapEd",
};

// Lihat catatan di app/page.tsx — katalog dari DB tidak boleh dibekukan
// saat build, dan build tidak boleh bergantung pada API yang hidup.
export const dynamic = "force-dynamic";

/**
 * Katalog lengkap: seluruh kursus di SynapEd, dengan pencarian dan filter
 * (jenis kursus + rating). Penyaringannya di browser — lihat CourseCatalog.
 */
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  // ?q= datang dari anak panah bilah pencarian di hero.
  const { q } = await searchParams;
  const awal = (Array.isArray(q) ? q[0] : q)?.slice(0, 80) ?? "";
  const [courses, categories] = await Promise.all([listCourses(), listCourseCategories()]);

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-paper pb-28 pt-36">
        <div className="container-page">
          <div className="mb-14 flex flex-col items-center text-center">
            <SectionTitle as="h1" title="Semua Kursus" />
          </div>

          <CourseCatalog courses={courses} categories={categories} initialQuery={awal} />
        </div>
      </main>

      <Footer />
    </>
  );
}
