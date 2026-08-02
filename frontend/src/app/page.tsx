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

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Partners />
        <About />
        <ValueProposition />
        <Courses />
        <Features />
        <LearningPath />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
