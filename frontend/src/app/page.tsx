import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Courses from "@/components/sections/Courses";
import Features from "@/components/sections/Features";
import LearningPath from "@/components/sections/LearningPath";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";
import { listCourseCategories, listCourses } from "@/lib/courses";
import { listFeaturedReviews } from "@/lib/reviews";
import { courseImageUrl } from "@/lib/videoEmbed";
import type { TestimonialItem } from "@/components/sections/Testimonials";

// Katalog dibaca dari Firestore saat permintaan datang — perubahan di
// Firebase Console langsung tampil tanpa perlu rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [courses, categories, reviews] = await Promise.all([
    listCourses(),
    listCourseCategories(),
    listFeaturedReviews(),
  ]);

  // Gambar diselesaikan DI SINI, di server. Testimonials adalah komponen
  // klien, dan courseImageUrl membaca nama bucket dari env — memindahkannya
  // ke browser berarti menyeret nilai itu ikut serta tanpa alasan.
  const testimonials: TestimonialItem[] = reviews.map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.photoURL,
    content: r.comment,
    rating: r.rating,
    courseTitle: r.courseTitle,
    courseSlug: r.courseSlug,
    courseImage: courseImageUrl(r.courseThumbnail),
  }));

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Courses courses={courses} categories={categories} />
        <Features />
        <LearningPath />
        <Testimonials items={testimonials} />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
