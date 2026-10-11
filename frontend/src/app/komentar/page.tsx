import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import SectionTitle from "@/components/sections/SectionTitle";
import BackLink from "@/components/ui/BackLink";
import Reveal from "@/components/ui/Reveal";
import KomentarWall from "@/components/comments/KomentarWall";
import { listAllReviews } from "@/lib/reviews";
import { formatDate } from "@/lib/adminUsers";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Semua Komentar – SynapEd" };

// Ulasan dibaca dari Firestore saat permintaan datang.
export const dynamic = "force-dynamic";

/**
 * Seluruh ulasan peserta (semua bintang) - beranda hanya menampilkan yang
 * bintangnya 4 ke atas. Nama & foto penulis dibaca hidup dari Auth.
 */
export default async function KomentarPage() {
  const semua = await listAllReviews();
  const ulasan = semua.filter((r) => r.comment.trim() !== "");


  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-paper pb-28 pt-32">
        <div className="container-page">
          <BackLink href="/#testimonials" className="mb-10">
            Kembali ke beranda
          </BackLink>

          <Reveal className="mb-6 flex flex-col items-center text-center">
            <SectionTitle as="h1" title="Komentar" />
          </Reveal>

          {ulasan.length === 0 && (
            <p className="t-body mx-auto mb-12 max-w-xl text-center text-ink-muted">
              Belum ada komentar. Hanya peserta yang sudah menyelesaikan kursus yang dapat menulisnya.
            </p>
          )}

          {ulasan.length > 0 && (
            <KomentarWall
              items={ulasan.map((r) => ({
                id: r.id,
                uid: r.uid,
                name: r.name,
                avatar: r.photoURL,
                content: r.comment,
                rating: r.rating,
                courseTitle: r.courseTitle,
                courseSlug: r.courseSlug,
                tanggal: formatDate(r.createdAt),
                reply: r.reply ? { body: r.reply.body, by: r.reply.by } : null,
              }))}
            />
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
