import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import Partners from "@/components/sections/Partners";
import About from "@/components/sections/About";
import ValueProposition from "@/components/sections/ValueProposition";
import Courses from "@/components/sections/Courses";
import Features from "@/components/sections/Features";
import LearningPath from "@/components/sections/LearningPath";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";
import { coursesApi } from "@/lib/api";

/**
 * Katalog hidup di database, jadi halaman ini TIDAK boleh di-prerender:
 *   1. kursus baru tidak akan muncul sampai di-rebuild, dan
 *   2. build frontend jadi gagal kalau API kebetulan sedang mati.
 * force-dynamic membuat data diambil saat permintaan datang.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const [courses, categories] = await Promise.all([
    coursesApi.list(),
    coursesApi.categories(),
  ]);

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Partners />
        <About />
        <ValueProposition />
        <Courses courses={courses} categories={categories} />
        <Features />
        <LearningPath />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
