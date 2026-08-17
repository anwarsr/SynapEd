import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Courses from "@/components/sections/Courses";
import Features from "@/components/sections/Features";
import LearningPath from "@/components/sections/LearningPath";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";
import { listCategories, listCourses } from "@/lib/courses";

// Katalog dibaca dari Firestore saat permintaan datang — perubahan di
// Firebase Console langsung tampil tanpa perlu rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [courses, categories] = await Promise.all([listCourses(), listCategories()]);

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
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
