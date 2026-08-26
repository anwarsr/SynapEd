import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Button from "@/components/ui/Button";
import { getEnrollment } from "@/lib/enrollments";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kursus Selesai – SynapEd" };

/**
 * Halaman perayaan sekali lihat — dituju begitu pelajaran/kuis TERAKHIR
 * suatu kursus selesai (lihat LessonCompleteButton.tsx dan QuizRunner.tsx).
 * Bukan dashboard sertifikat: kalau belum ada yang dirayakan (belum
 * terdaftar, atau kursusnya belum tuntas), dialihkan balik ke halaman
 * belajar alih-alih menampilkan halaman kosong.
 */
export default async function CourseCompletePage({ params }: Props) {
  const { slug } = await params;
  const user = await requireUser(`/courses/${slug}/complete`);
  const enrollment = await getEnrollment(user.uid, slug);

  if (!enrollment || !enrollment.certificateId) {
    redirect(`/courses/${slug}/learn`);
  }

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading max-w-xl text-center">
          <p className="t-label text-blue-700 mb-3">Kursus Selesai</p>
          <h1 className="t-h2 mb-4">
            Selamat, Anda menyelesaikan <span className="mark">{enrollment.courseTitle}</span>!
          </h1>
          <p className="t-body text-ink-muted mb-10">
            Sertifikat Anda sudah terbit. Bagikan pencapaian ini, atau bantu peserta lain dengan
            meninggalkan ulasan.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button href={`/dashboard/certificates/${enrollment.certificateId}`} variant="primary">
              Lihat Sertifikat
            </Button>
            <Button href={`/courses/${slug}#ulasan`} variant="outline">
              Beri Ulasan
            </Button>
          </div>

          <p className="mt-10 text-sm text-ink-muted">
            <Link href="/dashboard" className="text-blue-700 hover:underline underline-offset-4">
              Kembali ke Dashboard
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}
